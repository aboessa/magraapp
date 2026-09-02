#!/usr/bin/env python
"""
complete_drawing_images.py — image encoding for the "complete the drawing" pack.

WHY THIS EXISTS
---------------
The provider returns JPEG, always. Verified live by
tools/playveo/probe-complete-drawing.mjs:

    url:            .../ca0d26e5-...-0.jpg
    content-type:   image/jpeg
    magic:          ffd8ffe0  -> JPEG

The activity pack ships reference_full.png and challenge.png. Saving the
provider bytes straight to those paths, which is what the old generator did via
copyFileSync, produces a file whose extension lies: a JPEG named .png. Some
image loaders sniff magic bytes and cope, others trust the extension and fail,
and a .jpg thumbnail that is really a PNG is the same bug pointing the other way.

So the bytes get re-encoded here instead of renamed. There is no sharp / jimp /
canvas in node_modules (the project has no package.json at the repo root), and
Pillow is present, so Python owns the encode step.

Commands:
  png    <src> <dst>            re-encode to real PNG (no alpha, flattened on white)
  thumb  <src> <dst> [size]     square-ish contained thumbnail, real PNG
  verify <path> [...]           report magic bytes / format / size per file
"""
import sys
from PIL import Image


def _open_flat(src):
    """Open and flatten onto white.

    The artwork is specified on a white or very light warm background, so any
    alpha or palette weirdness is flattened to opaque RGB rather than carried
    into the PNG. This keeps the two images in a pair byte-comparable in mode.
    """
    im = Image.open(src)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


def _save(im, dst):
    """Save in the format the destination EXTENSION promises.

    This is the whole point of the module: the file name and the encoded bytes
    must agree. thumbnail.jpg gets real JPEG, *.png gets real PNG.
    """
    ext = dst.rsplit(".", 1)[-1].lower()
    if ext in ("jpg", "jpeg"):
        im.save(dst, format="JPEG", quality=88, optimize=True, progressive=True)
    elif ext == "png":
        im.save(dst, format="PNG", optimize=True)
    else:
        raise ValueError(f"unsupported destination extension: .{ext}")


def to_png(src, dst):
    im = _open_flat(src)
    _save(im, dst)
    return im.size


def to_thumb(src, dst, size=512):
    im = _open_flat(src)
    im.thumbnail((size, size), Image.LANCZOS)
    _save(im, dst)
    return im.size


def verify(paths):
    bad = 0
    for p in paths:
        try:
            with open(p, "rb") as fh:
                magic = fh.read(8)
            im = Image.open(p)
            declared = p.rsplit(".", 1)[-1].lower()
            actual = (im.format or "").lower()
            match = (declared == "png" and actual == "png") or (
                declared in ("jpg", "jpeg") and actual == "jpeg"
            )
            if not match:
                bad += 1
            print(
                f"{'ok ' if match else 'BAD'} {p}  format={im.format} "
                f"mode={im.mode} size={im.size[0]}x{im.size[1]} magic={magic[:4].hex()}"
            )
        except Exception as exc:  # noqa: BLE001 - report and keep going
            bad += 1
            print(f"BAD {p}  {type(exc).__name__}: {exc}")
    return bad


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "png":
        w, h = to_png(sys.argv[2], sys.argv[3])
        print(f"png {w}x{h}")
        return 0
    if cmd == "thumb":
        size = int(sys.argv[4]) if len(sys.argv) > 4 else 512
        w, h = to_thumb(sys.argv[2], sys.argv[3], size)
        print(f"thumb {w}x{h}")
        return 0
    if cmd == "verify":
        return 1 if verify(sys.argv[2:]) else 0
    print(f"unknown command: {cmd}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
