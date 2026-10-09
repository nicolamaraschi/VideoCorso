#!/usr/bin/env python3
"""
Process VSL Master Video:
1. Extract high-quality poster frames (WebP & JPG)
2. Transcode into 4 optimized H.264 renditions (1080p, 720p, 480p, 360p)
3. Package into multi-bitrate HLS (master.m3u8 + segments)
4. Upload all assets to S3 under s3://prod-videocorso-content/public/vsl/
5. Invalidate CloudFront distribution E3RGTK4NRBCHH1
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
import boto3
from boto3.s3.transfer import TransferConfig
from PIL import Image

SOURCE_VIDEO = Path("/Users/nicolamaraschi/Downloads/MASTER VSL versione 3.mp4")
WORKSPACE = Path("/Users/nicolamaraschi/Documents/lezioniChiara/VideoCorso")
BUILD_DIR = WORKSPACE / "scripts" / "vsl_build"
MP4_DIR = BUILD_DIR / "mp4"
HLS_DIR = BUILD_DIR / "hls"
POSTER_DIR = BUILD_DIR / "posters"

PROFILE_NAME = "personale"
REGION_NAME = "us-east-1"
BUCKET_NAME = "prod-videocorso-content"
S3_PREFIX = "public/vsl"
CF_DISTRIBUTION_ID = "E3RGTK4NRBCHH1"

# Rendition definitions: (label, target_width, target_height, v_bitrate, maxrate, bufsize, a_bitrate, h264_level, profile)
PROFILES = [
    ("360p", 360, 640, "380k", "480k", "600k", "64k", "3.0", "main", 420000, 380000, 'avc1.4d401e'),
    ("480p", 480, 854, "700k", "900k", "1200k", "80k", "3.1", "main", 800000, 720000, 'avc1.4d401f'),
    ("720p", 720, 1280, "1400k", "1800k", "2400k", "96k", "3.1", "high", 1550000, 1420000, 'avc1.64001f'),
    ("1080p", 1080, 1920, "2600k", "3200k", "4000k", "128k", "4.1", "high", 2850000, 2600000, 'avc1.640028'),
]

TRANSFER_CONFIG = TransferConfig(
    multipart_threshold=10 * 1024 * 1024,
    max_concurrency=10,
    multipart_chunksize=10 * 1024 * 1024,
    use_threads=True,
)

def run_cmd(cmd: list[str], desc: str = ""):
    if desc:
        print(f"--> {desc}...", flush=True)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error running: {' '.join(cmd)}")
        print("STDERR:", res.stderr)
        raise RuntimeError(f"Command failed with exit code {res.returncode}")
    return res.stdout

def probe_file(path: Path) -> dict:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "stream=width,height,codec_name,r_frame_rate:format=duration,size",
        "-of", "json", str(path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)

def extract_posters():
    print("\n=== STEP 1: EXTRACTING POSTER FRAMES ===")
    POSTER_DIR.mkdir(parents=True, exist_ok=True)
    raw_jpg = POSTER_DIR / "poster_raw.jpg"
    final_jpg = POSTER_DIR / "poster.jpg"
    final_webp = POSTER_DIR / "poster.webp"
    
    # Extract at 1.2s where Chiara is speaking and frame is stable
    cmd = [
        "ffmpeg", "-y", "-ss", "00:00:01.200",
        "-i", str(SOURCE_VIDEO),
        "-vframes", "1",
        "-q:v", "2",
        str(raw_jpg)
    ]
    run_cmd(cmd, "Extracting video frame at 1.2s")
    
    img = Image.open(raw_jpg)
    print(f"Original poster size: {img.size}")
    
    # Save optimized JPG
    img.save(final_jpg, "JPEG", quality=90, optimize=True)
    # Save optimized WebP
    img.save(final_webp, "WEBP", quality=88, method=6)
    
    print(f"Poster JPG created: {final_jpg.stat().st_size / 1024:.1f} KB")
    print(f"Poster WebP created: {final_webp.stat().st_size / 1024:.1f} KB")

def transcode_mp4_renditions():
    print("\n=== STEP 2: TRANSCODING MP4 RENDITIONS (Apple Silicon Hardware Accelerated) ===")
    MP4_DIR.mkdir(parents=True, exist_ok=True)
    
    for label, target_w, target_h, v_rate, maxrate, bufsize, a_rate, level, profile, *_ in PROFILES:
        out_file = MP4_DIR / f"vsl_{label}.mp4"
        if out_file.exists() and out_file.stat().st_size > 1000000:
            print(f"  [✓] {out_file.name} already exists ({out_file.stat().st_size / (1024*1024):.1f} MB), skipping transcode.")
            continue
            
        print(f"  [>] Encoding {label} ({target_w}x{target_h} @ {v_rate})...", flush=True)
        scale_vf = f"scale={target_w}:{target_h}"
        
        # 1. Try VideoToolbox hardware encoder
        vt_cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-i", str(SOURCE_VIDEO),
            "-map", "0:v:0", "-map", "0:a:0?",
            "-vf", scale_vf,
            "-c:v", "h264_videotoolbox", "-profile:v", profile, "-level:v", level,
            "-b:v", v_rate, "-maxrate", maxrate, "-bufsize", bufsize,
            "-pix_fmt", "yuv420p", "-tag:v", "avc1",
            "-g", "60", "-keyint_min", "60",
            "-force_key_frames", "expr:gte(t,n_forced*2)",
            "-c:a", "aac", "-b:a", a_rate, "-ar", "48000",
            "-movflags", "+faststart",
            str(out_file)
        ]
        
        start_t = time.time()
        try:
            run_cmd(vt_cmd, f"Running h264_videotoolbox for {label}")
        except Exception as e:
            print(f"    [!] VideoToolbox failed ({e}), falling back to libx264...")
            fallback_cmd = [
                "ffmpeg", "-hide_banner", "-y",
                "-i", str(SOURCE_VIDEO),
                "-map", "0:v:0", "-map", "0:a:0?",
                "-vf", scale_vf,
                "-c:v", "libx264", "-preset", "veryfast",
                "-profile:v", profile, "-level:v", level,
                "-b:v", v_rate, "-maxrate", maxrate, "-bufsize", bufsize,
                "-pix_fmt", "yuv420p", "-tag:v", "avc1",
                "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
                "-force_key_frames", "expr:gte(t,n_forced*2)",
                "-c:a", "aac", "-b:a", a_rate, "-ar", "48000",
                "-movflags", "+faststart",
                str(out_file)
            ]
            run_cmd(fallback_cmd, f"Running libx264 fallback for {label}")
            
        dur = time.time() - start_t
        sz = out_file.stat().st_size / (1024 * 1024)
        print(f"  [✓] {label} completed in {dur:.1f}s -> Size: {sz:.1f} MB", flush=True)

def package_hls():
    print("\n=== STEP 3: PACKAGING HLS WITH 4-SECOND SEGMENTS ===")
    HLS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 1. Package each MP4 stream into HLS without re-encoding (direct copy)
    for label, target_w, target_h, *_ in PROFILES:
        mp4_path = MP4_DIR / f"vsl_{label}.mp4"
        playlist_path = HLS_DIR / f"vsl_{label}.m3u8"
        seg_pattern = str(HLS_DIR / f"vsl_{label}_%03d.ts")
        
        cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-i", str(mp4_path),
            "-c", "copy",
            "-hls_time", "4",
            "-hls_playlist_type", "vod",
            "-hls_list_size", "0",
            "-hls_segment_filename", seg_pattern,
            str(playlist_path)
        ]
        run_cmd(cmd, f"Packaging HLS playlist and segments for {label}")
        print(f"  [✓] HLS {label} packaged ({playlist_path.name})")

    # 2. Write master.m3u8
    master_path = HLS_DIR / "master.m3u8"
    master_content = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
    ]
    
    for label, target_w, target_h, _, _, _, _, _, _, peak_bw, avg_bw, codecs in PROFILES:
        stream_inf = (
            f'#EXT-X-STREAM-INF:BANDWIDTH={peak_bw},AVERAGE-BANDWIDTH={avg_bw},'
            f'RESOLUTION={target_w}x{target_h},FRAME-RATE=30.000,CODECS="{codecs}",NAME="{label}"'
        )
        master_content.append(stream_inf)
        master_content.append(f"vsl_{label}.m3u8")
        
    with open(master_path, "w", encoding="utf-8") as f:
        f.write("\n".join(master_content) + "\n")
    print(f"  [✓] master.m3u8 created successfully with {len(PROFILES)} streams.")

def upload_to_s3():
    print("\n=== STEP 4: UPLOADING ASSETS TO AWS S3 ===")
    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    s3 = session.client("s3")
    
    files_to_upload = []
    
    # Posters
    files_to_upload.append((POSTER_DIR / "poster.jpg", f"{S3_PREFIX}/poster.jpg", "image/jpeg", "public, max-age=31536000, immutable"))
    files_to_upload.append((POSTER_DIR / "poster.webp", f"{S3_PREFIX}/poster.webp", "image/webp", "public, max-age=31536000, immutable"))
    
    # MP4s
    for label, *_ in PROFILES:
        mp4_path = MP4_DIR / f"vsl_{label}.mp4"
        files_to_upload.append((mp4_path, f"{S3_PREFIX}/vsl_{label}.mp4", "video/mp4", "public, max-age=31536000, immutable"))
        
    # HLS Master and child playlists
    files_to_upload.append((HLS_DIR / "master.m3u8", f"{S3_PREFIX}/master.m3u8", "application/vnd.apple.mpegurl", "public, max-age=300, must-revalidate"))
    for label, *_ in PROFILES:
        files_to_upload.append((HLS_DIR / f"vsl_{label}.m3u8", f"{S3_PREFIX}/vsl_{label}.m3u8", "application/vnd.apple.mpegurl", "public, max-age=300, must-revalidate"))
        
    # HLS TS segments
    for ts_file in HLS_DIR.glob("*.ts"):
        files_to_upload.append((ts_file, f"{S3_PREFIX}/{ts_file.name}", "video/MP2T", "public, max-age=31536000, immutable"))
        
    print(f"Total files to upload: {len(files_to_upload)} files")
    
    total_bytes = sum(f[0].stat().st_size for f in files_to_upload)
    print(f"Total upload size: {total_bytes / (1024*1024):.1f} MB")
    
    uploaded_count = 0
    for local_path, s3_key, content_type, cache_control in files_to_upload:
        sz_kb = local_path.stat().st_size / 1024
        extra_args = {
            "ContentType": content_type,
            "CacheControl": cache_control,
        }
        s3.upload_file(
            Filename=str(local_path),
            Bucket=BUCKET_NAME,
            Key=s3_key,
            ExtraArgs=extra_args,
            Config=TRANSFER_CONFIG
        )
        uploaded_count += 1
        if uploaded_count % 25 == 0 or uploaded_count == len(files_to_upload):
            print(f"  Uploaded {uploaded_count}/{len(files_to_upload)} ({local_path.name} - {sz_kb:.0f} KB)...", flush=True)
            
    print("  [✓] All assets uploaded to S3 successfully!")

def invalidate_cloudfront():
    print("\n=== STEP 5: INVALIDATING CLOUDFRONT CACHE ===")
    session = boto3.Session(profile_name=PROFILE_NAME, region_name=REGION_NAME)
    cf = session.client("cloudfront")
    
    invalidation_paths = [
        f"/{S3_PREFIX}/*"
    ]
    caller_ref = f"vsl-deploy-{int(time.time())}"
    
    res = cf.create_invalidation(
        DistributionId=CF_DISTRIBUTION_ID,
        InvalidationBatch={
            "Paths": {
                "Quantity": len(invalidation_paths),
                "Items": invalidation_paths
            },
            "CallerReference": caller_ref
        }
    )
    inv_id = res["Invalidation"]["Id"]
    print(f"  [✓] CloudFront invalidation created: {inv_id} for path /{S3_PREFIX}/*")

def main():
    if not SOURCE_VIDEO.exists():
        print(f"Error: Source video not found at {SOURCE_VIDEO}")
        sys.exit(1)
        
    extract_posters()
    transcode_mp4_renditions()
    package_hls()
    upload_to_s3()
    invalidate_cloudfront()
    print("\n=== SUCCESS: PIPELINE FINISHED ===")

if __name__ == "__main__":
    main()
