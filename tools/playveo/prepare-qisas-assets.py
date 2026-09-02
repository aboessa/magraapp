"""Convert qisas-min-alhayat JPEGs to WebP for Flutter"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
STORIES = [
    ("the-promised-friday", 18),
    ("nine-metres", 18),
    ("taller-than-me", 20),
    ("the-key-that-was-left", 16),
    ("the-extra-page", 18),
]

def crop(img, tw, th):
    sw, sh = img.size
    tr = tw/th
    sr = sw/sh
    if sr>tr:
        cw=round(sh*tr)
        left=(sw-cw)//2
        box=(left,0,left+cw,sh)
    else:
        ch=round(sw/tr)
        top=(sh-ch)//2
        box=(0,top,sw,top+ch)
    return img.crop(box)

def process(slug, pages):
    src = ROOT/f"tools/playveo/output/qml-{slug}"
    dst = ROOT/f"app_main/assets/images/stories/qml-{slug}-playveo"
    dst.mkdir(parents=True, exist_ok=True)
    targets={}
    for i in range(1, pages+1):
        targets[f"page-{i:03d}.jpg"]=(1920,1080)
    targets.update({"cover.jpg":(1200,1200),"hero.jpg":(1920,1080),"thumb.jpg":(900,1200)})
    ok=0
    for name, size in targets.items():
        sp=src/name
        if not sp.is_file():
            print(f"  {slug}: missing {name}")
            continue
        dp=dst/f"{Path(name).stem}.webp"
        try:
            with Image.open(sp) as im:
                img=im.convert("RGB")
                cr=crop(img,*size)
                rs=cr.resize(size, Image.Resampling.LANCZOS)
                rs.save(dp,"WEBP",quality=88,method=6)
            ok+=1
            print(f"  {slug}/{name} -> {size}")
        except Exception as e:
            print(f"  {slug}/{name} FAIL {e}")
    print(f" DONE {slug} {ok}/{len(targets)}")

for slug,pages in STORIES:
    process(slug,pages)

print("\nAll qisas WebP done")
