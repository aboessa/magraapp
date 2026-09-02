"""Create reviewed Creative Studio WebP assets from raw PlayVeo JPEG files.

Mirrors ``prepare-act-s3-assets.py``: the provider's nominal 16:9 output is
1376x768 and its nominal 1:1 is 1024x1024, so we center-crop only the fractional
overage before a uniform resize and never stretch an image.

Two safety properties matter here and are enforced, not assumed:

1. ``SOURCE`` points at the studio artwork batch only. Character sheets and
   consistency probes live in sibling directories and therefore cannot reach
   production through this script — the same guarantee the ACT-S3 script relies
   on. A sheet is an internal reference; shipping one as a card cover would put a
   six-view turnaround on a child's screen.
2. The destination is swept for unexpected files afterwards. A renamed or
   abandoned asset left behind in a Flutter asset directory is silently bundled
   into the app, which is how dead weight accumulates in a release.

Run from the repository root:

    python tools/playveo/prepare-studio-assets.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools" / "playveo" / "output" / "studio-artwork"
DESTINATION = ROOT / "app_main" / "assets" / "images" / "studio"

# Card covers are square because the grid tile is nearly square (aspect 0.86) and
# a square source crops cleanly to it at any column count. The hero is 16:9 and
# is only ever cropped from the start edge, where the illustration sits.
CARD_SIZE = (600, 600)

# Quick-action glyph plates. 144px covers a 44dp chip at 3x with a little slack;
# anything larger is wasted bytes for a button that small.
ICON_SIZE = (144, 144)

TARGETS = {
    "hero-start-drawing.jpg": (1280, 720),
    "icon-new-canvas.jpg": ICON_SIZE,
    "icon-draw-like-me.jpg": ICON_SIZE,
    "card-coloring.jpg": CARD_SIZE,
    "card-free-draw.jpg": CARD_SIZE,
    "card-draw-like-me.jpg": CARD_SIZE,
    "card-complete.jpg": CARD_SIZE,
    "card-copy-pattern.jpg": CARD_SIZE,
    "card-connect-dots.jpg": CARD_SIZE,
    "card-trace.jpg": CARD_SIZE,
    "card-letters.jpg": CARD_SIZE,
    "card-numbers.jpg": CARD_SIZE,
    "card-prompt-draw.jpg": CARD_SIZE,
}


def center_crop_to_ratio(
    image: Image.Image, target_width: int, target_height: int
) -> Image.Image:
    source_width, source_height = image.size
    target_ratio = target_width / target_height
    source_ratio = source_width / source_height

    if source_ratio > target_ratio:
        crop_width = round(source_height * target_ratio)
        left = (source_width - crop_width) // 2
        box = (left, 0, left + crop_width, source_height)
    else:
        crop_height = round(source_width / target_ratio)
        top = (source_height - crop_height) // 2
        box = (0, top, source_width, top + crop_height)

    cropped = image.crop(box)
    if abs(cropped.width / cropped.height - target_ratio) > 0.001:
        raise ValueError(f"crop ratio drift for {image.size}: got {cropped.size}")
    return cropped


def main() -> None:
    if not SOURCE.is_dir():
        raise FileNotFoundError(
            f"{SOURCE.relative_to(ROOT)} does not exist. Generate the studio "
            "artwork batch first, and only after the character sheets are approved."
        )

    present = sorted(name for name in TARGETS if (SOURCE / name).is_file())
    if not present:
        raise FileNotFoundError(f"no reviewed studio assets found in {SOURCE.relative_to(ROOT)}")

    DESTINATION.mkdir(parents=True, exist_ok=True)
    expected_outputs = set()

    for source_name in present:
        target_size = TARGETS[source_name]
        source_path = SOURCE / source_name
        output_path = DESTINATION / f"{source_path.stem}.webp"
        expected_outputs.add(output_path.name)

        with Image.open(source_path) as opened:
            image = opened.convert("RGB")
            cropped = center_crop_to_ratio(image, *target_size)
            resized = cropped.resize(target_size, Image.Resampling.LANCZOS)
            resized.save(output_path, "WEBP", quality=86, method=6, exact=True)

        with Image.open(output_path) as verified:
            if verified.size != target_size or verified.format != "WEBP":
                raise ValueError(
                    f"invalid output {output_path}: {verified.format} {verified.size}"
                )
        print(f"{source_name}: {image.size} -> crop {cropped.size} -> {target_size} WebP")

    skipped = sorted(set(TARGETS) - set(present))
    if skipped:
        print(f"\nnot yet generated ({len(skipped)}): {', '.join(skipped)}")

    unexpected = sorted(
        path.name
        for path in DESTINATION.iterdir()
        if path.is_file() and path.name not in expected_outputs
    )
    if unexpected:
        raise ValueError(
            f"unexpected files in production asset directory: {', '.join(unexpected)}"
        )


if __name__ == "__main__":
    main()
