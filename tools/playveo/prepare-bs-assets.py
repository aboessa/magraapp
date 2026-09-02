"""Convert bs-s1..bs-s6 raw JPEG proofs to optimized Flutter WebP assets.
Based on prepare-act-s3-assets.py pattern.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

# Matches our generation: 12 pages + cover/hero/thumb = 15 per bedtime story
STORIES = ["bs-s1", "bs-s2", "bs-s3", "bs-s4", "bs-s5", "bs-s6"]

TARGETS_PER_STORY = {
    **{f"page-{p:03d}.jpg": (1920, 1080) for p in range(1, 13)},
    "cover.jpg": (1200, 1200),
    "hero.jpg": (1920, 1080),
    "thumb.jpg": (900, 1200),
}

def center_crop_to_ratio(img: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = img.size
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
    return img.crop(box)

def process_story(story: str):
    src_dir = ROOT / "tools" / "playveo" / "output" / story
    dst_dir = ROOT / "app_main" / "assets" / "images" / "stories" / f"{story}-playveo"
    print(f"\n=== {story} ===")
    missing = [n for n in TARGETS_PER_STORY if not (src_dir / n).is_file()]
    if missing:
        print(f"  ⚠️ missing sources: {missing}")
        return False
    dst_dir.mkdir(parents=True, exist_ok=True)
    expected=set()
    ok=0
    for src_name, tgt_size in TARGETS_PER_STORY.items():
        src_path = src_dir / src_name
        out_path = dst_dir / f"{src_path.stem}.webp"
        expected.add(out_path.name)
        try:
            with Image.open(src_path) as im:
                img = im.convert("RGB")
                cropped = center_crop_to_ratio(img, *tgt_size)
                resized = cropped.resize(tgt_size, Image.Resampling.LANCZOS)
                resized.save(out_path, "WEBP", quality=88, method=6, exact=True)
            with Image.open(out_path) as v:
                if v.size != tgt_size or v.format != "WEBP":
                    print(f"  ❌ invalid {out_path} {v.format} {v.size}")
                    continue
            print(f"  {src_name} -> {tgt_size} WebP")
            ok+=1
        except Exception as e:
            print(f"  ❌ {src_name}: {e}")
    # also copy jpegs as fallback for backward compat (already done by bulk producer)
    # cleanup unexpected? keep only expected webp
    print(f"  ✅ {ok}/{len(TARGETS_PER_STORY)} WebP for {story}")
    return ok==len(TARGETS_PER_STORY)

def main():
    all_ok=True
    for s in STORIES:
        if not process_story(s):
            all_ok=False
    if all_ok:
        print("\n🎉 All BS stories converted to WebP")
    else:
        print("\n⚠️ Some stories missing sources – check output dirs")

if __name__=="__main__":
    main()
