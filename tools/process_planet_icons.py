from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "majarra_images" / "icons"
OUTPUT_DIR = ROOT / "app_main" / "assets" / "images" / "planets"
CANVAS_SIZE = 1024
CONTENT_SIZE = 944
ALPHA_CROP_THRESHOLD = 6

ICON_FILES = {
    "كوكب ابجد.jpeg": "planet-abjad.png",
    "كوكب الابداع.jpeg": "planet-creativity.png",
    "كوكب الارقام.jpeg": "planet-numbers.png",
    "كوكب العلوم.jpeg": "planet-science.png",
    "كوكب القصص.jpeg": "planet-stories.png",
    "كوكب القيم والاسلاميات.jpeg": "planet-values-islamic.png",
    "كوكب المهارات.jpeg": "planet-maharat.png",
    "كوكب التاريخ.jpeg": "planet-tarikh.png",
    "كوكب الإيمان.jpeg": "planet-iman.png",
    "كوكب عالمنا.jpeg": "planet-alamna.png",
}


def smoothstep(values: np.ndarray, low: float, high: float) -> np.ndarray:
    scaled = np.clip((values - low) / (high - low), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def fill_small_enclosed_holes(alpha: np.ndarray) -> np.ndarray:
    support = (alpha >= 72).astype(np.uint8)
    support = cv2.morphologyEx(
        support,
        cv2.MORPH_CLOSE,
        np.ones((3, 3), dtype=np.uint8),
    )
    inverse = 1 - support
    exterior = inverse.copy()
    flood_mask = np.zeros(
        (exterior.shape[0] + 2, exterior.shape[1] + 2),
        dtype=np.uint8,
    )
    cv2.floodFill(exterior, flood_mask, (0, 0), 2)
    holes = ((inverse == 1) & (exterior != 2)).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(holes, 8)
    result = alpha.copy()
    for label in range(1, count):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area <= 6000:
            result[labels == label] = 255
    return result


def checkerboard_aware_cutout(
    source: Image.Image,
    semantic_cutout: Image.Image,
) -> Image.Image:
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    semantic_alpha = np.asarray(
        semantic_cutout.convert("RGBA").getchannel("A"),
        dtype=np.float32,
    )

    channel_max = rgb.max(axis=2)
    channel_min = rgb.min(axis=2)
    chroma = channel_max - channel_min
    luminance = rgb.mean(axis=2)

    border_width = 96
    border_mask = np.zeros(luminance.shape, dtype=bool)
    border_mask[:border_width, :] = True
    border_mask[-border_width:, :] = True
    border_mask[:, :border_width] = True
    border_mask[:, -border_width:] = True
    neutral_border = luminance[border_mask & (chroma < 8)]
    if neutral_border.size == 0:
        raise RuntimeError("Could not estimate the checkerboard background")
    bright_background = float(np.percentile(neutral_border, 98.5))

    # The baked checkerboard is neutral gray. Colorfulness recovers saturated
    # planet details that semantic background removal can mistake for shadows;
    # brightness recovers white paper, stars, and calligraphy.
    color_alpha = smoothstep(chroma, 4.0, 26.0) * 255.0
    bright_alpha = smoothstep(
        luminance,
        bright_background + 7.0,
        bright_background + 70.0,
    ) * 255.0
    keyed_alpha = np.maximum(color_alpha, bright_alpha)
    alpha = np.maximum(semantic_alpha, keyed_alpha)
    alpha[alpha < 5] = 0
    alpha = fill_small_enclosed_holes(alpha.astype(np.uint8))

    # Remove the neutral checker contribution from translucent colored glows.
    normalized_alpha = np.maximum(alpha.astype(np.float32) / 255.0, 0.02)
    neutral = channel_min
    solved = (
        rgb - (1.0 - normalized_alpha[..., None]) * neutral[..., None]
    ) / normalized_alpha[..., None]
    solved = np.clip(solved, 0, 255)
    use_solved = (alpha < 230) & (chroma >= 5)
    output_rgb = np.where(use_solved[..., None], solved, rgb).astype(np.uint8)
    output = np.dstack([output_rgb, alpha.astype(np.uint8)])
    return Image.fromarray(output, mode="RGBA")


def normalize_cutout(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    crop_mask = alpha.point(
        lambda value: 255 if value > ALPHA_CROP_THRESHOLD else 0,
    )
    bounds = crop_mask.getbbox()
    if bounds is None:
        raise RuntimeError("Background removal produced an empty image")

    cropped = rgba.crop(bounds)
    scale = min(CONTENT_SIZE / cropped.width, CONTENT_SIZE / cropped.height)
    target_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(target_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    offset = (
        (CANVAS_SIZE - resized.width) // 2,
        (CANVAS_SIZE - resized.height) // 2,
    )
    canvas.alpha_composite(resized, dest=offset)
    return canvas


def main() -> None:
    missing = [name for name in ICON_FILES if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing source icons: {', '.join(missing)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    session = new_session("birefnet-general")

    for source_name, output_name in ICON_FILES.items():
        source_path = SOURCE_DIR / source_name
        output_path = OUTPUT_DIR / output_name
        with Image.open(source_path) as opened:
            source = opened.convert("RGB")
        semantic_cutout = remove(
            source,
            session=session,
            alpha_matting=False,
            post_process_mask=False,
        )
        hybrid_cutout = checkerboard_aware_cutout(source, semantic_cutout)
        normalized = normalize_cutout(hybrid_cutout)
        normalized.save(output_path, format="PNG", optimize=True)

        alpha = normalized.getchannel("A")
        visible_bounds = alpha.point(lambda value: 255 if value > 6 else 0).getbbox()
        alpha_values = np.asarray(alpha)
        transparency = float(np.count_nonzero(alpha_values == 0)) / alpha_values.size
        print(
            f"{source_name} -> {output_name} | "
            f"bounds={visible_bounds} | fully-transparent={transparency:.1%}",
        )


if __name__ == "__main__":
    main()
