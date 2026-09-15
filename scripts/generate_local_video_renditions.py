#!/usr/bin/env python3
"""Generate cost-free MP4 lesson renditions using the local ffmpeg binary.

This script never connects to AWS, uploads files, or deletes the source. It is
safe to run against the external SSD and produces progressive-download MP4s
that the existing player/backend already understand.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


PROFILES = (
    ("1080p", 1080, 21, "5500k", "11000k", "128k"),
    ("720p", 720, 22, "2800k", "5600k", "96k"),
    ("480p", 480, 23, "1400k", "2800k", "96k"),
    ("360p", 360, 24, "850k", "1700k", "64k"),
)


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def probe(path: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration,size:stream=codec_type,width,height,r_frame_rate",
            "-of", "json", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def video_stream(metadata: dict) -> dict:
    return next(stream for stream in metadata["streams"] if stream.get("codec_type") == "video")


def fps_value(rate: str) -> float:
    numerator, denominator = rate.split("/", 1)
    return float(numerator) / float(denominator or 1)


def generate(source: Path, destination_root: Path, overwrite: bool) -> dict:
    metadata = probe(source)
    stream = video_stream(metadata)
    width = int(stream["width"])
    height = int(stream["height"])
    portrait = height > width
    short_side = min(width, height)
    source_duration = float(metadata["format"]["duration"])
    source_size = int(metadata["format"]["size"])
    source_fps = fps_value(stream.get("r_frame_rate", "30/1"))

    destination = destination_root / source.stem
    destination.mkdir(parents=True, exist_ok=True)
    outputs: list[dict] = []

    for label, target, crf, maxrate, bufsize, audio_rate in PROFILES:
        if target > short_side:
            continue
        output = destination / f"source_{label}.mp4"
        if output.exists() and not overwrite:
            raise FileExistsError(f"Output already exists: {output}; use --overwrite to replace it")

        scale = f"scale={target}:-2" if portrait else f"scale=-2:{target}"
        filters = [scale]
        if source_fps > 30.5:
            filters.append("fps=30")

        run([
            "ffmpeg", "-hide_banner", "-y" if overwrite else "-n",
            "-i", str(source),
            "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", ",".join(filters),
            "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
            "-maxrate", maxrate, "-bufsize", bufsize,
            "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-c:a", "aac", "-b:a", audio_rate, "-ar", "48000",
            "-movflags", "+faststart", str(output),
        ])

        output_metadata = probe(output)
        output_duration = float(output_metadata["format"]["duration"])
        if abs(output_duration - source_duration) > 1.0:
            raise RuntimeError(f"Duration mismatch for {output}: {output_duration} vs {source_duration}")
        output_size = int(output_metadata["format"]["size"])
        outputs.append({
            "quality": label,
            "path": str(output),
            "bytes": output_size,
            "duration_seconds": output_duration,
        })

    total_size = sum(item["bytes"] for item in outputs)
    report = {
        "source": str(source),
        "source_bytes": source_size,
        "source_duration_seconds": source_duration,
        "outputs": outputs,
        "outputs_total_bytes": total_size,
        "storage_change_percent": round((total_size / source_size - 1) * 100, 2),
        "safe_to_replace_cloud_copy": total_size < source_size,
    }
    report_path = destination / "renditions-report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path, help="Local source MP4 files")
    parser.add_argument("--output-dir", type=Path, required=True, help="Destination on local disk")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    for source in args.inputs:
        if not source.is_file():
            parser.error(f"Source not found: {source}")
        report = generate(source.resolve(), args.output_dir.resolve(), args.overwrite)
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
