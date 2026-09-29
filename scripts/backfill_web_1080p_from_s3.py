#!/usr/bin/env python3
"""Create browser-safe 1080p renditions for legacy source-only lessons.

The original S3 object is never modified or deleted. The source is read through
a short-lived presigned URL, ffmpeg writes one temporary local rendition, the
result is validated (H.264 High Level 4.1, yuv420p, faststart, keyframe every
two seconds), and only then is it uploaded under the immutable lesson asset
version in ``streaming/``.

Once ``source_1080p.mp4`` exists the video handler stops exposing the heavy
original upload as the "Full HD" option, so every selectable quality is
browser-safe.
"""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


PROFILE = "personale"
REGION = "us-east-1"
BUCKET = "prod-videocorso-content"
LESSONS_TABLE = "prod-videocorso-lessons"

TARGET_SHORT_SIDE = 1080
MAX_H264_LEVEL = 41


def scan_all(table) -> list[dict]:
    response = table.scan()
    items = list(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def rendition_key(source_key: str, suffix: str) -> str:
    parts = source_key.strip("/").split("/")
    if len(parts) >= 4 and parts[0] == "videos" and parts[-1].startswith("source."):
        return f"streaming/{'/'.join(parts[1:-1])}/source_{suffix}.mp4"
    name = source_key.rsplit("/", 1)[-1]
    stem = name.rsplit(".", 1)[0]
    return f"streaming/{stem}/{stem}_{suffix}.mp4"


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
        timeout=300,
    )
    return json.loads(result.stdout)


def frame_rate(value: str) -> float:
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator or 1)


def build_common(source_url: str, metadata: dict) -> list[str]:
    stream = metadata["streams"][0]
    width = int(stream["width"])
    height = int(stream["height"])
    scale = (
        f"scale={TARGET_SHORT_SIDE}:-2"
        if height > width
        else f"scale=-2:{TARGET_SHORT_SIDE}"
    )
    filters = [scale]
    if frame_rate(stream.get("r_frame_rate", "30/1")) > 30.5:
        filters.append("fps=30")
    return [
        "-hide_banner", "-loglevel", "error", "-xerror", "-y", "-i", source_url,
        "-map", "0:v:0", "-map", "0:a:0?", "-vf", ",".join(filters),
    ]


def run_ffmpeg(command: list[str], output: Path, timeout: int, stall_timeout: int = 120) -> None:
    """Run ffmpeg and abort if it hangs without producing output.

    VideoToolbox occasionally wedges on specific inputs (0% CPU, no growth);
    a plain subprocess.run would hang until the global timeout. Watching the
    output size lets us kill it within ``stall_timeout`` and fall back to a
    software encode for that lesson.
    """
    log_path = output.with_suffix(".ffmpeg.log")
    with log_path.open("w") as log_handle:
        process = subprocess.Popen(command, stdout=log_handle, stderr=log_handle)
        started = time.monotonic()
        last_size = -1
        last_change = started
        while True:
            return_code = process.poll()
            if return_code is not None:
                break
            now = time.monotonic()
            if now - started > timeout:
                process.kill()
                process.wait()
                raise RuntimeError(f"ffmpeg exceeded {timeout}s")
            try:
                size = output.stat().st_size
            except FileNotFoundError:
                size = 0
            if size != last_size:
                last_size = size
                last_change = now
            elif now - last_change > stall_timeout:
                process.kill()
                process.wait()
                raise RuntimeError(f"ffmpeg made no progress for {stall_timeout}s")
            time.sleep(5)

    if return_code != 0:
        tail = log_path.read_text(errors="replace")[-800:]
        raise RuntimeError(f"ffmpeg exit {return_code}: {tail}")


def encode(source_url: str, output: Path, metadata: dict, hardware: bool) -> None:
    common = build_common(source_url, metadata)
    if hardware:
        command = [
            "ffmpeg", *common,
            "-c:v", "h264_videotoolbox", "-profile:v", "high",
            "-level:v", "4.1",
            "-b:v", "5000k", "-maxrate", "6000k", "-bufsize", "6000k",
            "-pix_fmt", "yuv420p", "-tag:v", "avc1", "-g", "60",
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
            "-movflags", "+faststart", str(output),
        ]
        timeout = 5400
    else:
        command = [
            "ffmpeg", *common,
            "-c:v", "libx264", "-preset", "veryfast",
            "-b:v", "5000k", "-maxrate", "6000k", "-bufsize", "6000k",
            "-profile:v", "high", "-level:v", "4.1", "-pix_fmt", "yuv420p",
            "-tag:v", "avc1", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
            "-movflags", "+faststart", str(output),
        ]
        timeout = 10800
    run_ffmpeg(command, output, timeout)


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


def validate(output: Path, source_duration: float, source_short_side: int) -> dict:
    metadata = probe(str(output))
    stream = metadata["streams"][0]
    duration = float(metadata["format"]["duration"])
    atoms = top_level_atoms(output)
    if stream.get("codec_name") != "h264":
        raise RuntimeError(f"Unexpected codec: {stream.get('codec_name')}")
    if stream.get("pix_fmt") != "yuv420p":
        raise RuntimeError(f"Unexpected pixel format: {stream.get('pix_fmt')}")
    if int(stream.get("level") or 999) > MAX_H264_LEVEL:
        raise RuntimeError(f"H.264 level is not web-safe: {stream.get('level')}")
    expected_short_side = min(source_short_side, TARGET_SHORT_SIDE)
    if min(int(stream["width"]), int(stream["height"])) != expected_short_side:
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
    parser.add_argument("--allow-upscale", action="store_true", help="Also process sources below 1080p")
    parser.add_argument("--force", action="store_true", help="Re-encode even sources that are already browser-safe")
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

    pending: list[tuple[dict, str, int]] = []
    for lesson in lessons:
        target = rendition_key(lesson["video_s3_key"], "1080p")
        if object_exists(s3, target):
            continue
        source_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": lesson["video_s3_key"]},
            ExpiresIn=21_600,
        )
        try:
            stream = probe(source_url)["streams"][0]
        except Exception as exc:
            print(f"Skipping {lesson.get('title')}: cannot probe source ({exc})", flush=True)
            continue
        short_side = min(int(stream["width"]), int(stream["height"]))
        if short_side < TARGET_SHORT_SIDE and not args.allow_upscale:
            print(
                f"Skipping {lesson.get('title')}: source is only {stream['width']}x{stream['height']}",
                flush=True,
            )
            continue
        codec = stream.get("codec_name")
        level = int(stream.get("level") or 999)
        if (
            not args.force
            and codec == "h264"
            and level <= MAX_H264_LEVEL
            and stream.get("pix_fmt") == "yuv420p"
        ):
            print(
                f"Skipping {lesson.get('title')}: source already browser-safe "
                f"({codec} L{level / 10:.1f}, {stream['width']}x{stream['height']})",
                flush=True,
            )
            continue
        pending.append((lesson, target, short_side))

    print(f"Pending browser-safe 1080p renditions: {len(pending)}", flush=True)
    failures: list[str] = []
    for index, (lesson, target, short_side) in enumerate(pending, 1):
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
                with tempfile.TemporaryDirectory(prefix="chiara-1080p-") as temp:
                    output = Path(temp) / "source_1080p.mp4"
                    try:
                        encode(source_url, output, source_metadata, hardware=True)
                        result = validate(output, source_duration, short_side)
                    except Exception as hardware_error:
                        print(f"    hardware encode rejected ({hardware_error}); using libx264", flush=True)
                        encode(source_url, output, source_metadata, hardware=False)
                        result = validate(output, source_duration, short_side)
                    s3.upload_file(
                        str(output), BUCKET, target,
                        ExtraArgs={
                            "ContentType": "video/mp4",
                            "CacheControl": "public, max-age=31536000, immutable",
                        },
                    )
                    table.update_item(
                        Key={"lesson_id": lesson["lesson_id"]},
                        UpdateExpression="SET web_1080p_backfilled_at = :now",
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
