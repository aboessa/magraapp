"""Optimize and validate Majarra Wave game artwork.

This is deterministic pixel processing only. It does not generate content and it
never contacts PlayVeo. Sources come from the controlled download/removal phase.

Outputs:
- canonical WebP/PNG assets under app_main/assets/images/games/wave/
- one intentional square thumbnail per game
- tools/playveo/wave-assets-qc.json with alpha and set-consistency evidence
- canonical file metadata written back into wave-production.jobs.json
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "tools" / "playveo" / "wave-visual.manifest.json"
STATE_PATH = ROOT / "tools" / "playveo" / "wave-production.jobs.json"
REPORT_PATH = ROOT / "tools" / "playveo" / "wave-assets-qc.json"
TRANSPARENT_CANVAS = 768
TRANSPARENT_SUBJECT_MAX = 680


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def threshold_bbox(alpha: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    return alpha.point(lambda value: 255 if value > threshold else 0).getbbox()


def expand_bbox(
    box: tuple[int, int, int, int],
    width: int,
    height: int,
    fraction: float = 0.045,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    padding = max(4, round(max(right - left, bottom - top) * fraction))
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )


def clear_fully_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = list(rgba.getdata())
    cleaned = [(0, 0, 0, 0) if alpha == 0 else (red, green, blue, alpha)
               for red, green, blue, alpha in pixels]
    rgba.putdata(cleaned)
    return rgba


def canonical_transparent(image: Image.Image, allow_upscale: bool = False) -> Image.Image:
    rgba = clear_fully_transparent_rgb(image)
    if allow_upscale:
        # Sheet quadrants can retain a near-invisible alpha veil after provider
        # background removal. Ignore that veil when finding the real subject,
        # while preserving normal antialiased edges around the foreground.
        alpha = rgba.getchannel("A").point(lambda value: 0 if value <= 12 else value)
        rgba.putalpha(alpha)
        box = threshold_bbox(alpha, threshold=96)
    else:
        box = threshold_bbox(rgba.getchannel("A"))
    if box is None:
        raise ValueError("transparent output contains no visible subject")
    crop = rgba.crop(expand_bbox(box, rgba.width, rgba.height))
    scale = min(TRANSPARENT_SUBJECT_MAX / crop.width, TRANSPARENT_SUBJECT_MAX / crop.height)
    if not allow_upscale:
        scale = min(scale, 1.0)
    target_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    if target_size != crop.size:
        crop = crop.resize(target_size, Image.Resampling.LANCZOS)
    if allow_upscale:
        crop.putalpha(crop.getchannel("A").point(lambda value: 0 if value <= 3 else value))
    canvas = Image.new("RGBA", (TRANSPARENT_CANVAS, TRANSPARENT_CANVAS), (0, 0, 0, 0))
    position = ((TRANSPARENT_CANVAS - crop.width) // 2, (TRANSPARENT_CANVAS - crop.height) // 2)
    canvas.alpha_composite(crop, position)
    return clear_fully_transparent_rgb(canvas)


def focal_crop_square(image: Image.Image, focal_x: float, focal_y: float) -> Image.Image:
    rgb = image.convert("RGB")
    side = min(rgb.width, rgb.height)
    center_x = focal_x * rgb.width
    center_y = focal_y * rgb.height
    left = round(max(0, min(rgb.width - side, center_x - side / 2)))
    top = round(max(0, min(rgb.height - side, center_y - side / 2)))
    return rgb.crop((left, top, left + side, top + side))


def crop_to_four_three(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    current = rgb.width / rgb.height
    target = 4 / 3
    if abs(current - target) < 0.005:
        return rgb
    if current > target:
        target_width = round(rgb.height * target)
        left = (rgb.width - target_width) // 2
        return rgb.crop((left, 0, left + target_width, rgb.height))
    target_height = round(rgb.width / target)
    top = (rgb.height - target_height) // 2
    return rgb.crop((0, top, rgb.width, top + target_height))


def cap_size(image: Image.Image, maximum: tuple[int, int]) -> Image.Image:
    if image.width <= maximum[0] and image.height <= maximum[1]:
        return image
    copy = image.copy()
    copy.thumbnail(maximum, Image.Resampling.LANCZOS)
    return copy


def flood_fill_hole_metrics(alpha: Image.Image) -> tuple[float, int]:
    small = alpha.resize((128, 128), Image.Resampling.BILINEAR)
    mask = [value > 32 for value in small.getdata()]
    width = height = 128
    outside = [False] * len(mask)
    queue: deque[tuple[int, int]] = deque()

    def add_if_background(x: int, y: int) -> None:
        index = y * width + x
        if not mask[index] and not outside[index]:
            outside[index] = True
            queue.append((x, y))

    for x in range(width):
        add_if_background(x, 0)
        add_if_background(x, height - 1)
    for y in range(height):
        add_if_background(0, y)
        add_if_background(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                add_if_background(nx, ny)

    holes = sum(1 for index, visible in enumerate(mask) if not visible and not outside[index])

    visited = [False] * len(mask)
    components = 0
    for index, visible in enumerate(mask):
        if not visible or visited[index]:
            continue
        component_size = 0
        queue = deque([(index % width, index // width)])
        visited[index] = True
        while queue:
            x, y = queue.popleft()
            component_size += 1
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    neighbor = ny * width + nx
                    if mask[neighbor] and not visited[neighbor]:
                        visited[neighbor] = True
                        queue.append((nx, ny))
        if component_size >= 5:
            components += 1

    return holes / (width * height), components


def alpha_metrics(image: Image.Image) -> dict[str, Any]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    values = list(alpha.getdata())
    total = len(values)
    transparent = sum(value == 0 for value in values)
    semi = sum(0 < value < 255 for value in values)
    visible = total - transparent
    box = threshold_bbox(alpha)
    if box is None:
        box = (0, 0, 0, 0)
    left, top, right, bottom = box
    margins = {
        "left": left,
        "top": top,
        "right": rgba.width - right,
        "bottom": rgba.height - bottom,
    }

    rgba_data = list(rgba.getdata())
    edge_pixels = [(red, green, blue, a) for red, green, blue, a in rgba_data if 0 < a < 250]
    near_white = sum(red > 245 and green > 245 and blue > 245 for red, green, blue, _ in edge_pixels)
    near_dark = sum(red < 10 and green < 10 and blue < 10 for red, green, blue, _ in edge_pixels)
    edge_count = max(1, len(edge_pixels))
    hole_ratio, components = flood_fill_hole_metrics(alpha)

    corners = [
        alpha.getpixel((0, 0)),
        alpha.getpixel((rgba.width - 1, 0)),
        alpha.getpixel((0, rgba.height - 1)),
        alpha.getpixel((rgba.width - 1, rgba.height - 1)),
    ]
    warnings: list[str] = []
    failures: list[str] = []
    transparent_ratio = transparent / total
    visible_ratio = visible / total
    if alpha.getextrema()[0] != 0:
        failures.append("alpha_has_no_fully_transparent_pixels")
    if max(corners) > 0:
        failures.append("one_or_more_corners_are_not_transparent")
    if visible_ratio < 0.03:
        failures.append("visible_subject_is_too_small_or_missing")
    if visible_ratio > 0.88:
        failures.append("background_likely_remains")
    if min(margins.values()) < 12:
        failures.append("subject_touches_canvas_edge")
    if hole_ratio > 0.025:
        warnings.append("possible_internal_transparent_holes_manual_review")
    if components > 8:
        warnings.append("possible_background_fragments_or_multi_part_subject_manual_review")
    if near_white / edge_count > 0.45:
        warnings.append("high_white_semtransparent_edge_ratio_manual_halo_review")
    if near_dark / edge_count > 0.45:
        warnings.append("high_dark_semtransparent_edge_ratio_manual_fringe_review")

    return {
        "mode": rgba.mode,
        "size": [rgba.width, rgba.height],
        "alpha_extrema": list(alpha.getextrema()),
        "transparent_ratio": round(transparent_ratio, 5),
        "semi_transparent_ratio": round(semi / total, 5),
        "visible_ratio": round(visible_ratio, 5),
        "subject_bbox": list(box),
        "margins_px": margins,
        "corner_alpha": corners,
        "possible_hole_ratio": round(hole_ratio, 5),
        "visible_components_128px": components,
        "white_semtransparent_edge_ratio": round(near_white / edge_count, 5),
        "dark_semtransparent_edge_ratio": round(near_dark / edge_count, 5),
        "warnings": warnings,
        "failures": failures,
        "status": "FAIL" if failures else ("WARN" if warnings else "PASS"),
    }


def opaque_metrics(image: Image.Image) -> dict[str, Any]:
    rgb = image.convert("RGB")
    stat = ImageStat.Stat(rgb.resize((64, 64), Image.Resampling.BILINEAR))
    aspect = rgb.width / rgb.height
    failures: list[str] = []
    warnings: list[str] = []
    if rgb.width < 600 or rgb.height < 450:
        failures.append("resolution_below_minimum_600x450")
    if abs(aspect - 4 / 3) > 0.02:
        failures.append("aspect_ratio_not_four_three")
    if min(stat.mean) < 18:
        warnings.append("very_dark_channel_manual_contrast_review")
    if max(stat.mean) > 242:
        warnings.append("very_bright_channel_manual_contrast_review")
    return {
        "mode": rgb.mode,
        "size": [rgb.width, rgb.height],
        "aspect_ratio": round(aspect, 5),
        "mean_rgb": [round(value, 2) for value in stat.mean],
        "warnings": warnings,
        "failures": failures,
        "status": "FAIL" if failures else ("WARN" if warnings else "PASS"),
    }


def target_quality(job: dict[str, Any]) -> int:
    if job["asset"] == "cover":
        return 88
    if "background" in job["asset"]:
        return 84
    return 88


def process_job(job: dict[str, Any]) -> dict[str, Any]:
    source_relative = job.get("removed_file") if job.get("transparent_required") else job.get("source_file")
    if not source_relative:
        raise ValueError(f"{job['key']} has no processable source")
    source = ROOT / source_relative
    target = ROOT / job["target_file"]
    target.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as opened:
        opened.load()
        if job.get("transparent_required"):
            canonical = canonical_transparent(
                opened,
                allow_upscale=job.get("generation_method") == "set_sheet_crop",
            )
            canonical.save(target, "PNG", optimize=True, compress_level=9)
            metrics = alpha_metrics(canonical)
        else:
            canonical = cap_size(crop_to_four_three(opened), (1600, 1200))
            canonical.save(target, "WEBP", quality=target_quality(job), method=6)
            metrics = opaque_metrics(canonical)

    job["optimized"] = True
    job["optimized_at"] = utc_now()
    job["target_bytes"] = target.stat().st_size
    job["target_checksum_sha256"] = digest(target)
    job["quality_status"] = metrics["status"]
    job["quality_failures"] = metrics["failures"]
    job["quality_warnings"] = metrics["warnings"]
    return {
        "key": job["key"],
        "game_id": job["game_id"],
        "asset": job["asset"],
        "member": job.get("member"),
        "source_file": source_relative,
        "target_file": job["target_file"],
        "source_checksum_sha256": job.get("removed_checksum_sha256")
        if job.get("transparent_required") else job.get("source_checksum_sha256"),
        "target_checksum_sha256": job["target_checksum_sha256"],
        "target_bytes": job["target_bytes"],
        "transparent": bool(job.get("transparent_required")),
        "metrics": metrics,
    }


def thumbnail_specs(manifest: dict[str, Any]) -> dict[str, tuple[float, float]]:
    specs: dict[str, tuple[float, float]] = {}
    for game in manifest["games"]:
        thumbnail = next(asset for asset in game["assets"] if asset["asset"] == "thumbnail")
        focal = thumbnail.get("focal_point", [0.5, 0.5])
        specs[game["game_id"]] = (float(focal[0]), float(focal[1]))
    return specs


def create_thumbnails(
    state: dict[str, Any],
    manifest: dict[str, Any],
) -> list[dict[str, Any]]:
    specs = thumbnail_specs(manifest)
    entries: list[dict[str, Any]] = []
    for game_id, focal in specs.items():
        cover_job = next(job for job in state["jobs"] if job["game_id"] == game_id and job["asset"] == "cover")
        cover = ROOT / cover_job["target_file"]
        thumbnail = cover.parent / "thumbnail.webp"
        with Image.open(cover) as image:
            square = focal_crop_square(image, focal[0], focal[1])
            square = square.resize((800, 800), Image.Resampling.LANCZOS)
            square.save(thumbnail, "WEBP", quality=86, method=6)
        cover_job["thumbnail_file"] = rel(thumbnail)
        cover_job["thumbnail_checksum_sha256"] = digest(thumbnail)
        cover_job["thumbnail_bytes"] = thumbnail.stat().st_size
        entries.append({
            "game_id": game_id,
            "source_cover": rel(cover),
            "thumbnail_file": rel(thumbnail),
            "focal_point": list(focal),
            "size": [800, 800],
            "bytes": thumbnail.stat().st_size,
            "checksum_sha256": cover_job["thumbnail_checksum_sha256"],
            "status": "PENDING_CONTACT_SHEET_REVIEW",
        })
    return entries


def set_consistency(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for entry in entries:
        if not entry["member"]:
            continue
        grouped.setdefault((entry["game_id"], entry["asset"]), []).append(entry)

    result: list[dict[str, Any]] = []
    for (game_id, asset), members in grouped.items():
        if len(members) < 2:
            continue
        statuses = [member["metrics"]["status"] for member in members]
        visible_values = [member["metrics"].get("visible_ratio") for member in members]
        if any(value is None for value in visible_values):
            result.append({
                "game_id": game_id,
                "asset_set": asset,
                "members": [member["member"] for member in members],
                "visible_ratio_min": None,
                "visible_ratio_max": None,
                "visible_ratio_spread": None,
                "status": "MANUAL_REVIEW_REQUIRED",
                "reason": "opaque_set_has_no_reliable_automated_style_consistency_metric",
                "manual_style_review_required": True,
            })
            continue
        visible = [float(value) for value in visible_values if value is not None]
        ratio = max(visible) / max(min(visible), 0.00001)
        status = "FAIL" if "FAIL" in statuses or ratio > 1.8 else ("WARN" if "WARN" in statuses or ratio > 1.45 else "PASS")
        result.append({
            "game_id": game_id,
            "asset_set": asset,
            "members": [member["member"] for member in members],
            "visible_ratio_min": round(min(visible), 5),
            "visible_ratio_max": round(max(visible), 5),
            "visible_ratio_spread": round(ratio, 4),
            "status": status,
            "manual_style_review_required": True,
        })
    return result


def main() -> None:
    manifest = load_json(MANIFEST_PATH)
    state = load_json(STATE_PATH)
    pending_set_transports = [
        job["key"] for job in state["jobs"] if job.get("coherent_set_transport")
    ]
    if pending_set_transports:
        raise SystemExit(
            "Refusing canonical processing while coherent set sheets still require extraction/adoption: "
            + ", ".join(pending_set_transports)
        )
    asset_entries: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for index, job in enumerate(state["jobs"], start=1):
        try:
            entry = process_job(job)
            asset_entries.append(entry)
            print(f"[{index}/{len(state['jobs'])}] optimized {job['key']} -> {entry['metrics']['status']}")
            if entry["metrics"]["failures"]:
                failures.append({"key": job["key"], "failures": entry["metrics"]["failures"]})
        except Exception as error:  # Keep a complete report rather than hiding later failures.
            job["optimized"] = False
            job["quality_status"] = "FAIL"
            job["quality_failures"] = [str(error)]
            failures.append({"key": job["key"], "failures": [str(error)]})
            print(f"[{index}/{len(state['jobs'])}] FAILED {job['key']}: {error}")

    thumbnails = create_thumbnails(state, manifest)
    consistency = set_consistency(asset_entries)
    warnings = [
        {"key": entry["key"], "warnings": entry["metrics"]["warnings"]}
        for entry in asset_entries if entry["metrics"]["warnings"]
    ]
    report = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "manifest_id": manifest["manifest_id"],
        "summary": {
            "generated_assets": len(state["jobs"]),
            "canonical_assets_written": len(asset_entries),
            "transparent_assets": sum(entry["transparent"] for entry in asset_entries),
            "opaque_assets": sum(not entry["transparent"] for entry in asset_entries),
            "thumbnails_written": len(thumbnails),
            "automatic_pass": sum(entry["metrics"]["status"] == "PASS" for entry in asset_entries),
            "automatic_warn": sum(entry["metrics"]["status"] == "WARN" for entry in asset_entries),
            "automatic_fail": sum(entry["metrics"]["status"] == "FAIL" for entry in asset_entries),
            "set_consistency_pass": sum(entry["status"] == "PASS" for entry in consistency),
            "set_consistency_warn": sum(entry["status"] == "WARN" for entry in consistency),
            "set_consistency_fail": sum(entry["status"] == "FAIL" for entry in consistency),
            "set_consistency_manual_review": sum(
                entry["status"] == "MANUAL_REVIEW_REQUIRED" for entry in consistency
            ),
            "contact_sheet_review": "PENDING",
        },
        "failures": failures,
        "warnings": warnings,
        "set_consistency": consistency,
        "thumbnails": thumbnails,
        "assets": asset_entries,
    }
    state["asset_processing"] = {
        "processed_at": report["generated_at"],
        "report_file": rel(REPORT_PATH),
        "canonical_assets_written": len(asset_entries),
        "thumbnails_written": len(thumbnails),
        "automatic_failures": len(failures),
        "contact_sheet_review": "PENDING",
    }
    save_json(REPORT_PATH, report)
    save_json(STATE_PATH, state)
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
