"""Validate and concatenate Luna E01 v2 while preserving FLUX audio packets.

The ten inputs are complete FLUX text-to-video clips. This script never creates,
replaces, mixes, normalizes, or re-encodes their audio. It uses FFmpeg's concat
demuxer with ``-c copy`` and verifies that the concatenated-input and final-master
audio packet hashes are identical.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = ROOT / "tools/playveo/luna-e01/production-v2-3d-audio.manifest.json"
OUTPUT_ROOT = ROOT / "assets/episodes/luna-e01-picture-and-thing-v2-3d-audio"
STATE_PATH = OUTPUT_ROOT / "_production-state.json"
CLIP_DIR = OUTPUT_ROOT / "clips"
QC_DIR = OUTPUT_ROOT / "qc"
CONTACT_SHEET = QC_DIR / "clips-contact-sheet.jpg"
CLIP_QC_REPORT = QC_DIR / "clips-qc-report.json"
REPORT_PATH = QC_DIR / "final-qc-report.json"
CONCAT_LIST = QC_DIR / "concat-list.txt"
FINAL_MASTER = OUTPUT_ROOT / "luna-e01-picture-and-thing-v2-3d-audio-final.mp4"
TEMP_MASTER = OUTPUT_ROOT / "_finalizing.mp4"
FFMPEG = Path(imageio_ffmpeg.get_ffmpeg_exe())

THUMB_W = 320
THUMB_H = 180
FRAMES_PER_SCENE = 3
LABEL_H = 30
GAP = 12
SHEET_COLUMNS = 5
BACKGROUND = (10, 15, 36)
AUDIO_SAMPLE_RATE = 16_000


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_approved_clip_review(manifest: dict, scenes: list[dict]) -> dict:
    if not STATE_PATH.exists():
        raise RuntimeError("Production state is missing; approve clips before finalization")
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    if state.get("production_id") != manifest.get("production_id"):
        raise RuntimeError("Production state belongs to a different production_id")

    manifest_pack = manifest.get("visual_identity", {}).get("reference_pack_sha256")
    state_pack = state.get("visual_identity", {}).get("reference_pack_sha256")
    if not manifest_pack or state_pack != manifest_pack:
        raise RuntimeError("Production state visual identity does not match the current reference pack")

    review = state.get("review", {}).get("clips", {})
    if review.get("status") != "approved":
        raise RuntimeError("Clip review is not approved; run --approve-clips after visual and auditory review")
    fingerprint = review.get("fingerprint")
    if not isinstance(fingerprint, list):
        raise RuntimeError("Approved clip review has no immutable fingerprint")

    approved_hashes: dict[str, str] = {}
    for item in fingerprint:
        if not isinstance(item, dict) or not item.get("scene_id") or not item.get("sha256"):
            raise RuntimeError("Approved clip review contains an invalid fingerprint entry")
        scene_id = str(item["scene_id"])
        if scene_id in approved_hashes:
            raise RuntimeError(f"Approved clip review duplicates scene {scene_id}")
        approved_hashes[scene_id] = str(item["sha256"])

    expected_ids = {str(scene["id"]) for scene in scenes}
    if set(approved_hashes) != expected_ids:
        raise RuntimeError("Approved clip review does not cover the current scene set exactly")
    for scene in scenes:
        clip = OUTPUT_ROOT / str(scene["file"])
        if not clip.exists() or not clip.is_file():
            raise RuntimeError(f"Approved clip is missing: {scene['file']}")
        actual_hash = sha256_file(clip)
        if approved_hashes[str(scene["id"])] != actual_hash:
            raise RuntimeError(f"Clip changed after human approval: {scene['id']}")

    return {
        "status": "approved",
        "approved_at": review.get("approved_at"),
        "basis": review.get("basis"),
        "reference_pack_sha256": manifest_pack,
        "fingerprint": fingerprint,
    }


def run(command: list[str], *, binary: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=not binary,
    )


def frame_at(capture: cv2.VideoCapture, frame_index: int) -> tuple[Image.Image, np.ndarray]:
    capture.set(cv2.CAP_PROP_POS_FRAMES, max(0, frame_index))
    ok, frame = capture.read()
    if not ok or frame is None:
        raise RuntimeError(f"Could not decode frame {frame_index}")
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    thumbnail = Image.fromarray(rgb).resize((THUMB_W, THUMB_H), Image.Resampling.LANCZOS)
    analysis = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 90))
    return thumbnail, analysis


def decode_audio_pcm(path: Path) -> bytes:
    result = run(
        [
            str(FFMPEG),
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(AUDIO_SAMPLE_RATE),
            "-f",
            "s16le",
            "pipe:1",
        ],
        binary=True,
    )
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Could not decode audio from {path.name}: {error}")
    return result.stdout


def audio_metrics(pcm: bytes) -> dict:
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float64)
    if samples.size == 0:
        return {
            "decoded_duration_seconds": 0.0,
            "mean_dbfs": -120.0,
            "peak_dbfs": -120.0,
            "active_window_ratio": 0.0,
            "pcm_sha256": sha256_bytes(pcm),
        }
    normalized = samples / 32768.0
    rms = float(np.sqrt(np.mean(np.square(normalized))))
    peak = float(np.max(np.abs(normalized)))
    window_size = int(AUDIO_SAMPLE_RATE * 0.1)
    window_count = samples.size // window_size
    if window_count:
        windows = normalized[: window_count * window_size].reshape(window_count, window_size)
        window_rms = np.sqrt(np.mean(np.square(windows), axis=1))
        active_ratio = float(np.mean(window_rms > 10 ** (-45 / 20)))
    else:
        active_ratio = 0.0
    return {
        "decoded_duration_seconds": round(samples.size / AUDIO_SAMPLE_RATE, 4),
        "mean_dbfs": round(20 * math.log10(max(rms, 1e-6)), 2),
        "peak_dbfs": round(20 * math.log10(max(peak, 1e-6)), 2),
        "active_window_ratio": round(active_ratio, 4),
        "pcm_sha256": sha256_bytes(pcm),
    }


def inspect_clip(scene: dict) -> tuple[dict, list[Image.Image]]:
    scene_id = scene["id"]
    path = CLIP_DIR / f"{scene_id}.mp4"
    if not path.exists():
        raise RuntimeError(f"Missing {path.relative_to(ROOT)}")

    data = path.read_bytes()
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"OpenCV could not open {path.relative_to(ROOT)}")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0.0

    positions = (0.15, 0.50, 0.85)
    frames: list[Image.Image] = []
    analysis_frames: list[np.ndarray] = []
    for position in positions:
        image, analysis = frame_at(capture, min(frame_count - 1, int(frame_count * position)))
        frames.append(image)
        analysis_frames.append(analysis)
    capture.release()

    differences = [
        float(np.mean(cv2.absdiff(analysis_frames[index], analysis_frames[index + 1])))
        for index in range(len(analysis_frames) - 1)
    ]
    motion_score = float(np.mean(differences))
    average_luma = float(np.mean(analysis_frames))
    pcm = decode_audio_pcm(path)
    audio = audio_metrics(pcm)
    expected = float(scene["duration_seconds"])
    duration_error = duration - expected
    aspect_ratio = width / height if height else 0.0
    has_ftyp = b"ftyp" in data[:128]
    has_video_track = b"vide" in data
    has_audio_track = b"soun" in data
    structural_ok = (
        len(data) > 10_000
        and has_ftyp
        and has_video_track
        and has_audio_track
        and width > 0
        and height > 0
        and fps > 0
        and frame_count > 0
        and abs(aspect_ratio - (16 / 9)) <= 0.06
        and abs(duration_error) <= 1.0
    )
    motion_ok = motion_score >= 0.35
    audio_ok = (
        audio["decoded_duration_seconds"] >= expected - 1.5
        and audio["peak_dbfs"] > -45.0
        and audio["active_window_ratio"] >= 0.02
    )
    record = {
        "scene": scene_id,
        "file": path.relative_to(ROOT).as_posix(),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "width": width,
        "height": height,
        "aspect_ratio": round(aspect_ratio, 5),
        "fps": round(fps, 4),
        "frame_count": frame_count,
        "expected_duration_seconds": expected,
        "measured_video_duration_seconds": round(duration, 4),
        "duration_error_seconds": round(duration_error, 4),
        "has_ftyp": has_ftyp,
        "has_video_track": has_video_track,
        "has_audio_track": has_audio_track,
        "motion_score": round(motion_score, 4),
        "average_luma": round(average_luma, 2),
        "audio": audio,
        "structural_ok": structural_ok,
        "motion_ok": motion_ok,
        "audio_signal_ok": audio_ok,
        "ok": structural_ok and motion_ok and audio_ok,
    }
    return record, frames


def create_contact_sheet(rows: list[tuple[dict, list[Image.Image]]]) -> None:
    cell_width = THUMB_W
    cell_height = THUMB_H * FRAMES_PER_SCENE + LABEL_H
    rows_count = math.ceil(len(rows) / SHEET_COLUMNS)
    sheet_width = SHEET_COLUMNS * cell_width + (SHEET_COLUMNS + 1) * GAP
    sheet_height = rows_count * cell_height + (rows_count + 1) * GAP
    sheet = Image.new("RGB", (sheet_width, sheet_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, (record, frames) in enumerate(rows):
        column = index % SHEET_COLUMNS
        row = index // SHEET_COLUMNS
        x = GAP + column * (cell_width + GAP)
        y = GAP + row * (cell_height + GAP)
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (x, y + frame_index * THUMB_H))
        label_y = y + FRAMES_PER_SCENE * THUMB_H
        draw.rectangle((x, label_y, x + cell_width, label_y + LABEL_H), fill=(24, 37, 102))
        draw.text(
            (x + 7, label_y + 7),
            f"{record['scene']}  motion={record['motion_score']:.1f}  audio={record['audio']['mean_dbfs']:.1f}dB",
            fill=(245, 247, 255),
        )
    QC_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, "JPEG", quality=92, subsampling=0, optimize=True)


def inspect_clips(scenes: list[dict]) -> tuple[list[tuple[dict, list[Image.Image]]], list[dict]]:
    rows = [inspect_clip(scene) for scene in scenes]
    records = [row[0] for row in rows]
    failures = [record["scene"] for record in records if not record["ok"]]
    if failures:
        raise RuntimeError(f"Clip QC failed: {', '.join(failures)}")
    if len({record["sha256"] for record in records}) != len(records):
        raise RuntimeError("Duplicate MP4 hashes detected")
    return rows, records


def verify_local_clips_against_state(manifest: dict, scenes: list[dict], records: list[dict]) -> dict:
    if not STATE_PATH.exists():
        raise RuntimeError("Production state is missing")
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    if state.get("production_id") != manifest.get("production_id"):
        raise RuntimeError("Production state belongs to a different production_id")

    manifest_pack = manifest.get("visual_identity", {}).get("reference_pack_sha256")
    state_pack = state.get("visual_identity", {}).get("reference_pack_sha256")
    if not manifest_pack or state_pack != manifest_pack:
        raise RuntimeError("Production state visual identity does not match the current reference pack")

    state_jobs: dict[str, dict] = {}
    for job in state.get("jobs", []):
        if not isinstance(job, dict) or not job.get("scene_id"):
            raise RuntimeError("Production state contains an invalid job entry")
        scene_id = str(job["scene_id"])
        if scene_id in state_jobs:
            raise RuntimeError(f"Production state duplicates scene {scene_id}")
        state_jobs[scene_id] = job

    expected_ids = {str(scene["id"]) for scene in scenes}
    if set(state_jobs) != expected_ids:
        raise RuntimeError("Production state does not cover the current scene set exactly")
    records_by_scene = {str(record["scene"]): record for record in records}

    for scene in scenes:
        scene_id = str(scene["id"])
        job = state_jobs[scene_id]
        record = records_by_scene[scene_id]
        media = job.get("media")
        if job.get("status") != "completed" or not isinstance(media, dict) or not media.get("ok"):
            raise RuntimeError(f"Production state does not mark {scene_id} as a completed validated clip")
        if not media.get("has_video_track") or not media.get("has_audio_track"):
            raise RuntimeError(f"Production state lacks video-plus-audio validation for {scene_id}")
        if str(job.get("output_file", "")).replace("\\", "/") != str(scene["file"]).replace("\\", "/"):
            raise RuntimeError(f"Production state output path differs from the manifest for {scene_id}")
        if media.get("sha256") != record["sha256"]:
            raise RuntimeError(f"Local clip hash differs from production state for {scene_id}")
        if int(media.get("bytes", -1)) != record["bytes"]:
            raise RuntimeError(f"Local clip size differs from production state for {scene_id}")

    review = state.get("review", {}).get("clips", {})
    return {
        "state_updated_at": state.get("updated_at"),
        "review_status": review.get("status", "pending"),
        "reference_pack_sha256": manifest_pack,
        "state_fingerprint_matches_local_files": True,
        "local_fingerprint": [
            {"scene_id": record["scene"], "sha256": record["sha256"]}
            for record in sorted(records, key=lambda item: item["scene"])
        ],
    }


def write_clip_qc_report(
    manifest: dict,
    scenes: list[dict],
    records: list[dict],
    state_context: dict,
) -> dict:
    measured_total = sum(record["measured_video_duration_seconds"] for record in records)
    version = run([str(FFMPEG), "-version"]).stdout.splitlines()[0]
    report = {
        "schema_version": 1,
        "report_type": "offline_clip_structural_qc",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "production_id": manifest["production_id"],
        "ffmpeg": version,
        "clip_count": len(records),
        "expected_script_seconds": manifest["execution"]["expected_total_seconds"],
        "measured_clip_total_seconds": round(measured_total, 4),
        "unique_clip_sha256_count": len({record["sha256"] for record in records}),
        "all_clips_structural_motion_audio_signal_ok": all(record["ok"] for record in records),
        "production_state": state_context,
        "execution_guards": {
            "offline_only": True,
            "provider_requests_sent": False,
            "provider_submissions_sent": False,
            "production_state_modified": False,
            "review_status_modified": False,
            "concat_or_final_master_modified": False,
        },
        "model_audio_policy": {
            "source": "FLUX text-to-video audio embedded in each generated scene",
            "external_tts_used": False,
            "external_dubbing_used": False,
            "semantic_dialogue_note": "Automatic QC proves a decodable active audio signal. Exact Arabic wording, timing, pronunciation, speaker identity, and mix still require human listening.",
        },
        "human_review": {
            "status": state_context["review_status"],
            "required_before_approval": state_context["review_status"] != "approved",
            "automated_qc_is_not_human_approval": True,
            "release_gate_open": False,
            "queue": [
                {
                    "scene": scene["id"],
                    "file": str(scene["file"]),
                    "expected_timeline": list(scene.get("timeline", [])),
                    "visual_decision": "pending",
                    "audio_decision": "pending",
                }
                for scene in scenes
            ],
        },
        "contact_sheet": CONTACT_SHEET.relative_to(ROOT).as_posix(),
        "clips": records,
        "all_automated_checks_ok": all(record["ok"] for record in records),
    }
    QC_DIR.mkdir(parents=True, exist_ok=True)
    CLIP_QC_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def print_clip_qc(records: list[dict]) -> None:
    for record in records:
        print(
            f"{record['scene']} {record['width']}x{record['height']} {record['fps']}fps "
            f"{record['measured_video_duration_seconds']}s motion={record['motion_score']} "
            f"audio={record['audio']['mean_dbfs']}dB active={record['audio']['active_window_ratio']} ok={record['ok']}"
        )
    measured_total = sum(record["measured_video_duration_seconds"] for record in records)
    print(f"clips total={measured_total:.4f}s unique={len({record['sha256'] for record in records})}/{len(records)}")


def concat_line(path: Path) -> str:
    normalized = path.resolve().as_posix().replace("'", "'\\''")
    return f"file '{normalized}'"


def write_concat_list(scenes: list[dict]) -> None:
    QC_DIR.mkdir(parents=True, exist_ok=True)
    lines = [concat_line(CLIP_DIR / f"{scene['id']}.mp4") for scene in scenes]
    CONCAT_LIST.write_text("\n".join(lines) + "\n", encoding="utf-8")


def stream_hash(input_args: list[str], stream: str, codec: str) -> str:
    command = [
        str(FFMPEG),
        "-v",
        "error",
        *input_args,
        "-map",
        stream,
    ]
    if codec == "rawvideo":
        command.extend(["-an", "-c:v", "rawvideo", "-pix_fmt", "yuv420p"])
    else:
        command.extend(["-c", codec])
    command.extend(["-f", "hash", "-hash", "sha256", "pipe:1"])
    result = run(command)
    if result.returncode != 0:
        raise RuntimeError(f"Could not hash {codec} stream: {result.stderr.strip()}")
    value = result.stdout.strip()
    if not value.startswith("SHA256="):
        raise RuntimeError(f"Unexpected FFmpeg hash output: {value}")
    return value.removeprefix("SHA256=").lower()


def merge_stream_copy() -> dict:
    if TEMP_MASTER.exists():
        TEMP_MASTER.unlink()
    command = [
        str(FFMPEG),
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(CONCAT_LIST),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(TEMP_MASTER),
    ]
    result = run(command)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg stream-copy concat failed: {result.stderr.strip()}")
    if not TEMP_MASTER.exists() or TEMP_MASTER.stat().st_size <= 10_000:
        raise RuntimeError("FFmpeg produced no valid temporary master")

    concat_input = ["-f", "concat", "-safe", "0", "-i", str(CONCAT_LIST)]
    final_input = ["-i", str(TEMP_MASTER)]
    source_audio_hash = stream_hash(concat_input, "0:a:0", "copy")
    final_audio_hash = stream_hash(final_input, "0:a:0", "copy")
    source_video_packet_hash = stream_hash(concat_input, "0:v:0", "copy")
    final_video_packet_hash = stream_hash(final_input, "0:v:0", "copy")
    source_decoded_video_hash = stream_hash(concat_input, "0:v:0", "rawvideo")
    final_decoded_video_hash = stream_hash(final_input, "0:v:0", "rawvideo")
    if source_audio_hash != final_audio_hash:
        raise RuntimeError("Final audio packet hash differs from concatenated FLUX source audio")
    if source_decoded_video_hash != final_decoded_video_hash:
        raise RuntimeError("Final decoded video differs from concatenated FLUX source frames")

    os.replace(TEMP_MASTER, FINAL_MASTER)
    return {
        "mode": "ffmpeg_concat_demuxer_stream_copy",
        "video_codec_action": "copy",
        "audio_codec_action": "copy",
        "external_voice_or_audio_added": False,
        "source_audio_packet_sha256": source_audio_hash,
        "final_audio_packet_sha256": final_audio_hash,
        "audio_packet_hash_match": True,
        "source_video_packet_sha256": source_video_packet_hash,
        "final_video_packet_sha256": final_video_packet_hash,
        "video_packet_hash_match": source_video_packet_hash == final_video_packet_hash,
        "video_packet_hash_note": "MP4 remuxing can normalize codec headers even with -c copy; decoded-frame hashes are the visual identity gate.",
        "source_decoded_video_sha256": source_decoded_video_hash,
        "final_decoded_video_sha256": final_decoded_video_hash,
        "decoded_video_hash_match": True,
    }


def inspect_master(expected_duration: float) -> dict:
    capture = cv2.VideoCapture(str(FINAL_MASTER))
    if not capture.isOpened():
        raise RuntimeError("OpenCV could not decode the final master")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    capture.release()
    duration = frame_count / fps if fps > 0 else 0.0
    data = FINAL_MASTER.read_bytes()
    audio = audio_metrics(decode_audio_pcm(FINAL_MASTER))
    ok = (
        len(data) > 10_000
        and b"ftyp" in data[:128]
        and b"vide" in data
        and b"soun" in data
        and width > 0
        and height > 0
        and fps > 0
        and frame_count > 0
        and abs(duration - expected_duration) <= 2.0
        and abs(audio["decoded_duration_seconds"] - expected_duration) <= 2.0
        and audio["active_window_ratio"] >= 0.02
    )
    return {
        "file": FINAL_MASTER.relative_to(ROOT).as_posix(),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "width": width,
        "height": height,
        "fps": round(fps, 4),
        "frame_count": frame_count,
        "measured_video_duration_seconds": round(duration, 4),
        "audio": audio,
        "has_video_track": b"vide" in data,
        "has_audio_track": b"soun" in data,
        "ok": ok,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run offline Luna v2 clip QC, or finalize an already human-approved clip set."
    )
    parser.add_argument(
        "--qc-only",
        action="store_true",
        help="Inspect the ten local clips and refresh review artifacts without approval, concat, or final-master changes.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not FFMPEG.exists():
        raise RuntimeError(f"imageio-ffmpeg binary is missing: {FFMPEG}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    scenes = manifest["scenes"]

    if args.qc_only:
        rows, records = inspect_clips(scenes)
        state_context = verify_local_clips_against_state(manifest, scenes, records)
        create_contact_sheet(rows)
        report = write_clip_qc_report(manifest, scenes, records, state_context)
        print_clip_qc(records)
        print(f"contact sheet={CONTACT_SHEET.relative_to(ROOT)}")
        print(f"clip QC report={CLIP_QC_REPORT.relative_to(ROOT)}")
        print(
            f"human review={state_context['review_status']}; "
            "no approval, provider request, concat, or final-master change was performed"
        )
        if not report["all_automated_checks_ok"]:
            raise SystemExit(1)
        return

    clip_review = require_approved_clip_review(manifest, scenes)
    rows, records = inspect_clips(scenes)
    create_contact_sheet(rows)
    write_concat_list(scenes)
    merge = merge_stream_copy()
    measured_total = sum(record["measured_video_duration_seconds"] for record in records)
    master = inspect_master(measured_total)
    if not master["ok"]:
        raise RuntimeError("Final master failed duration, stream, decode, or audio-signal validation")

    version = run([str(FFMPEG), "-version"]).stdout.splitlines()[0]
    report = {
        "production_id": manifest["production_id"],
        "ffmpeg": version,
        "clip_count": len(records),
        "expected_script_seconds": manifest["execution"]["expected_total_seconds"],
        "measured_clip_total_seconds": round(measured_total, 4),
        "unique_clip_sha256_count": len({record["sha256"] for record in records}),
        "all_clips_structural_motion_audio_signal_ok": all(record["ok"] for record in records),
        "visual_review": clip_review,
        "model_audio_policy": {
            "source": "FLUX text-to-video audio embedded in each generated scene",
            "external_tts_used": False,
            "external_dubbing_used": False,
            "music_or_sfx_added_during_montage": False,
            "semantic_dialogue_note": "Automatic QC proves a decodable active audio signal and exact packet preservation. Exact Arabic wording still requires human listening review.",
        },
        "merge": merge,
        "contact_sheet": CONTACT_SHEET.relative_to(ROOT).as_posix(),
        "clips": records,
        "final_master": master,
        "human_clip_review_approved": clip_review["status"] == "approved",
        "all_automated_checks_ok": all(record["ok"] for record in records)
        and merge["audio_packet_hash_match"]
        and merge["decoded_video_hash_match"]
        and master["ok"],
        "all_release_gates_ok": clip_review["status"] == "approved"
        and all(record["ok"] for record in records)
        and merge["audio_packet_hash_match"]
        and merge["decoded_video_hash_match"]
        and master["ok"],
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print_clip_qc(records)
    print(f"audio packet preservation={merge['audio_packet_hash_match']}")
    print(f"decoded video preservation={merge['decoded_video_hash_match']}")
    print(
        f"final={FINAL_MASTER.relative_to(ROOT)} {master['width']}x{master['height']} "
        f"{master['measured_video_duration_seconds']}s audio={master['has_audio_track']} ok={master['ok']}"
    )
    print(f"contact sheet={CONTACT_SHEET.relative_to(ROOT)}")
    print(f"report={REPORT_PATH.relative_to(ROOT)}")
    if not report["all_automated_checks_ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
