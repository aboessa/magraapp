"""Create reviewed ACT-S4 Flutter WebP assets from raw PlayVeo JPEG files.
Based on prepare-act-s3-assets.py pattern but for act-s4 (8 pages).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools" / "playveo" / "output" / "act-s4"
DESTINATION = ROOT / "app_main" / "assets" / "images" / "stories" / "act-s4-playveo"

TARGETS = {
    **{f"page-{page:03d}.jpg": (1920, 1080) for page in range(1, 9)},
    "cover.jpg": (1200, 1200),
    "hero.jpg": (1920, 1080),
    "thumb.jpg": (900, 1200),
}

def center_crop_to_ratio(image: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = image.size
    tr = tw / th
    sr = sw / sh
    if sr > tr:
        cw = round(sh * tr)
        left = (sw - cw)//2
        box = (left, 0, left+cw, sh)
    else:
        ch = round(sw / tr)
        top = (sh - ch)//2
        box = (0, top, sw, top+ch)
    return image.crop(box)

def main() -> None:
    missing = [n for n in TARGETS if not (SOURCE / n).is_file()]
    if missing:
        print(f"missing: {missing}")
        return
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for src_name, tgt_size in TARGETS.items():
        src_path = SOURCE / src_name
        out_path = DESTINATION / f"{src_path.stem}.webp"
        with Image.open(src_path) as opened:
            img = opened.convert("RGB")
            cropped = center_crop_to_ratio(img, *tgt_size)
            resized = cropped.resize(tgt_size, Image.Resampling.LANCZOS)
            resized.save(out_path, "WEBP", quality=90, method=6, exact=True)
        print(f"{src_name} -> {tgt_size} WebP  {resized.size}")

if __name__ == "__main__":
    main()
