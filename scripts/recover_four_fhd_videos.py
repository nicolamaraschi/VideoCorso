#!/usr/bin/env python3
"""Recover the four 22 September lessons as browser-compatible H.264 assets.

For every lesson this creates a 1080x1920 master and 720p/480p/360p variants
from the external-drive source, validates each result locally, then replaces
the matching S3 objects.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


BUCKET = "prod-videocorso-content"
PROFILE = "personale"
REGION = "us-east-1"
SOURCE_DIR = Path(
    "/Volumes/Sviluppo/Chiara Morocutti/"
    "NUOVI_VIDEO_SENZA_SILENZI_2026-09-22/"
    "CARTELLA_FINALE_DA_CARICARE_SU_AWS"
)
OUTPUT_DIR = Path("/Volumes/Sviluppo/Chiara Morocutti/RENDITIONS_TEMP/RECOVERED_FHD_CORRECTED_2026-09-22")

LESSONS = (
    ("b6a2ef5b-9a5c-4eb5-8c29-692e61d0e0f2", "c468a00aa42b473c93f9523648ff05cf", "Modulo 4 - 1 Strumenti per la forma (agent aws questo video solo devi caricare di sta cartella).mp4"),
    ("8f72378d-5de8-49f8-be47-6522163387ec", "d4916a0b2e41445586cb3280752ecaab", "Modulo 4 - 2 Affilare la matita (agent aws questo video solo devi caricare di sta cartella).mp4"),
    ("2af87613-429f-4365-af79-bbd63ce87384", "832f6b81a0814048a759768517da3095", "Modulo 7 - 1 Strumenti di lavoro (agent aws questo video solo devi caricare di sta cartella).mp4"),
    ("6e556b7d-8332-4d71-89fe-7aebc586a788", "c1f954c077ed4aea8e27de91ba3bab74", "Modulo 9 - 7 Registrazione di una chiamata di vendita (agent aws questo video solo devi caricare di sta cartella).mp4"),
)

SOURCE_OVERRIDES = {
    "6e556b7d-8332-4d71-89fe-7aebc586a788": Path(
        "/Volumes/Sviluppo/Chiara Morocutti/Modulo 9 Consulenza/"
        "7 Registrazione di una chiamata di vendita/IMG_5069.MOV"
    ),
}

PROFILES = (
    ("source.mp4", "master", 1080, 1920, "4500k", "128k"),
    ("source_720p.mp4", "720p", 720, 1280, "2000k", "96k"),
    ("source_480p.mp4", "480p", 480, 854, "1000k", "80k"),
    ("source_360p.mp4", "360p", 360, 640, "650k", "64k"),
)


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def probe(path: Path) -> tuple[int, int, float]:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height:format=duration", "-of", "json", str(path)],
        text=True,
    )
    data = json.loads(raw)
    video = next(stream for stream in data["streams"] if stream.get("codec_name") == "h264")
    return int(video["width"]), int(video["height"]), float(data["format"]["duration"])


def main() -> int:
    only_lesson = os.environ.get("ONLY_LESSON")
    for index, (lesson_id, asset_version, filename) in enumerate(LESSONS, 1):
        if only_lesson and lesson_id != only_lesson:
            continue
        source = SOURCE_OVERRIDES.get(lesson_id, SOURCE_DIR / filename)
        if not source.is_file():
            raise FileNotFoundError(source)
        output = OUTPUT_DIR / lesson_id
        output.mkdir(parents=True, exist_ok=True)
        files = [output / name for name, *_ in PROFILES]
        if any(path.exists() for path in files):
            raise FileExistsError(f"Output already exists for {lesson_id}: {output}")

        print(f"[{index}/4] Encoding {filename}", flush=True)
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "fatal", "-nostats", "-progress", "pipe:1",
            "-noautorotate",
            "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld",
            "-i", str(source),
            "-filter_complex",
            "[0:v]split=4[v1080in][v720in][v480in][v360in];"
            "[v1080in]transpose_vt=dir=clock,scale_vt=w=1080:h=1920[v1080];"
            "[v720in]transpose_vt=dir=clock,scale_vt=w=720:h=1280[v720];"
            "[v480in]transpose_vt=dir=clock,scale_vt=w=480:h=854[v480];"
            "[v360in]transpose_vt=dir=clock,scale_vt=w=360:h=640[v360]",
        ]
        for (name, label, _width, _height, video_rate, audio_rate), path in zip(PROFILES, files):
            command.extend([
                "-map", f"[v{1080 if label == 'master' else label.removesuffix('p')}]", "-map", "0:a:0?",
                "-c:v", "h264_videotoolbox", "-profile:v", "high", "-b:v", video_rate, "-g", "60",
                "-c:a", "aac", "-b:a", audio_rate, "-ar", "48000", "-movflags", "+faststart", str(path),
            ])

        process = subprocess.Popen(command, stdout=subprocess.PIPE, text=True, bufsize=1)
        for line in process.stdout:
            if line.startswith("out_time_ms="):
                print(f"  {line.strip()}", flush=True)
        if process.wait() != 0:
            raise RuntimeError(f"Encoding failed for {filename}")

        source_duration = float(json.loads(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(source)], text=True
        ))["format"]["duration"])
        for (name, label, width, height, _video_rate, _audio_rate), path in zip(PROFILES, files):
            actual_width, actual_height, duration = probe(path)
            if (actual_width, actual_height) != (width, height) or abs(duration - source_duration) > 1:
                raise RuntimeError(f"Validation failed for {path}: {actual_width}x{actual_height}, {duration}s")
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "null", "-"])
            print(f"  Validated {label}: {actual_width}x{actual_height}, {duration:.1f}s", flush=True)

        for (name, label, _width, _height, _video_rate, _audio_rate), path in zip(PROFILES, files):
            key = f"videos/{lesson_id}/{asset_version}/{name}" if label == "master" else f"streaming/{lesson_id}/{asset_version}/{name}"
            print(f"  Uploading {key}", flush=True)
            run([
                "aws", "s3", "cp", str(path), f"s3://{BUCKET}/{key}",
                "--content-type", "video/mp4", "--cache-control", "no-cache",
                "--profile", PROFILE, "--region", REGION,
            ])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
