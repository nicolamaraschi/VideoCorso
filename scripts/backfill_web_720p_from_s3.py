#!/usr/bin/env python3
"""Create browser-safe 720p renditions for legacy source-only lessons.

The original S3 object is never modified or deleted. The source is read through
a short-lived presigned URL, ffmpeg writes one temporary local rendition, the
result is validated, and only then is it uploaded under the immutable lesson
asset version in ``streaming/``.
"""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


PROFILE = "personale"
REGION = "us-east-1"
BUCKET = "prod-videocorso-content"
LESSONS_TABLE = "prod-videocorso-lessons"


def scan_all(table) -> list[dict]:
    response = table.scan()
    items = list(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def rendition_key(source_key: str) -> str:
    parts = source_key.strip("/").split("/")
    if len(parts) >= 4 and parts[0] == "videos" and parts[-1].startswith("source."):
        return f"streaming/{'/'.join(parts[1:-1])}/source_720p.mp4"
    name = source_key.rsplit("/", 1)[-1]
    stem = name.rsplit(".", 1)[0]
    return f"streaming/{stem}/{stem}_720p.mp4"


def object_exists(s3, key: str) -> bool:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return False
        raise


def probe(source: str) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries",
            "stream=codec_name,profile,level,width,height,pix_fmt,r_frame_rate:format=duration",
            "-of", "json", source,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return json.loads(result.stdout)


def frame_rate(value: str) -> float:
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator or 1)


def transcode(source_url: str, output: Path, metadata: dict) -> None:
    stream = metadata["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    scale = "scale=720:-2" if height > width else "scale=-2:720"
    filters = [scale]
    if frame_rate(stream.get("r_frame_rate", "30/1")) > 30.5:
        filters.append("fps=30")

    common = [
        "-hide_banner", "-loglevel", "error", "-xerror", "-y", "-i", source_url,
        "-map", "0:v:0", "-map", "0:a:0?", "-vf", ",".join(filters),
    ]
    videotoolbox = [
        "ffmpeg", *common,
        "-c:v", "h264_videotoolbox", "-profile:v", "high", "-level:v", "3.1",
        "-b:v", "2500k", "-maxrate", "5000k", "-bufsize", "5000k",
        "-pix_fmt", "yuv420p", "-tag:v", "avc1", "-g", "60",
        "-force_key_frames", "expr:gte(t,n_forced*2)",
        "-c:a", "aac", "-b:a", "96k", "-ar", "48000",
        "-movflags", "+faststart", str(output),
    ]
    try:
        subprocess.run(videotoolbox, check=True, timeout=3600)
        return
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    software = [
        "ffmpeg", *common,
        "-c:v", "libx264", "-preset", "fast", "-b:v", "2500k",
        "-maxrate", "5000k", "-bufsize", "5000k",
        "-profile:v", "high", "-level:v", "3.1", "-pix_fmt", "yuv420p",
        "-tag:v", "avc1", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-force_key_frames", "expr:gte(t,n_forced*2)",
        "-c:a", "aac", "-b:a", "96k", "-ar", "48000",
        "-movflags", "+faststart", str(output),
    ]
    subprocess.run(software, check=True, timeout=7200)


def top_level_atoms(path: Path) -> list[str]:
    atoms: list[str] = []
    total = path.stat().st_size
    offset = 0
    with path.open("rb") as handle:
        while offset + 8 <= total and len(atoms) < 20:
            handle.seek(offset)
            header = handle.read(16)
            size = struct.unpack(">I", header[:4])[0]
            atom = header[4:8].decode("latin1")
            header_size = 8
            if size == 1:
                size = struct.unpack(">Q", header[8:16])[0]
                header_size = 16
            elif size == 0:
                size = total - offset
            if size < header_size:
                raise RuntimeError(f"Invalid MP4 atom {atom} at {offset}")
            atoms.append(atom)
            offset += size
    return atoms


def validate(output: Path, source_duration: float) -> dict:
    metadata = probe(str(output))
    stream = metadata["streams"][0]
    duration = float(metadata["format"]["duration"])
    atoms = top_level_atoms(output)
    if stream.get("codec_name") != "h264":
        raise RuntimeError(f"Unexpected codec: {stream.get('codec_name')}")
    if stream.get("pix_fmt") != "yuv420p":
        raise RuntimeError(f"Unexpected pixel format: {stream.get('pix_fmt')}")
    if int(stream.get("level") or 999) > 31:
        raise RuntimeError(f"H.264 level is not web-safe: {stream.get('level')}")
    if min(int(stream["width"]), int(stream["height"])) != 720:
        raise RuntimeError(f"Unexpected dimensions: {stream.get('width')}x{stream.get('height')}")
    if abs(duration - source_duration) > 1.0:
        raise RuntimeError(f"Duration mismatch: {duration} vs {source_duration}")
    if "moov" not in atoms or "mdat" not in atoms or atoms.index("moov") > atoms.index("mdat"):
        raise RuntimeError(f"MP4 is not faststart: {atoms}")
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Encode and upload; otherwise only show the plan")
    parser.add_argument("--lesson-id", action="append", help="Limit to one or more lesson IDs")
    args = parser.parse_args()

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    s3 = session.client("s3")
    table = session.resource("dynamodb").Table(LESSONS_TABLE)
    requested = set(args.lesson_id or [])
    lessons = [
        lesson for lesson in scan_all(table)
        if lesson.get("video_s3_key")
        and lesson.get("transcode_status") != "NATIVE"
        and (not requested or lesson.get("lesson_id") in requested)
    ]

    pending = []
    for lesson in lessons:
        target = rendition_key(lesson["video_s3_key"])
        if not object_exists(s3, target):
            pending.append((lesson, target))

    print(f"Pending browser-safe 720p renditions: {len(pending)}", flush=True)
    failures: list[str] = []
    for index, (lesson, target) in enumerate(pending, 1):
        print(f"[{index}/{len(pending)}] {lesson.get('title')} -> {target}", flush=True)
        if not args.apply:
            continue

        completed = False
        for attempt in range(1, 4):
            try:
                source_url = s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": BUCKET, "Key": lesson["video_s3_key"]},
                    ExpiresIn=21_600,
                )
                source_metadata = probe(source_url)
                source_duration = float(source_metadata["format"]["duration"])
                with tempfile.TemporaryDirectory(prefix="chiara-720p-") as temp:
                    output = Path(temp) / "source_720p.mp4"
                    transcode(source_url, output, source_metadata)
                    result = validate(output, source_duration)
                    s3.upload_file(
                        str(output), BUCKET, target,
                        ExtraArgs={
                            "ContentType": "video/mp4",
                            "CacheControl": "public, max-age=31536000, immutable",
                        },
                    )
                    table.update_item(
                        Key={"lesson_id": lesson["lesson_id"]},
                        UpdateExpression="SET web_720p_backfilled_at = :now",
                        ExpressionAttributeValues={":now": datetime.now(timezone.utc).isoformat()},
                    )
                    stream = result["streams"][0]
                    print(
                        f"    uploaded {output.stat().st_size / 1_000_000:.1f} MB "
                        f"({stream['width']}x{stream['height']} H.264 L{int(stream['level']) / 10:.1f})",
                        flush=True,
                    )
                completed = True
                break
            except Exception as exc:  # Continue the batch after transient CDN/TLS failures.
                print(f"    attempt {attempt}/3 failed: {exc}", flush=True)
        if not completed:
            failures.append(lesson["lesson_id"])

    if failures:
        print(f"Failed lessons: {', '.join(failures)}", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
