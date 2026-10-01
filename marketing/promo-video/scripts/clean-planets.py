"""Copies the app's designed planet artwork into public/planets3d/ and removes
the baked-in transparency checkerboard some files have around the planet.

Checker pixels are low-saturation grey/white/black; the planet body, glowing
rings and sparkles are saturated. Low-saturation pixels outside the planet
core are made transparent, then the alpha edge is softened.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parents[1] / "app_main" / "assets" / "images" / "planets"
DST = ROOT / "public" / "planets3d"
DST.mkdir(parents=True, exist_ok=True)

# Files with a visible baked checkerboard halo (checked visually).
DIRTY = {"planet-maharat", "planet-iman", "planet-tarikh"}
CORE = {"planet-maharat": 0.31, "planet-iman": 0.36, "planet-tarikh": 0.29}

for src in sorted(SRC.glob("planet-*.webp")):
    im = Image.open(src).convert("RGBA")
    if src.stem in DIRTY:
        a = np.asarray(im).astype(np.float32) / 255.0
        rgb, alpha = a[..., :3], a[..., 3]
        mx, mn = rgb.max(-1), rgb.min(-1)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        h, w = alpha.shape
        yy, xx = np.mgrid[0:h, 0:w]
        r = np.hypot(xx - w / 2, yy - h / 2) / w
        # Light checker tiles are greyish; dark tiles are near-black navy.
        checker = ((sat < 0.32) | (mx < 0.32)) & (r > CORE[src.stem])
        alpha = np.where(checker, 0.0, alpha)
        mask = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
        mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        im.putalpha(mask)
    im.save(DST / f"{src.stem}.png")
    print("ok", src.stem, "(cleaned)" if src.stem in DIRTY else "")
