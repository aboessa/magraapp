"""Create reviewed ACT-S3 Flutter WebP assets from raw PlayVeo JPEG files.

The provider's nominal 16:9 output is 1376x768 (slightly too wide), and its
nominal 3:4 output is 896x1200 (slightly too wide). We center-crop only the
fractional overage before a uniform resize, so no image is stretched. Character
sheets and consistency probes are deliberately outside the source directory and
can never enter production through this script.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools" / "playveo" / "output" / "act-s3"
DESTINATION = ROOT / "app_main" / "assets" / "images" / "stories" / "act-s3-playveo"

TARGETS = {
    **{f"page-{page:03d}.jpg": (1920, 1080) for page in range(1, 9)},
    "cover.jpg": (1200, 1200),
    "hero.jpg": (1920, 1080),
    "thumb.jpg": (900, 1200),
}


def center_crop_to_ratio(image: Image.Image, target_width: int, target_height: int) -> Image.Image:
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
    missing = sorted(name for name in TARGETS if not (SOURCE / name).is_file())
    if missing:
        raise FileNotFoundError(f"missing reviewed source assets: {', '.join(missing)}")

    DESTINATION.mkdir(parents=True, exist_ok=True)
    expected_outputs = set()

    for source_name, target_size in TARGETS.items():
        source_path = SOURCE / source_name
        output_path = DESTINATION / f"{source_path.stem}.webp"
        expected_outputs.add(output_path.name)

        with Image.open(source_path) as opened:
            image = opened.convert("RGB")
            cropped = center_crop_to_ratio(image, *target_size)
            resized = cropped.resize(target_size, Image.Resampling.LANCZOS)
            resized.save(output_path, "WEBP", quality=90, method=6, exact=True)

        with Image.open(output_path) as verified:
            if verified.size != target_size or verified.format != "WEBP":
                raise ValueError(f"invalid output {output_path}: {verified.format} {verified.size}")
        print(f"{source_name}: {image.size} -> crop {cropped.size} -> {target_size} WebP")

    unexpected = sorted(path.name for path in DESTINATION.iterdir() if path.is_file() and path.name not in expected_outputs)
    if unexpected:
        raise ValueError(f"unexpected files in production asset directory: {', '.join(unexpected)}")

    print(f"created and verified {len(TARGETS)} reviewed assets in {DESTINATION.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
