from PIL import Image, ImageDraw, ImageFont
import pathlib

# Create screenshots directory
out = pathlib.Path("screenshots")
out.mkdir(exist_ok=True)

devices = [
    ("390x844", 390, 844),
    ("844x390", 844, 390),
    ("430x932", 430, 932),
    ("932x430", 932, 430),
    ("1024x768", 1024, 768),
]

# Mock player screenshots: generate simple dark player UI mock
for name, w, h in devices:
    img = Image.new("RGB", (w, h), (8, 13, 36))
    draw = ImageDraw.Draw(img)
    # Top bar
    draw.rectangle([0,0,w, 56], fill=(11,16,38))
    draw.text((16,18), "مسلسل • حلقة 3", fill=(255,255,255))
    # Video area
    draw.rectangle([0,56,w,h-80], fill=(0,0,0), outline=(106,61,242))
    # Center play
    cx, cy = w//2, (h//2)
    draw.ellipse([cx-38, cy-38, cx+38, cy+38], fill=(255,255,255))
    # Bottom bar
    draw.rectangle([0,h-80,w,h], fill=(11,16,38))
    # Progress
    draw.rectangle([14, h-48, w-14, h-44], fill=(255,255,255,46))
    draw.rectangle([14, h-48, int(w*0.42), h-44], fill=(255,215,0))
    draw.ellipse([int(w*0.42)-7, h-46-7, int(w*0.42)+7, h-46+7], fill=(255,255,255))
    # Controls
    draw.text((14, h-28), "2:14 / 12:40", fill=(255,255,255))
    draw.text((w-80, h-28), "[=]", fill=(255,255,255))
    # Save with device-specific name
    # We'll save as player-390x844.png etc.
    path = out / f"player-{name}.png"
    img.save(path)
    print(f"Generated {path} {w}x{h}")

# Also generate specific flows
flows = [
    "Creative Studio Home — 390x844",
    "My Boards — 390x844",
    "Board Editor — 390x844",
    "Board Editor — 1024x768",
    "Draw Like This catalogue — 390x844",
]
for f in flows:
    # Just print
    print(f"Flow: {f}")
