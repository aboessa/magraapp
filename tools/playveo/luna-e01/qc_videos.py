"""Structural and visual QC for the ten FLUX clips of Luna E01."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cv2
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = ROOT / "tools/playveo/luna-e01/production.manifest.json"
VIDEO_DIR = ROOT / "assets/episodes/luna-e01-picture-and-thing/videos"
QC_DIR = ROOT / "assets/episodes/luna-e01-picture-and-thing/qc"
CONTACT_SHEET = QC_DIR / "videos-contact-sheet.jpg"
REPORT_PATH = QC_DIR / "videos-qc-report.json"

THUMB_W = 448
THUMB_H = 252
CELL_H = THUMB_H * 2 + 34
GAP = 14
BACKGROUND = (11, 16, 38)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frame_at(capture: cv2.VideoCapture, frame_index: int) -> Image.Image:
    capture.set(cv2.CAP_PROP_POS_FRAMES, max(0, frame_index))
    ok, frame = capture.read()
    if not ok or frame is None:
        raise RuntimeError(f"Could not decode frame {frame_index}")
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb).resize((THUMB_W, THUMB_H), Image.Resampling.LANCZOS)


def inspect(scene: dict) -> tuple[dict, Image.Image, Image.Image]:
    scene_id = scene["id"]
    expected_duration = float(scene["duration_seconds"])
    path = VIDEO_DIR / f"{scene_id}.mp4"
    if not path.exists():
        raise RuntimeError(f"Missing {path.relative_to(ROOT)}")

    data = path.read_bytes()
    prefix = data[:64].decode("latin1", errors="ignore")
    binary = data.decode("latin1", errors="ignore")
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"OpenCV could not open {path.relative_to(ROOT)}")

    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0.0
    early = frame_at(capture, min(frame_count - 1, max(0, int(fps * 0.5))))
    middle = frame_at(capture, min(frame_count - 1, max(0, int(frame_count * 0.65))))
    capture.release()

    duration_error = duration - expected_duration
    has_ftyp = "ftyp" in prefix
    has_video_track = "vide" in binary
    has_audio_track = "soun" in binary
    ok = (
        len(data) > 10_000
        and has_ftyp
        and has_video_track
        and has_audio_track
        and width > 0
        and height > 0
        and fps > 0
        and frame_count > 0
        and abs(duration_error) <= 1.0
    )
    return (
        {
            "scene": scene_id,
            "file": path.relative_to(ROOT).as_posix(),
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "width": width,
            "height": height,
            "fps": round(fps, 4),
            "frame_count": frame_count,
            "expected_duration_seconds": expected_duration,
            "measured_duration_seconds": round(duration, 4),
            "duration_error_seconds": round(duration_error, 4),
            "has_ftyp": has_ftyp,
            "has_video_track": has_video_track,
            "has_audio_track": has_audio_track,
            "ok": ok,
        },
        early,
        middle,
    )


def contact_sheet(rows: list[tuple[dict, Image.Image, Image.Image]]) -> None:
    width = THUMB_W * 5 + GAP * 6
    height = CELL_H * 2 + GAP * 3
    sheet = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, (record, early, middle) in enumerate(rows):
        column, row = index % 5, index // 5
        x = GAP + column * (THUMB_W + GAP)
        y = GAP + row * (CELL_H + GAP)
        sheet.paste(early, (x, y))
        sheet.paste(middle, (x, y + THUMB_H + 24))
        draw.rectangle((x, y + THUMB_H, x + THUMB_W, y + THUMB_H + 24), fill=(27, 35, 107))
        draw.text((x + 8, y + THUMB_H + 5), f"{record['scene']}  early / 65%", fill=(242, 246, 255))
    QC_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, "JPEG", quality=92, subsampling=0, optimize=True)


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    rows = [inspect(scene) for scene in manifest["scenes"]]
    contact_sheet(rows)
    records = [row[0] for row in rows]
    report = {
        "production_id": manifest["production_id"],
        "clip_count": len(records),
        "expected_total_seconds": sum(item["expected_duration_seconds"] for item in records),
        "measured_total_seconds": round(sum(item["measured_duration_seconds"] for item in records), 4),
        "unique_sha256_count": len({item["sha256"] for item in records}),
        "all_ok": all(item["ok"] for item in records),
        "audio_note": "All FLUX clips structurally contain audio; montage must discard it and replace it with canonical VO/SFX.",
        "contact_sheet": CONTACT_SHEET.relative_to(ROOT).as_posix(),
        "clips": records,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for item in records:
        print(
            f"{item['scene']} {item['width']}x{item['height']} {item['fps']}fps "
            f"{item['measured_duration_seconds']}s audio={item['has_audio_track']} ok={item['ok']}"
        )
    print(
        f"total={report['measured_total_seconds']}s unique={report['unique_sha256_count']}/10 "
        f"all_ok={report['all_ok']}"
    )
    print(f"contact sheet {CONTACT_SHEET.relative_to(ROOT)}")
    print(f"report {REPORT_PATH.relative_to(ROOT)}")
    if not report["all_ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
