"""Compose the ten Luna E01 start frames deterministically at 1920x1080.

The provider's image-to-image route cloned the reference sheet and its
text-to-image fallback ignored the requested scene. This compositor therefore
uses Luna pixels extracted directly from the approved canonical sheet and draws
one locked Najmi/prop set for every frame. It adds no text to production frames.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from build_local_reference import (
    BROWN,
    CORAL,
    CREAM,
    CYAN,
    GOLD,
    OFF_WHITE,
    draw_apple,
    draw_ball,
    draw_cat,
    draw_house,
    draw_najmi,
)

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "majarra_images/assets/images/characters/luna-preschool-character-sheet.png"
OUT_DIR = ROOT / "assets/episodes/luna-e01-picture-and-thing/images"
CONTACT_SHEET = ROOT / "assets/episodes/luna-e01-picture-and-thing/qc/images-contact-sheet.jpg"
REPORT = ROOT / "assets/episodes/luna-e01-picture-and-thing/qc/local-scenes-report.json"

WIDTH, HEIGHT = 1920, 1080
NAVY = "#0B1026"
HILL = "#1B236B"
GROUND = "#F5E8CC"
HILL_LIGHT = "#29358A"
WHITE = "#FFFDF6"

POSE_BOXES = {
    "front": (87, 31, 328, 540),
    "three_quarter": (442, 31, 669, 544),
    "profile": (777, 31, 982, 540),
}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_luna(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    pixels = np.asarray(crop).copy()
    background = np.array(source.getpixel((0, 0))[:3], dtype=np.int16)
    rgb = pixels[:, :, :3].astype(np.int16)
    distance = np.max(np.abs(rgb - background), axis=2)
    alpha = np.clip((distance - 3) * 30, 0, 255).astype(np.uint8)
    alpha = np.minimum(alpha, pixels[:, :, 3])
    pixels[:, :, 3] = alpha
    result = Image.fromarray(pixels, "RGBA")
    bounds = result.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("Failed to extract Luna from the canonical sheet")
    return result.crop(bounds)


def base_scene() -> Image.Image:
    image = Image.new("RGBA", (WIDTH, HEIGHT), NAVY)
    draw = ImageDraw.Draw(image)

    # Two quiet background stars are one decorative layer, never characters.
    for cx, cy, radius in ((1580, 115, 10), (1710, 205, 7)):
        points = []
        for index in range(10):
            angle = -1.5708 + index * 0.62832
            current = radius if index % 2 == 0 else radius * 0.45
            points.append((cx + np.cos(angle) * current, cy + np.sin(angle) * current))
        draw.polygon(points, fill="#D8C66A")

    # Rounded, sparse Planet Abjad hill layers.
    draw.ellipse((-380, 500, 1250, 1220), fill=HILL)
    draw.ellipse((700, 570, 2260, 1210), fill=HILL_LIGHT)
    draw.rectangle((0, 790, WIDTH, HEIGHT), fill=GROUND)
    draw.ellipse((-250, 700, 1020, 1110), fill="#E7D4AE")
    draw.ellipse((880, 730, 2180, 1120), fill="#EBDAB9")
    draw.rectangle((0, 900, WIDTH, HEIGHT), fill=GROUND)
    return image


def paste_luna(image: Image.Image, sprite: Image.Image, center_x: int, ground_y: int, height: int) -> None:
    ratio = height / sprite.height
    width = int(sprite.width * ratio)
    resized = sprite.resize((width, height), Image.Resampling.LANCZOS)
    x = center_x - width // 2
    y = ground_y - height

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((center_x - width * 0.34, ground_y - 18, center_x + width * 0.34, ground_y + 14), fill=(30, 25, 32, 55))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    image.alpha_composite(resized, (x, y))


def prop(image: Image.Image, name: str, cx: int, cy: int, scale: float = 1.0) -> None:
    draw = ImageDraw.Draw(image)
    if name == "apple":
        draw_apple(draw, cx, cy, 1.42 * scale)
    elif name == "ball":
        draw_ball(image, cx, cy, int(112 * scale))
    elif name == "cat":
        draw_cat(draw, cx, cy, 1.28 * scale)
    elif name == "house":
        draw_house(draw, cx, cy, 1.05 * scale)
    else:
        raise ValueError(f"Unknown prop {name}")


def card(image: Image.Image, name: str, cx: int, cy: int, width: int = 330, height: int = 270) -> None:
    draw = ImageDraw.Draw(image)
    left, top = cx - width // 2, cy - height // 2
    draw.rounded_rectangle((left, top, left + width, top + height), radius=30, fill=WHITE, outline=CYAN, width=17)
    factor = min(width / 360, height / 300) * 0.75
    prop(image, name, cx, cy + 15, factor)


def success_halo(image: Image.Image, cx: int, cy: int, radius: int) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for extra, alpha in ((36, 35), (22, 55), (10, 90)):
        draw.ellipse((cx - radius - extra, cy - radius - extra, cx + radius + extra, cy + radius + extra), outline=(255, 211, 77, alpha), width=12)
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(8)))


def review_board(image: Image.Image, cx: int, cy: int) -> None:
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = cx - 330, cy - 310, cx + 330, cy + 310
    draw.rounded_rectangle((left, top, right, bottom), radius=42, fill=WHITE, outline=CYAN, width=18)
    draw.line((cx, top + 25, cx, bottom - 25), fill="#C9EAF0", width=8)
    draw.line((left + 25, cy, right - 25, cy), fill="#C9EAF0", width=8)
    prop(image, "apple", cx - 165, cy - 150, 0.75)
    prop(image, "ball", cx + 165, cy - 150, 0.72)
    prop(image, "cat", cx - 165, cy + 160, 0.70)
    prop(image, "house", cx + 165, cy + 150, 0.68)


def compose(scene_id: str, sprites: dict[str, Image.Image]) -> Image.Image:
    image = base_scene()

    if scene_id == "S01":
        paste_luna(image, sprites["front"], 365, 955, 760)
        draw_najmi(image, 820, 355, 125, glow=False)
    elif scene_id == "S02":
        paste_luna(image, sprites["three_quarter"], 380, 955, 760)
        draw_najmi(image, 965, 320, 112, glow=True)
        card(image, "apple", 1430, 370)
        prop(image, "apple", 1430, 790, 1.1)
    elif scene_id == "S03":
        card(image, "ball", 960, 300)
        prop(image, "ball", 450, 790, 1.25)
        prop(image, "cat", 960, 790, 1.18)
        prop(image, "house", 1470, 790, 1.12)
    elif scene_id == "S04":
        card(image, "ball", 750, 300)
        success_halo(image, 820, 760, 180)
        prop(image, "ball", 820, 760, 1.55)
        draw_najmi(image, 1340, 600, 130, glow=True)
    elif scene_id == "S05":
        card(image, "cat", 960, 300)
        prop(image, "cat", 590, 790, 1.25)
        prop(image, "house", 1330, 790, 1.15)
        draw_najmi(image, 510, 310, 112, glow=True)
    elif scene_id == "S06":
        card(image, "house", 740, 300)
        prop(image, "house", 850, 780, 1.42)
        draw_najmi(image, 1330, 590, 128, glow=True)
    elif scene_id == "S07":
        paste_luna(image, sprites["front"], 360, 955, 760)
        success_halo(image, 1350, 735, 190)
        prop(image, "house", 1350, 770, 1.35)
        draw_najmi(image, 1350, 330, 120, glow=True)
    elif scene_id == "S08":
        card(image, "apple", 960, 300)
        prop(image, "apple", 470, 800, 1.2)
        prop(image, "ball", 960, 790, 1.15)
        prop(image, "house", 1460, 790, 1.12)
    elif scene_id == "S09":
        paste_luna(image, sprites["three_quarter"], 360, 955, 760)
        prop(image, "apple", 980, 760, 1.1)
        card(image, "apple", 1450, 620)
        draw_najmi(image, 1150, 285, 115, glow=True)
    elif scene_id == "S10":
        paste_luna(image, sprites["front"], 320, 955, 760)
        draw_najmi(image, 750, 340, 120, glow=True)
        review_board(image, 1400, 570)
    else:
        raise ValueError(scene_id)

    return image.convert("RGB")


def build_contact_sheet(files: list[Path]) -> None:
    thumb_w, thumb_h, gap = 448, 252, 14
    sheet = Image.new("RGB", (thumb_w * 5 + gap * 6, thumb_h * 2 + gap * 3), NAVY)
    for index, file in enumerate(files):
        with Image.open(file) as image:
            thumb = image.convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        column, row = index % 5, index // 5
        x = gap + column * (thumb_w + gap)
        y = gap + row * (thumb_h + gap)
        sheet.paste(thumb, (x, y))
    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, "JPEG", quality=94, subsampling=0, optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Canonical source is missing: {SOURCE}")
    source = Image.open(SOURCE).convert("RGBA")
    sprites = {name: extract_luna(source, box) for name, box in POSE_BOXES.items()}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs: list[Path] = []
    records = []
    for number in range(1, 11):
        scene_id = f"S{number:02d}"
        output = OUT_DIR / f"{scene_id}.jpg"
        compose(scene_id, sprites).save(output, "JPEG", quality=95, subsampling=0, optimize=True)
        with Image.open(output) as check:
            if check.size != (WIDTH, HEIGHT) or check.format != "JPEG":
                raise RuntimeError(f"Invalid output {output}: {check.format} {check.size}")
        outputs.append(output)
        records.append({
            "scene": scene_id,
            "file": output.relative_to(ROOT).as_posix(),
            "width": WIDTH,
            "height": HEIGHT,
            "bytes": output.stat().st_size,
            "sha256": sha256_file(output),
        })
        print(f"saved {output.relative_to(ROOT)} ({output.stat().st_size} bytes)")

    build_contact_sheet(outputs)
    report = {
        "mode": "deterministic-local-composite",
        "reason": "PlayVeo i2i cloned the reference; PlayVeo t2i returned an unrelated square asset.",
        "canonical_source": SOURCE.relative_to(ROOT).as_posix(),
        "canonical_sha256": sha256_file(SOURCE),
        "scene_count": len(records),
        "dimensions": [WIDTH, HEIGHT],
        "contact_sheet": CONTACT_SHEET.relative_to(ROOT).as_posix(),
        "scenes": records,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"contact sheet {CONTACT_SHEET.relative_to(ROOT)}")
    print(f"report {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
