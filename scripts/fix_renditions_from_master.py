#!/usr/bin/env python3
"""Rebuild web-safe H.264 renditions for the MODELLA lessons and the full-range lesson.

The four MODELLA lessons were published with a 4K HEVC 10-bit master (the raw
camera/render export) plus 2K renditions encoded at H.264 Level 5.0. HEVC does
not play on Chrome/Firefox/Edge and the 10-bit pipeline is not broadly
supported, so those options were effectively broken for most students.

This script takes the original 4K render master from
``/Volumes/Sviluppo/MODELLA`` and produces every quality (4K, 2K/1440p, 1080p,
720p, 480p, 360p) as browser-safe H.264 High, 8-bit yuv420p, faststart. The
original S3 master under ``videos/`` is never modified or deleted; only the
``streaming/`` renditions are replaced.

A second, smaller group re-encodes the lesson whose source is full-range
``yuvj420p``: the range is converted to limited-range yuv420p so colours render
correctly on every browser.

Run without ``--apply`` first to see the plan.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


PROFILE = "personale"
REGION = "us-east-1"
BUCKET = "prod-videocorso-content"
LESSONS_TABLE = "prod-videocorso-lessons"

# MODELLA_DIR defaults to the external drive but can be overridden (e.g. when the
# masters were copied to the internal disk so the external drive can be removed).
MODELLA_DIR = Path(os.environ.get("MODELLA_DIR", "/Volumes/Sviluppo/MODELLA"))
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", str(MODELLA_DIR / "_fixed_h264")))
KEEP_OUTPUTS = os.environ.get("KEEP_OUTPUTS") == "1"

# lesson_id -> (title, local master file name)
MODELLA_LESSONS = {
    "6096ec26-70db-461c-bdbb-685cdeffa6e5": ("Forma su modella", "MOD 4 LEZIONE 3 FORMA SU MODELLA.mp4"),
    "e8ad6dcc-bf29-463e-9192-16cc8b3f9e11": ("Primo passaggio", "MOD 7 LEZIONE 2 PRIMO PASSAGGIO(1).mp4"),
    "f7ca1389-885f-4fc7-90bf-01fa37e6f06d": ("Ripasso dei peli", "MOD 7 LEZ 3 RIPASSO PELI.mp4"),
    "fc38ebd8-4857-4b4a-86ad-0b0abd68e4aa": ("Maschera e pulizia finale", "MOD 7 LEZ 4 MASCERA PULIZIA FINALE.mp4"),
}

# The full-range (yuvj420p) lesson is rebuilt from its existing S3 source.
COLOR_LESSON = ("ebb896ea-b4e1-448a-a8b8-1fdc88c966ee", "Vendere e fare dermopigmentazione sono 2 cose diverse")

# suffix, width, height, level, bitrate, maxrate, bufsize, audio_bitrate, realtime
QUALITIES = [
    ("4k", 3840, 2160, 51, "14000k", "16000k", "24000k", "128k", True),
    ("1440p", 2560, 1440, 50, "9000k", "10000k", "15000k", "128k", True),
    ("1080p", 1920, 1080, 41, "5000k", "6000k", "9000k", "128k", False),
    ("720p", 1280, 720, 31, "2800k", "3500k", "5250k", "96k", False),
    ("480p", 854, 480, 31, "1400k", "1800k", "2700k", "80k", False),
    ("360p", 640, 360, 30, "800k", "1000k", "1500k", "64k", False),
]


def scan_all(table) -> list[dict]:
    response = table.scan()
    items = list(response.get("Items", []))
    while response.get("LastEvaluatedKey"):
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def asset_version(video_s3_key: str) -> str:
    parts = video_s3_key.strip("/").split("/")
    if len(parts) >= 4 and parts[0] == "videos" and parts[-1].startswith("source."):
        return parts[2]
    raise RuntimeError(f"Unexpected video_s3_key: {video_s3_key}")


def rendition_key(video_s3_key: str, suffix: str) -> str:
    parts = video_s3_key.strip("/").split("/")
    if len(parts) >= 4 and parts[0] == "videos" and parts[-1].startswith("source."):
        return f"streaming/{'/'.join(parts[1:-1])}/source_{suffix}.mp4"
    name = video_s3_key.rsplit("/", 1)[-1]
    stem = name.rsplit(".", 1)[0]
    return f"streaming/{stem}/{stem}_{suffix}.mp4"


def probe(source: str) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries",
            "stream=codec_name,profile,level,width,height,pix_fmt,color_range,r_frame_rate:format=duration",
            "-of", "json", source,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=300,
    )
    return json.loads(result.stdout)


def run_ffmpeg(command: list[str], output: Path, stall_timeout: int = 600) -> None:
    """Stream ffmpeg progress and abort if it stops producing output."""
    log_path = output.with_suffix(".ffmpeg.log")
    with log_path.open("w") as log_handle:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=log_handle, text=True)
        last_change = time.monotonic()
        last_size = -1
        last_report = 0.0
        while True:
            line = process.stdout.readline()
            if not line:
                if process.poll() is not None:
                    break
                now = time.monotonic()
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
                    raise RuntimeError(f"ffmpeg stalled for {stall_timeout}s")
                if now - last_report > 30:
                    print(f"    ... {output.name} {size / 1_000_000:.0f} MB", flush=True)
                    last_report = now
                time.sleep(1)
                continue
            if line.startswith("out_time_ms="):
                continue
        return_code = process.wait()
    if return_code != 0:
        tail = log_path.read_text(errors="replace")[-800:]
        raise RuntimeError(f"ffmpeg exit {return_code}: {tail}")


def build_command(source: str, output: Path, w: int, h: int, level: int, bitrate: str,
                  maxrate: str, bufsize: str, audio: str, realtime: bool,
                  convert_range: bool, hardware_decode: bool) -> list[str]:
    filters = [f"scale={w}:{h}:flags=lanczos"]
    if convert_range:
        filters = [f"scale={w}:{h}:flags=lanczos:in_range=pc:out_range=tv"]
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y"]
    if hardware_decode:
        command += ["-hwaccel", "videotoolbox"]
    command += [
        "-i", source,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", ",".join(filters),
        "-c:v", "h264_videotoolbox", "-profile:v", "high", "-level:v", str(level),
        "-b:v", bitrate, "-maxrate", maxrate, "-bufsize", bufsize,
        "-pix_fmt", "yuv420p", "-tag:v", "avc1",
        "-g", "60", "-force_key_frames", "expr:gte(t,n_forced*2)",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-color_range", "tv",
    ]
    if realtime:
        command += ["-realtime", "1"]
    command += [
        "-c:a", "aac", "-b:a", audio, "-ar", "48000",
        "-movflags", "+faststart", str(output),
    ]
    return command


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


def validate(output: Path, source_duration: float, w: int, h: int, level: int,
             require_limited_range: bool = False) -> dict:
    metadata = probe(str(output))
    stream = metadata["streams"][0]
    duration = float(metadata["format"]["duration"])
    atoms = top_level_atoms(output)
    if stream.get("codec_name") != "h264":
        raise RuntimeError(f"Unexpected codec: {stream.get('codec_name')}")
    if stream.get("pix_fmt") != "yuv420p":
        raise RuntimeError(f"Unexpected pixel format: {stream.get('pix_fmt')}")
    if int(stream.get("level") or 999) > level:
        raise RuntimeError(f"H.264 level too high: {stream.get('level')} > {level}")
    if (int(stream["width"]), int(stream["height"])) != (w, h):
        raise RuntimeError(f"Unexpected dimensions: {stream.get('width')}x{stream.get('height')}")
    if abs(duration - source_duration) > 1.5:
        raise RuntimeError(f"Duration mismatch: {duration} vs {source_duration}")
    if require_limited_range and str(stream.get("color_range", "")).lower() not in {"tv", "limited"}:
        raise RuntimeError(f"Range not limited: {stream.get('color_range')}")
    if "moov" not in atoms or "mdat" not in atoms or atoms.index("moov") > atoms.index("mdat"):
        raise RuntimeError(f"MP4 is not faststart: {atoms}")
    return metadata


def remote_is_ok(s3, key: str, w: int, h: int, level: int, require_limited_range: bool) -> bool:
    """True when the S3 rendition already is the wanted web-safe H.264 file."""
    try:
        url = s3.generate_presigned_url(
            "get_object", Params={"Bucket": BUCKET, "Key": key}, ExpiresIn=600,
        )
        stream = probe(url)["streams"][0]
    except Exception:
        return False
    if stream.get("codec_name") != "h264" or stream.get("pix_fmt") != "yuv420p":
        return False
    if (int(stream["width"]), int(stream["height"])) != (w, h):
        return False
    if int(stream.get("level") or 999) > level:
        return False
    if require_limited_range and str(stream.get("color_range", "")).lower() not in {"tv", "limited"}:
        return False
    return True


def encode_quality(source: str, output: Path, source_duration: float, quality: tuple,
                   convert_range: bool, hardware_decode: bool) -> None:
    suffix, w, h, level, bitrate, maxrate, bufsize, audio, realtime = quality
    command = build_command(source, output, w, h, level, bitrate, maxrate, bufsize, audio,
                            realtime, convert_range, hardware_decode)
    run_ffmpeg(command, output)
    validate(output, source_duration, w, h, level, require_limited_range=convert_range)


def upload(s3, table, local: Path, key: str, lesson_id: str, attribute: str) -> None:
    s3.upload_file(
        str(local), BUCKET, key,
        ExtraArgs={
            "ContentType": "video/mp4",
            "CacheControl": "public, max-age=31536000, immutable",
        },
    )
    table.update_item(
        Key={"lesson_id": lesson_id},
        UpdateExpression=f"SET {attribute} = :now",
        ExpressionAttributeValues={":now": datetime.now(timezone.utc).isoformat()},
    )


def process_modella(s3, table, lesson_id: str, title: str, master: Path, video_s3_key: str,
                    apply: bool, only_qualities: set[str], resume: bool) -> list[str]:
    failures: list[str] = []
    metadata = probe(str(master))
    source_duration = float(metadata["format"]["duration"])
    lesson_dir = OUTPUT_DIR / lesson_id
    print(f"\n=== {title} ({master.name}) {source_duration:.0f}s ===", flush=True)
    if apply:
        lesson_dir.mkdir(parents=True, exist_ok=True)

    for quality in QUALITIES:
        suffix = quality[0]
        if only_qualities and suffix not in only_qualities:
            continue
        w, h, level = quality[1], quality[2], quality[3]
        key = rendition_key(video_s3_key, suffix)
        if resume and remote_is_ok(s3, key, w, h, level, False):
            print(f"  [{suffix}] already web-safe, skipping", flush=True)
            continue
        output = lesson_dir / f"master_{suffix}.mp4"
        print(f"  [{suffix}] -> {key}", flush=True)
        if not apply:
            continue
        if output.exists():
            output.unlink()
        try:
            encode_quality(str(master), output, source_duration, quality,
                           convert_range=False, hardware_decode=True)
        except Exception as exc:
            print(f"    FAILED {suffix}: {exc}", flush=True)
            failures.append(f"{title} {suffix}")
            continue
        upload(s3, table, output, key, lesson_id, "modella_h264_fixed_at")
        size_mb = output.stat().st_size / 1_000_000
        print(f"    uploaded {size_mb:.0f} MB", flush=True)
        # 1440p is also exposed under the 2k alias.
        if suffix == "1440p":
            upload(s3, table, output, rendition_key(video_s3_key, "2k"), lesson_id, "modella_h264_fixed_at")
            print("    uploaded 2k alias", flush=True)
        if not KEEP_OUTPUTS:
            output.unlink(missing_ok=True)
    return failures


def process_color_lesson(s3, table, lesson_id: str, title: str, video_s3_key: str,
                         apply: bool, only_qualities: set[str], resume: bool) -> list[str]:
    failures: list[str] = []
    source_url = s3.generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": video_s3_key}, ExpiresIn=21_600,
    )
    metadata = probe(source_url)
    source_duration = float(metadata["format"]["duration"])
    lesson_dir = OUTPUT_DIR / lesson_id
    print(f"\n=== {title} (full-range source) {source_duration:.0f}s ===", flush=True)
    if apply:
        lesson_dir.mkdir(parents=True, exist_ok=True)

    for quality in QUALITIES:
        suffix = quality[0]
        if suffix == "4k" or suffix == "1440p":
            continue
        if only_qualities and suffix not in only_qualities:
            continue
        w, h, level = quality[1], quality[2], quality[3]
        key = rendition_key(video_s3_key, suffix)
        if resume and remote_is_ok(s3, key, w, h, level, True):
            print(f"  [{suffix}] already web-safe, skipping", flush=True)
            continue
        output = lesson_dir / f"master_{suffix}.mp4"
        print(f"  [{suffix}] -> {key}", flush=True)
        if not apply:
            continue
        try:
            encode_quality(source_url, output, source_duration, quality,
                           convert_range=True, hardware_decode=False)
        except Exception as exc:
            print(f"    FAILED {suffix}: {exc}", flush=True)
            failures.append(f"{title} {suffix}")
            continue
        upload(s3, table, output, key, lesson_id, "range_fixed_at")
        size_mb = output.stat().st_size / 1_000_000
        print(f"    uploaded {size_mb:.0f} MB", flush=True)
        if not KEEP_OUTPUTS:
            output.unlink(missing_ok=True)
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Encode and upload; otherwise only show the plan")
    parser.add_argument("--lesson-id", action="append", help="Limit to one or more lesson IDs")
    parser.add_argument("--quality", action="append", help="Limit to one or more quality suffixes")
    parser.add_argument("--resume", action="store_true",
                        help="Skip qualities whose S3 object is already web-safe H.264")
    args = parser.parse_args()

    if not MODELLA_DIR.is_dir():
        print(f"External drive not mounted: {MODELLA_DIR}", file=sys.stderr)
        return 2

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    s3 = session.client("s3")
    table = session.resource("dynamodb").Table(LESSONS_TABLE)
    lessons = {lesson["lesson_id"]: lesson for lesson in scan_all(table)}
    requested = set(args.lesson_id or [])
    only_qualities = set(args.quality or [])

    targets = []
    for lesson_id, (title, filename) in MODELLA_LESSONS.items():
        if requested and lesson_id not in requested:
            continue
        lesson = lessons.get(lesson_id)
        if not lesson or not lesson.get("video_s3_key"):
            print(f"Skipping {title}: lesson or video_s3_key not found", flush=True)
            continue
        master = MODELLA_DIR / filename
        if not master.is_file():
            print(f"Skipping {title}: master not found at {master}", flush=True)
            continue
        targets.append(("modella", lesson_id, title, master, lesson["video_s3_key"]))

    if not requested or COLOR_LESSON[0] in requested:
        lesson = lessons.get(COLOR_LESSON[0])
        if lesson and lesson.get("video_s3_key"):
            targets.append(("color", COLOR_LESSON[0], COLOR_LESSON[1], None, lesson["video_s3_key"]))

    print(f"Targets: {len(targets)}  (apply={args.apply})", flush=True)
    failures: list[str] = []
    for kind, lesson_id, title, master, video_s3_key in targets:
        if kind == "modella":
            failures += process_modella(s3, table, lesson_id, title, master, video_s3_key,
                                        args.apply, only_qualities, args.resume)
        else:
            failures += process_color_lesson(s3, table, lesson_id, title, video_s3_key,
                                             args.apply, only_qualities, args.resume)

    if failures:
        print(f"\nFailed: {', '.join(failures)}", flush=True)
        return 1
    print("\nDone.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
