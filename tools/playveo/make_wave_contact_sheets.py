"""Create review contact sheets for every Majarra Wave game."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / "tools" / "playveo" / "wave-production.jobs.json"
QC_PATH = ROOT / "tools" / "playveo" / "wave-assets-qc.json"
OUT_DIR = ROOT / "tools" / "playveo" / "contact-sheets" / "wave"
CELL_WIDTH = 420
CELL_HEIGHT = 340
COLUMNS = 3
HEADER_HEIGHT = 72
LABEL_HEIGHT = 46


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def checker(width: int, height: int, tile: int = 18) -> Image.Image:
    image = Image.new("RGB", (width, height), "#F7F7F7")
    draw = ImageDraw.Draw(image)
    for y in range(0, height, tile):
        for x in range(0, width, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill="#D9DEE3")
    return image


def contain(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


def label_for(job: dict[str, Any]) -> str:
    name = job.get("member") or job["asset"]
    suffix = "PNG alpha" if job.get("transparent_required") else "WebP opaque"
    return f"{name}  |  {suffix}"


def sheet_for_game(game_id: str, jobs: list[dict[str, Any]]) -> tuple[Path, int]:
    entries: list[tuple[str, Path, bool]] = []
    cover = next(job for job in jobs if job["asset"] == "cover")
    if cover.get("thumbnail_file"):
        entries.append(("thumbnail  |  WebP opaque", ROOT / cover["thumbnail_file"], False))
    for job in jobs:
        entries.append((label_for(job), ROOT / job["target_file"], bool(job.get("transparent_required"))))

    rows = math.ceil(len(entries) / COLUMNS)
    sheet = Image.new("RGB", (CELL_WIDTH * COLUMNS, HEADER_HEIGHT + CELL_HEIGHT * rows), "#EEF2F5")
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(28, bold=True)
    label_font = load_font(18, bold=True)
    meta_font = load_font(14)
    draw.rectangle((0, 0, sheet.width, HEADER_HEIGHT), fill="#142D3A")
    draw.text((24, 16), game_id, font=title_font, fill="white")
    draw.text((sheet.width - 300, 24), f"{len(entries)} review items", font=meta_font, fill="#B8D8E5")

    art_height = CELL_HEIGHT - LABEL_HEIGHT
    for index, (label, file_path, transparent) in enumerate(entries):
        column = index % COLUMNS
        row = index // COLUMNS
        left = column * CELL_WIDTH
        top = HEADER_HEIGHT + row * CELL_HEIGHT
        panel = checker(CELL_WIDTH - 16, art_height - 12) if transparent else Image.new(
            "RGB", (CELL_WIDTH - 16, art_height - 12), "#FFFFFF"
        )
        try:
            with Image.open(file_path) as source:
                source.load()
                fitted = contain(source.convert("RGBA") if transparent else source.convert("RGB"), panel.width - 28, panel.height - 28)
                position = ((panel.width - fitted.width) // 2, (panel.height - fitted.height) // 2)
                if transparent:
                    panel.paste(fitted, position, fitted)
                else:
                    panel.paste(fitted, position)
        except Exception as error:
            panel_draw = ImageDraw.Draw(panel)
            panel_draw.text((16, 16), f"LOAD ERROR: {error}", font=meta_font, fill="#B42318")
        sheet.paste(panel, (left + 8, top + 6))
        draw.rectangle((left + 8, top + art_height, left + CELL_WIDTH - 8, top + CELL_HEIGHT - 8), fill="#FFFFFF")
        draw.text((left + 18, top + art_height + 10), label, font=label_font, fill="#20323C")
        draw.rectangle((left, top, left + CELL_WIDTH - 1, top + CELL_HEIGHT - 1), outline="#B7C2C9", width=1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / f"{game_id.replace('game-', '')}.png"
    sheet.save(output, "PNG", optimize=True)
    return output, len(entries)


def main() -> None:
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    qc = json.loads(QC_PATH.read_text(encoding="utf-8"))
    games = sorted({job["game_id"] for job in state["jobs"]})
    records = []
    for game_id in games:
        jobs = [job for job in state["jobs"] if job["game_id"] == game_id]
        output, count = sheet_for_game(game_id, jobs)
        records.append({
            "game_id": game_id,
            "file": output.relative_to(ROOT).as_posix(),
            "items": count,
            "review": "ART_REVIEW_PENDING",
        })
        print(f"contact sheet {game_id}: {count} items")
    qc["contact_sheets"] = records
    qc["summary"]["contact_sheets_written"] = len(records)
    qc["summary"]["contact_sheet_review"] = "PENDING"
    qc["contact_sheets_generated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    QC_PATH.write_text(json.dumps(qc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(records)} contact sheets to {OUT_DIR.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
