"""Build a deterministic combined Luna/Najmi/props reference from the canonical Luna sheet.

This is the zero-credit fallback for a provider image job that remains pending. It
preserves the original Luna pixels and draws only the missing companion and props.
No labels or generated text are added.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "majarra_images/assets/images/characters/luna-preschool-character-sheet.png"
OUTPUT = ROOT / "assets/episodes/luna-e01-picture-and-thing/reference/combined-character-sheet.local.jpg"

W, H = 2560, 1440
OFF_WHITE = "#FBFAF4"
BROWN = "#4A2A1A"
GOLD = "#FFD34D"
YELLOW = "#F8C948"
CYAN = "#00D6F5"
TEAL = "#176B70"
CORAL = "#E97466"
CREAM = "#FFF1D0"
RED = "#DF4B43"
GREEN = "#4B9A5A"
GINGER = "#D9833B"


def star_points(cx: float, cy: float, outer: float, inner: float) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for index in range(10):
        angle = -math.pi / 2 + index * math.pi / 5
        radius = outer if index % 2 == 0 else inner
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return points


def draw_najmi(image: Image.Image, cx: int, cy: int, radius: int, glow: bool) -> None:
    if glow:
        glow_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_layer)
        for extra, alpha in ((48, 45), (32, 70), (18, 100)):
            glow_draw.polygon(
                star_points(cx, cy, radius + extra, (radius + extra) * 0.47),
                fill=(0, 214, 245, alpha),
            )
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(18))
        image.alpha_composite(glow_layer)

    draw = ImageDraw.Draw(image)
    draw.polygon(star_points(cx, cy, radius, radius * 0.47), fill=GOLD, outline=BROWN, width=11)
    eye_y = cy - int(radius * 0.10)
    eye_dx = int(radius * 0.24)
    eye_r = max(8, int(radius * 0.075))
    for eye_x in (cx - eye_dx, cx + eye_dx):
        draw.ellipse((eye_x - eye_r, eye_y - eye_r, eye_x + eye_r, eye_y + eye_r), fill=BROWN)
        shine = max(2, eye_r // 3)
        draw.ellipse((eye_x - shine, eye_y - shine, eye_x, eye_y), fill="#FFFFFF")
    mouth_w = int(radius * 0.27)
    mouth_h = int(radius * 0.18)
    draw.arc((cx - mouth_w, cy, cx + mouth_w, cy + mouth_h), 10, 170, fill=BROWN, width=7)


def draw_shadow(image: Image.Image, box: tuple[int, int, int, int]) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(box, fill=(64, 45, 30, 35))
    image.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10)))


def draw_apple(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0) -> None:
    r = int(70 * scale)
    outline = max(4, int(9 * scale))
    draw.ellipse((cx - r, cy - int(r * 0.75), cx + int(r * 0.18), cy + r), fill=RED, outline=BROWN, width=outline)
    draw.ellipse((cx - int(r * 0.18), cy - int(r * 0.75), cx + r, cy + r), fill=RED, outline=BROWN, width=outline)
    draw.line((cx, cy - int(r * 0.70), cx + int(8 * scale), cy - int(r * 1.15)), fill=BROWN, width=outline)
    leaf = [
        (cx + int(6 * scale), cy - int(r * 1.02)),
        (cx + int(48 * scale), cy - int(r * 1.22)),
        (cx + int(55 * scale), cy - int(r * 0.88)),
    ]
    draw.polygon(leaf, fill=GREEN, outline=BROWN)
    draw.ellipse((cx - int(35 * scale), cy - int(38 * scale), cx - int(12 * scale), cy - int(8 * scale)), fill="#F98B7C")


def draw_ball(image: Image.Image, cx: int, cy: int, radius: int) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=TEAL)
    band = int(radius * 0.48)
    d.polygon(
        [
            (cx - radius * 1.25, cy - radius * 0.20 - band),
            (cx - radius * 0.75, cy - radius * 0.70 - band),
            (cx + radius * 1.25, cy + radius * 0.20 + band),
            (cx + radius * 0.75, cy + radius * 0.70 + band),
        ],
        fill=YELLOW,
    )
    clipped = Image.new("RGBA", image.size, (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), mask)
    image.alpha_composite(clipped)
    draw = ImageDraw.Draw(image)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=BROWN, width=10)
    draw.arc((cx - radius, cy - radius, cx + radius, cy + radius), 205, 330, fill="#F4E7A0", width=8)


def draw_cat(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0) -> None:
    outline = max(4, int(9 * scale))
    body_rx, body_ry = int(62 * scale), int(70 * scale)
    head_r = int(58 * scale)
    body_y = cy + int(35 * scale)
    draw.line(
        [(cx + body_rx - int(5 * scale), body_y + int(5 * scale)),
         (cx + int(105 * scale), body_y - int(20 * scale)),
         (cx + int(110 * scale), body_y - int(75 * scale))],
        fill=BROWN,
        width=outline + 18,
        joint="curve",
    )
    draw.line(
        [(cx + body_rx - int(5 * scale), body_y + int(5 * scale)),
         (cx + int(105 * scale), body_y - int(20 * scale)),
         (cx + int(110 * scale), body_y - int(75 * scale))],
        fill=GINGER,
        width=outline,
        joint="curve",
    )
    draw.ellipse((cx - body_rx, body_y - body_ry, cx + body_rx, body_y + body_ry), fill=GINGER, outline=BROWN, width=outline)
    draw.ellipse((cx - head_r, cy - int(100 * scale), cx + head_r, cy + int(16 * scale)), fill=GINGER, outline=BROWN, width=outline)
    draw.polygon(
        [(cx - int(48 * scale), cy - int(75 * scale)), (cx - int(35 * scale), cy - int(140 * scale)), (cx - int(3 * scale), cy - int(88 * scale))],
        fill=GINGER,
        outline=BROWN,
    )
    draw.polygon(
        [(cx + int(8 * scale), cy - int(88 * scale)), (cx + int(40 * scale), cy - int(140 * scale)), (cx + int(52 * scale), cy - int(72 * scale))],
        fill=GINGER,
        outline=BROWN,
    )
    eye_y = cy - int(45 * scale)
    for eye_x in (cx - int(22 * scale), cx + int(22 * scale)):
        draw.ellipse((eye_x - int(8 * scale), eye_y - int(9 * scale), eye_x + int(8 * scale), eye_y + int(9 * scale)), fill=BROWN)
        draw.ellipse((eye_x - int(3 * scale), eye_y - int(5 * scale), eye_x + int(1 * scale), eye_y - int(1 * scale)), fill="#FFFFFF")
    draw.polygon([(cx, cy - int(24 * scale)), (cx - int(8 * scale), cy - int(14 * scale)), (cx + int(8 * scale), cy - int(14 * scale))], fill="#B84D4D")
    draw.arc((cx - int(24 * scale), cy - int(14 * scale), cx, cy + int(16 * scale)), 350, 130, fill=BROWN, width=max(3, int(4 * scale)))
    draw.arc((cx, cy - int(14 * scale), cx + int(24 * scale), cy + int(16 * scale)), 50, 190, fill=BROWN, width=max(3, int(4 * scale)))


def draw_house(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float = 1.0) -> None:
    outline = max(4, int(9 * scale))
    half_w = int(100 * scale)
    top = cy - int(30 * scale)
    bottom = cy + int(105 * scale)
    draw.rectangle((cx - half_w, top, cx + half_w, bottom), fill=CREAM, outline=BROWN, width=outline)
    draw.polygon(
        [(cx - int(125 * scale), top), (cx, cy - int(135 * scale)), (cx + int(125 * scale), top)],
        fill=CORAL,
        outline=BROWN,
    )
    door_w = int(42 * scale)
    draw.rounded_rectangle((cx - door_w, cy + int(30 * scale), cx + door_w, bottom), radius=int(8 * scale), fill=CYAN, outline=BROWN, width=outline)
    window_r = int(28 * scale)
    for wx in (cx - int(63 * scale), cx + int(63 * scale)):
        draw.rounded_rectangle((wx - window_r, cy - int(3 * scale), wx + window_r, cy + int(47 * scale)), radius=int(7 * scale), fill="#BDEEF4", outline=BROWN, width=max(3, int(6 * scale)))


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Canonical source is missing: {SOURCE}")

    canvas = Image.new("RGBA", (W, H), OFF_WHITE)
    source = Image.open(SOURCE).convert("RGBA")
    source.thumbnail((1830, 1025), Image.Resampling.LANCZOS)
    canvas.alpha_composite(source, (40, 35))

    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((1910, 45, 2515, 1070), radius=45, fill="#F4F1E8", outline="#E3DDCF", width=5)
    draw_najmi(canvas, 2210, 330, 170, glow=False)
    draw_najmi(canvas, 2210, 765, 170, glow=True)

    draw.rounded_rectangle((40, 1110, 2515, 1400), radius=45, fill="#F4F1E8", outline="#E3DDCF", width=5)
    centers = [285, 760, 1235, 1710, 2200]
    for cx in centers:
        draw_shadow(canvas, (cx - 105, 1340, cx + 105, 1374))

    draw_apple(draw, centers[0], 1268, 1.15)
    draw_ball(canvas, centers[1], 1260, 104)
    draw_cat(draw, centers[2], 1260, 1.08)
    draw_house(draw, centers[3], 1260, 0.93)
    draw.rounded_rectangle((centers[4] - 145, 1148, centers[4] + 145, 1373), radius=28, fill="#FFFFFF", outline=CYAN, width=14)
    draw_apple(draw, centers[4], 1272, 0.72)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT, "JPEG", quality=95, subsampling=0, optimize=True)
    with Image.open(OUTPUT) as result:
        print(f"saved {OUTPUT.relative_to(ROOT)} {result.size[0]}x{result.size[1]} {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
