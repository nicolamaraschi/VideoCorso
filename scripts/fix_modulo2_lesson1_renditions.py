#!/usr/bin/env python3
"""Transcode vertical renditions (720p, 480p, 360p) for Modulo 2 Lezione 1 (2d4301ad-c191-4e8b-89fb-84801c8ea419)
and upload them to replace stale pillarboxed horizontal renditions in S3,
then invalidate CloudFront cache.
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

import boto3

PROFILE = "personale"
REGION = "us-east-1"
BUCKET = "prod-videocorso-content"
DISTRIBUTION_ID = "E3RGTK4NRBCHH1"
LESSON_ID = "2d4301ad-c191-4e8b-89fb-84801c8ea419"
ASSET_VERSION = "69ed43c6722d4294ace3726e038aae5f"

SOURCE_PATH = Path("/tmp/m2_l1_source.mp4")
OUTPUT_DIR = Path("/tmp/m2_l1_fixed_renditions")

PROFILES = (
    ("source_720p.mp4", "720p", 720, 1280, "2200k", "96k"),
    ("source_480p.mp4", "480p", 480, 854, "1100k", "80k"),
    ("source_360p.mp4", "360p", 360, 640, "650k", "64k"),
)


def probe(path: Path) -> tuple[int, int, float, str, str]:
    raw = subprocess.check_output(
        [
            "/opt/homebrew/bin/ffprobe",
            "-v", "error",
            "-show_entries", "stream=codec_name,pix_fmt,width,height:format=duration",
            "-of", "json",
            str(path),
        ],
        text=True,
    )
    data = json.loads(raw)
    video = next(s for s in data["streams"] if s.get("codec_name") == "h264")
    return (
        int(video["width"]),
        int(video["height"]),
        float(data["format"]["duration"]),
        video["codec_name"],
        video.get("pix_fmt", ""),
    )


def main():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Source file {SOURCE_PATH} not found!")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    source_w, source_h, source_dur, _, _ = probe(SOURCE_PATH)
    print(f"Source: {source_w}x{source_h}, duration={source_dur:.2f}s")
    assert source_w == 1080 and source_h == 1920, f"Expected 1080x1920, got {source_w}x{source_h}"

    for filename, label, width, height, v_bitrate, a_bitrate in PROFILES:
        out_path = OUTPUT_DIR / filename
        print(f"\n--- Transcoding {label} ({width}x{height}) -> {out_path} ---")

        # Use videotoolbox hardware acceleration
        cmd = [
            "/opt/homebrew/bin/ffmpeg",
            "-y",
            "-i", str(SOURCE_PATH),
            "-vf", f"scale={width}:{height}",
            "-c:v", "h264_videotoolbox",
            "-profile:v", "high",
            "-b:v", v_bitrate,
            "-pix_fmt", "yuv420p",
            "-g", "60",
            "-c:a", "aac",
            "-b:a", a_bitrate,
            "-ar", "48000",
            "-movflags", "+faststart",
            str(out_path),
        ]
        t0 = time.time()
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Videotoolbox failed, falling back to libx264: {res.stderr}")
            cmd = [
                "/opt/homebrew/bin/ffmpeg",
                "-y",
                "-i", str(SOURCE_PATH),
                "-vf", f"scale={width}:{height}",
                "-c:v", "libx264",
                "-preset", "fast",
                "-profile:v", "high",
                "-level:v", "3.1",
                "-b:v", v_bitrate,
                "-pix_fmt", "yuv420p",
                "-g", "60",
                "-c:a", "aac",
                "-b:a", a_bitrate,
                "-ar", "48000",
                "-movflags", "+faststart",
                str(out_path),
            ]
            subprocess.run(cmd, check=True)

        elapsed = time.time() - t0
        w, h, dur, codec, pix_fmt = probe(out_path)
        size_mb = out_path.stat().st_size / (1024 * 1024)
        print(f"Generated {label} in {elapsed:.1f}s: {w}x{h}, {dur:.2f}s, {size_mb:.1f}MB, {codec}/{pix_fmt}")
        assert w == width and h == height, f"Mismatch: expected {width}x{height}, got {w}x{h}"
        assert abs(dur - source_dur) < 1.0, f"Duration mismatch: {dur} vs {source_dur}"

    # Upload to S3
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    s3 = session.client("s3")

    for filename, label, width, height, _, _ in PROFILES:
        out_path = OUTPUT_DIR / filename
        key = f"streaming/{LESSON_ID}/{ASSET_VERSION}/{filename}"
        print(f"\nUploading {filename} to s3://{BUCKET}/{key}...")
        s3.upload_file(
            str(out_path),
            BUCKET,
            key,
            ExtraArgs={
                "ContentType": "video/mp4",
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
        print(f"Uploaded {key} successfully!")

    # Invalidate CloudFront
    print(f"\nInvalidating CloudFront distribution {DISTRIBUTION_ID}...")
    cf = session.client("cloudfront")
    inv = cf.create_invalidation(
        DistributionId=DISTRIBUTION_ID,
        InvalidationBatch={
            "Paths": {
                "Quantity": 1,
                "Items": [f"/streaming/{LESSON_ID}/*"],
            },
            "CallerReference": f"fix-m2-l1-{int(time.time())}",
        },
    )
    inv_id = inv["Invalidation"]["Id"]
    print(f"Created CloudFront invalidation: {inv_id}")
    print("Done! Modulo 2 Lezione 1 renditions are now properly vertical and fresh.")


if __name__ == "__main__":
    main()
