#!/usr/bin/env python3
"""Create provenance-honest coherent set sheets and derive canonical Wave assets.

The three provider sheets are intermediate production evidence. They never become
manifest assets and therefore do not change the 89 canonical-asset count.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / "tools/playveo/wave-production.jobs.json"
ARCHIVE_ROOT = ROOT / "tools/playveo/archive/wave/coherent-sets"
OUTPUT_ROOT = ROOT / "tools/playveo/output/wave/coherent-sets"
EVIDENCE_ROOT = ROOT / "tools/playveo/contact-sheets/wave-coherent-sets"

SETS: dict[str, dict[str, Any]] = {
    "wave1-memory-animals-animal-pair-set": {
        "game_id": "game-wave1-memory-animals",
        "layout": "grid_2x2",
        "aspect_ratio": "1:1",
        "transparent": True,
        "source_job_key": "game-wave1-memory-animals/animal-cat",
        "member_job_keys": [
            "game-wave1-memory-animals/animal-cat",
            "game-wave1-memory-animals/animal-bird",
            "game-wave1-memory-animals/animal-fish",
            "game-wave1-memory-animals/animal-rabbit",
        ],
        "rejection_reason": "Separate generations remained stylistically inconsistent; superseded by one coherent sprite sheet",
        "prompt": (
            "Majarra premium children's memory-game production sprite sheet for ages 3-5. "
            "Exactly four friendly animal tokens on one perfectly plain solid white square canvas in a clean 2x2 layout, "
            "with wide empty white gutters and no overlap. Fixed order: top-left one ginger cat head-and-shoulders portrait; "
            "top-right one small blue bird forward portrait; bottom-left one complete orange fish in side view with no bowl; "
            "bottom-right one white rabbit head-and-shoulders portrait with both ears visible. Every animal must use the exact "
            "same polished 2D storybook style, medium rounded deep-navy outline, soft cel shading, warm light, eye design, "
            "detail level, apparent scale, and camera. Each quadrant contains one animal only. No boxes, cards, borders, "
            "frames, circles, medallions, scenery, shadows joining quadrants, text, letters, numbers, logos, or watermark."
        ),
    },
    "wave1-sequence-kids-sequence-card-set": {
        "game_id": "game-wave1-sequence-kids",
        "layout": "vertical_3",
        "aspect_ratio": "9:16",
        "transparent": False,
        "source_job_key": "game-wave1-sequence-kids/sequence-seed",
        "member_job_keys": [
            "game-wave1-sequence-kids/sequence-seed",
            "game-wave1-sequence-kids/sequence-sprout",
            "game-wave1-sequence-kids/sequence-tree",
        ],
        "rejection_reason": "Separate cards did not preserve identical frame, pot, watering can, camera, and lighting; superseded by one coherent sheet",
        "prompt": (
            "Majarra premium children's sequence-game production sheet for ages 6-8. Exactly three separate landscape 4:3 "
            "picture cards stacked vertically from top to bottom on a 9:16 plain white canvas, perfectly centered, equal size, "
            "with generous pure-white gutters and no overlap. All three cards must have the exact same cream rounded border, "
            "pale greenhouse wall, wooden tabletop, terracotta pot shape and position, small red watering can at lower right, "
            "gentle front three-quarter camera, warm daylight, and polished 2D storybook style. Top card: one clearly visible "
            "brown seed resting in the soil, no sprout. Middle card: the same pot with one small two-leaf green sprout while the "
            "same red watering can waters it. Bottom card: the same pot with one small healthy apple tree bearing exactly three "
            "red apples and the same watering can beside it. This is one vertical extraction sheet, not nested storyboards: one "
            "card per row only. No extra cards, arrows, labels, text, letters, numbers, logos, signatures, or watermark."
        ),
    },
    "wave2-memory-2-animal-pair-set": {
        "game_id": "game-wave2-memory-2",
        "layout": "grid_2x2_three",
        "aspect_ratio": "1:1",
        "transparent": True,
        "source_job_key": "game-wave2-memory-2/animal-lion",
        "member_job_keys": [
            "game-wave2-memory-2/animal-lion",
            "game-wave2-memory-2/animal-turtle",
            "game-wave2-memory-2/animal-owl",
        ],
        "rejection_reason": "Separate generations retained inconsistent framing and an embedded lion medallion; superseded by one coherent sprite sheet",
        "prompt": (
            "Majarra premium children's field-journal memory-game production sprite sheet for ages 6-8. Exactly three "
            "friendly animal tokens on one perfectly plain solid white square canvas in a clean 2x2 layout with the "
            "bottom-right quadrant completely empty. Fixed order: top-left one young lion facing forward with complete mane; "
            "top-right one green turtle angled slightly forward with complete shell, head, and limbs; bottom-left one tawny owl "
            "facing forward with both ear tufts and wings visible. Every animal must use the exact same polished 2D naturalist "
            "storybook style, medium deep-navy outline, soft moonlit rim light, eye treatment, detail level, apparent scale, and "
            "camera. Wide empty white gutters, one animal per occupied quadrant. No boxes, cards, borders, rings, circles, "
            "medallions, badges, scenery, text, letters, numbers, logos, signatures, or watermark."
        ),
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_state() -> dict[str, Any]:
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = utc_now()
    temporary = STATE_PATH.with_suffix(STATE_PATH.suffix + ".tmp")
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(STATE_PATH)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def absolute(path: str) -> Path:
    return ROOT / Path(path)


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def prompt_digest(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()


def job_map(state: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {job["key"]: job for job in state["jobs"]}


def copy_verified(source: Path, destination: Path, expected: str | None = None) -> dict[str, Any]:
    if not source.is_file():
        raise FileNotFoundError(f"Required production evidence is missing: {relative(source)}")
    actual = digest(source)
    if expected and actual != expected:
        raise ValueError(f"Checksum mismatch before archive: {relative(source)}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and digest(destination) != actual:
        raise ValueError(f"Archive collision with different bytes: {relative(destination)}")
    if not destination.exists():
        shutil.copy2(source, destination)
    if digest(destination) != actual:
        raise ValueError(f"Archive verification failed: {relative(destination)}")
    return {"file": relative(destination), "bytes": destination.stat().st_size, "sha256": actual}


def archive_member(set_key: str, job: dict[str, Any], reason: str) -> dict[str, Any]:
    provider_id = str(job.get("job_id") or "local-unknown")
    member = str(job.get("member") or job.get("asset") or "asset")
    folder = ARCHIVE_ROOT / set_key / member / provider_id
    archived: dict[str, Any] = {}
    specs = [
        ("source", job.get("source_file"), job.get("source_checksum_sha256")),
        ("removed", job.get("removed_file"), job.get("removed_checksum_sha256")),
        ("target", job.get("target_file"), job.get("target_checksum_sha256")),
    ]
    for label, source_value, expected in specs:
        if not source_value:
            continue
        source = absolute(str(source_value))
        destination = folder / f"{label}{source.suffix.lower()}"
        archived[label] = copy_verified(source, destination, str(expected) if expected else None)

    return {
        "job_id": job.get("job_id"),
        "status": "rejected_visual",
        "provider_status": job.get("status"),
        "provider_model": job.get("provider_model"),
        "credit_cost": job.get("credit_cost"),
        "submitted_at": job.get("submitted_at"),
        "completed_at": job.get("completed_at"),
        "review_reason": reason,
        "result_count": job.get("result_count"),
        "prompt": job.get("prompt"),
        "prompt_sha256": job.get("prompt_sha256"),
        "source_checksum_sha256": job.get("source_checksum_sha256"),
        "removed_checksum_sha256": job.get("removed_checksum_sha256"),
        "target_checksum_sha256": job.get("target_checksum_sha256"),
        "transparent_required": bool(job.get("transparent_required")),
        "background_removal_required": bool(job.get("background_removal_required")),
        "aspect_ratio": job.get("aspect_ratio"),
        "archived_files": archived,
        "superseded_by_set_source": set_key,
        "archived_at": utc_now(),
    }


def reset_transport_job(job: dict[str, Any], record: dict[str, Any]) -> None:
    job["operation"] = "text-to-image"
    job["route_kind"] = "image"
    job["aspect_ratio"] = record["aspect_ratio"]
    job["prompt"] = record["prompt"]
    job["prompt_sha256"] = record["prompt_sha256"]
    job["source_file"] = record["source_file"]
    job["transparent_required"] = False
    job["background_removal_required"] = False
    job["generation_method"] = "coherent_set_sheet_transport"
    job["coherent_set_transport"] = record["key"]
    for key, value in {
        "status": "planned",
        "job_id": None,
        "provider_model": None,
        "credit_cost": None,
        "submitted_at": None,
        "completed_at": None,
        "last_polled_at": None,
        "error": None,
        "result_count": 0,
        "downloaded": False,
        "downloaded_at": None,
        "download_error": None,
        "source_mime": None,
        "source_bytes": None,
        "source_checksum_sha256": None,
        "background_removed": False,
        "background_removal_status": "not_applicable_intermediate_sheet",
        "background_removal_started_at": None,
        "background_removal_completed_at": None,
        "background_removal_error": None,
        "removed_file": None,
        "removed_mime": None,
        "removed_bytes": None,
        "removed_checksum_sha256": None,
        "optimized": False,
        "optimized_at": None,
        "target_bytes": None,
        "target_checksum_sha256": None,
        "quality_status": "PENDING_SET_EXTRACTION",
        "quality_failures": [],
        "quality_warnings": [],
    }.items():
        job[key] = value


def prepare(state: dict[str, Any]) -> None:
    if state.get("set_sources"):
        raise ValueError("set_sources already exists; refuse to archive or reset the same canonical members twice")
    jobs = job_map(state)
    member_keys = [key for config in SETS.values() for key in config["member_job_keys"]]
    if len(member_keys) != len(set(member_keys)):
        raise ValueError("Coherent-set member definitions overlap")
    missing = [key for key in member_keys if key not in jobs]
    if missing:
        raise ValueError(f"Missing canonical jobs: {missing}")
    for key in member_keys:
        job = jobs[key]
        if job.get("status") != "completed" or not job.get("downloaded") or not job.get("optimized"):
            raise ValueError(f"Canonical member is not fully ready for archival: {key}")

    records: dict[str, Any] = {}
    for set_key, definition in SETS.items():
        prompt = definition["prompt"]
        source_file = f"tools/playveo/output/wave/coherent-sets/{set_key}/source/sheet.jpg"
        snapshots = {
            key: archive_member(set_key, jobs[key], definition["rejection_reason"])
            for key in definition["member_job_keys"]
        }
        record = {
            "key": set_key,
            "kind": "coherent_set_sheet",
            "game_id": definition["game_id"],
            "layout": definition["layout"],
            "aspect_ratio": definition["aspect_ratio"],
            "transparent_members": definition["transparent"],
            "source_job_key": definition["source_job_key"],
            "member_job_keys": definition["member_job_keys"],
            "prompt": prompt,
            "prompt_sha256": prompt_digest(prompt),
            "source_file": source_file,
            "status": "planned",
            "provider_result_urls_persisted": False,
            "selected_result_index": 0,
            "prepared_at": utc_now(),
            "superseded_members": snapshots,
            "attempts": [],
            "crops": [],
        }
        records[set_key] = record
        reset_transport_job(jobs[definition["source_job_key"]], record)
        for member_key in definition["member_job_keys"]:
            if member_key != definition["source_job_key"]:
                jobs[member_key]["pending_coherent_set_source"] = set_key

    state["set_sources"] = records
    save_state(state)
    print(f"Prepared {len(records)} coherent set-source jobs; archived {len(member_keys)} current canonical members.")


def sync_record_from_transport(record: dict[str, Any], job: dict[str, Any]) -> None:
    for key in (
        "job_id", "status", "provider_model", "credit_cost", "submitted_at", "completed_at",
        "last_polled_at", "error", "result_count", "downloaded", "downloaded_at", "download_error",
        "source_mime", "source_bytes", "source_checksum_sha256",
    ):
        record[key] = job.get(key)
    record["source_file"] = job.get("source_file")


def crop_boxes(layout: str, width: int, height: int, count: int) -> list[tuple[int, int, int, int]]:
    if layout in {"grid_2x2", "grid_2x2_three"}:
        cells = [
            (0, 0, width // 2, height // 2),
            (width // 2, 0, width, height // 2),
            (0, height // 2, width // 2, height),
            (width // 2, height // 2, width, height),
        ]
        return cells[:count]
    if layout == "vertical_3":
        return [(0, round(index * height / count), width, round((index + 1) * height / count)) for index in range(count)]
    raise ValueError(f"Unsupported coherent-set layout: {layout}")


def center_crop_four_three(image: Image.Image) -> Image.Image:
    current = image.width / image.height
    target = 4 / 3
    if current > target:
        target_width = round(image.height * target)
        left = (image.width - target_width) // 2
        return image.crop((left, 0, left + target_width, image.height))
    target_height = round(image.width / target)
    top = (image.height - target_height) // 2
    return image.crop((0, top, image.width, top + target_height))


def write_evidence(record: dict[str, Any], sheet: Image.Image, crops: list[dict[str, Any]]) -> str:
    page_width = 1400
    margin = 28
    header = 70
    sheet_preview = ImageOps.contain(sheet.convert("RGB"), (page_width - 2 * margin, 620), Image.Resampling.LANCZOS)
    crop_width = (page_width - margin * 2 - margin * (len(crops) - 1)) // len(crops)
    crop_previews: list[tuple[Image.Image, str]] = []
    max_crop_height = 0
    for crop in crops:
        with Image.open(absolute(crop["staged_file"])) as opened:
            preview = ImageOps.contain(opened.convert("RGB"), (crop_width, 440), Image.Resampling.LANCZOS)
        crop_previews.append((preview, crop["member_job_key"].split("/")[-1]))
        max_crop_height = max(max_crop_height, preview.height)
    page_height = header + sheet_preview.height + 50 + max_crop_height + 75
    page = Image.new("RGB", (page_width, page_height), "#eef2f5")
    draw = ImageDraw.Draw(page)
    draw.rectangle((0, 0, page_width, header), fill="#12313f")
    draw.text((margin, 24), record["key"], fill="white")
    page.paste(sheet_preview, ((page_width - sheet_preview.width) // 2, header + 12))
    y = header + sheet_preview.height + 38
    x = margin
    for preview, label in crop_previews:
        page.paste(preview, (x + (crop_width - preview.width) // 2, y))
        draw.text((x + 8, y + max_crop_height + 16), label, fill="#12313f")
        x += crop_width + margin
    output = EVIDENCE_ROOT / f"{record['key']}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    page.save(output, "PNG", optimize=True)
    return relative(output)


def extract(state: dict[str, Any]) -> None:
    records = state.get("set_sources") or {}
    if set(records) != set(SETS):
        raise ValueError("Expected exactly the three prepared coherent set sources")
    jobs = job_map(state)
    extracted = 0
    for set_key, record in records.items():
        transport = jobs[record["source_job_key"]]
        sync_record_from_transport(record, transport)
        if transport.get("status") != "completed" or not transport.get("downloaded"):
            raise ValueError(f"Set source has not completed and downloaded: {set_key}")
        source = absolute(record["source_file"])
        expected = transport.get("source_checksum_sha256")
        if not source.is_file() or (expected and digest(source) != expected):
            raise ValueError(f"Set sheet missing or checksum mismatch: {set_key}")
        with Image.open(source) as opened:
            opened.load()
            sheet = opened.convert("RGB")
        record["sheet_width"] = sheet.width
        record["sheet_height"] = sheet.height
        record["sheet_checksum_sha256"] = digest(source)
        boxes = crop_boxes(record["layout"], sheet.width, sheet.height, len(record["member_job_keys"]))
        crops: list[dict[str, Any]] = []
        for index, (member_key, box) in enumerate(zip(record["member_job_keys"], boxes, strict=True)):
            crop = sheet.crop(box)
            if not record["transparent_members"]:
                crop = center_crop_four_three(crop)
            member = member_key.split("/")[-1]
            staged = OUTPUT_ROOT / set_key / "crops" / f"{member}.png"
            staged.parent.mkdir(parents=True, exist_ok=True)
            crop.save(staged, "PNG", optimize=True)
            crops.append({
                "member_job_key": member_key,
                "member_index": index,
                "crop_box": {"left": box[0], "top": box[1], "right": box[2], "bottom": box[3]},
                "staged_file": relative(staged),
                "staged_mime": "image/png",
                "staged_width": crop.width,
                "staged_height": crop.height,
                "staged_bytes": staged.stat().st_size,
                "staged_checksum_sha256": digest(staged),
                "source_sheet_checksum_sha256": record["sheet_checksum_sha256"],
            })
        record["crops"] = crops
        record["evidence_contact_sheet"] = write_evidence(record, sheet, crops)
        record["extracted_at"] = utc_now()
        record["status"] = "extracted_pending_visual_review"
        extracted += len(crops)
    save_state(state)
    print(f"Extracted {extracted} staged member crops from {len(records)} coherent sheets.")
    for record in records.values():
        print(record["evidence_contact_sheet"])


def append_attempt_once(job: dict[str, Any], snapshot: dict[str, Any]) -> None:
    attempts = job.setdefault("attempts", [])
    identity = (snapshot.get("job_id"), snapshot.get("status"), snapshot.get("superseded_by_set_source"))
    if any((item.get("job_id"), item.get("status"), item.get("superseded_by_set_source")) == identity for item in attempts):
        return
    attempts.append(copy.deepcopy(snapshot))


def adopt(state: dict[str, Any]) -> None:
    records = state.get("set_sources") or {}
    jobs = job_map(state)
    preflight: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any], Path]] = []
    for set_key, record in records.items():
        if record.get("status") != "extracted_pending_visual_review":
            raise ValueError(f"Set is not ready for reviewed adoption: {set_key}")
        transport = jobs[record["source_job_key"]]
        sync_record_from_transport(record, transport)
        if not record.get("job_id") or record.get("status") == "failed":
            raise ValueError(f"Set provider provenance is incomplete: {set_key}")
        crop_map = {crop["member_job_key"]: crop for crop in record.get("crops", [])}
        if set(crop_map) != set(record["member_job_keys"]):
            raise ValueError(f"Crop members do not match set definition: {set_key}")
        for member_key in record["member_job_keys"]:
            crop = crop_map[member_key]
            staged = absolute(crop["staged_file"])
            if not staged.is_file() or digest(staged) != crop["staged_checksum_sha256"]:
                raise ValueError(f"Staged crop is missing or changed: {member_key}")
            preflight.append((record, jobs[member_key], crop, staged))

    adopted_at = utc_now()
    for record, job, crop, staged in preflight:
        snapshot = record["superseded_members"][job["key"]]
        append_attempt_once(job, snapshot)
        game_slug = record["game_id"].removeprefix("game-")
        member = job["key"].split("/")[-1]
        derived = ROOT / "tools/playveo/output/wave" / game_slug / "derived" / f"{member}.png"
        derived.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staged, derived)
        derived_sha = digest(derived)
        if derived_sha != crop["staged_checksum_sha256"]:
            raise ValueError(f"Derived-copy verification failed: {job['key']}")

        job["operation"] = "crop-from-coherent-set"
        job["route_kind"] = "local-derived-image"
        job["aspect_ratio"] = snapshot.get("aspect_ratio")
        job["prompt"] = snapshot.get("prompt")
        job["prompt_sha256"] = snapshot.get("prompt_sha256")
        job["transparent_required"] = snapshot["transparent_required"]
        job["background_removal_required"] = snapshot["background_removal_required"]
        job["generation_method"] = "set_sheet_crop"
        job.pop("coherent_set_transport", None)
        job.pop("pending_coherent_set_source", None)
        job["status"] = "completed"
        job["job_id"] = None
        job["provider_model"] = None
        job["credit_cost"] = None
        job["submitted_at"] = None
        job["completed_at"] = adopted_at
        job["last_polled_at"] = None
        job["error"] = None
        job["result_count"] = 1
        job["source_file"] = relative(derived)
        job["downloaded"] = True
        job["downloaded_at"] = adopted_at
        job["download_error"] = None
        job["source_mime"] = "image/png"
        job["source_bytes"] = derived.stat().st_size
        job["source_checksum_sha256"] = derived_sha
        job["background_removed"] = False
        job["background_removal_status"] = "planned" if job["background_removal_required"] else "not_required"
        job["background_removal_started_at"] = None
        job["background_removal_completed_at"] = None
        job["background_removal_error"] = None
        job["removed_file"] = None
        job["removed_mime"] = None
        job["removed_bytes"] = None
        job["removed_checksum_sha256"] = None
        job["optimized"] = False
        job["optimized_at"] = None
        job["target_bytes"] = None
        job["target_checksum_sha256"] = None
        job["quality_status"] = "PENDING"
        job["quality_failures"] = []
        job["quality_warnings"] = []
        job["visual_rejection_reason"] = None
        job["source_origin"] = {
            "operation": "pixel_crop",
            "set_source_key": record["key"],
            "set_provider_job_id": record["job_id"],
            "set_provider_model": record.get("provider_model"),
            "set_provider_credit_cost": record.get("credit_cost"),
            "set_prompt_sha256": record["prompt_sha256"],
            "set_sheet_file": record["source_file"],
            "set_sheet_sha256": record["sheet_checksum_sha256"],
            "selected_result_index": record["selected_result_index"],
            "member_index": crop["member_index"],
            "crop_box": crop["crop_box"],
            "crop_sha256": crop["staged_checksum_sha256"],
            "adopted_at": adopted_at,
        }

    for record in records.values():
        record["status"] = "adopted_pending_member_processing"
        record["adopted_at"] = adopted_at
        record["visual_review"] = "MANUALLY_ACCEPTED_FOR_MEMBER_BACKGROUND_REMOVAL_AND_CANONICAL_QC"
    save_state(state)
    print(f"Adopted {len(preflight)} coherent member crops; transparent members still require provider background removal.")


def reject_set(state: dict[str, Any], set_key: str, reason: str, suffix: str) -> None:
    records = state.get("set_sources") or {}
    if set_key not in records:
        raise ValueError(f"Unknown prepared set source: {set_key}")
    record = records[set_key]
    jobs = job_map(state)
    transport = jobs[record["source_job_key"]]
    sync_record_from_transport(record, transport)
    if not record.get("job_id"):
        raise ValueError(f"Set source has no provider attempt to reject: {set_key}")
    archived_sheet = None
    source_value = record.get("source_file")
    if source_value and absolute(source_value).is_file():
        source = absolute(source_value)
        destination = ARCHIVE_ROOT / set_key / "sheet-attempts" / str(record["job_id"]) / f"sheet{source.suffix}"
        archived_sheet = copy_verified(source, destination, record.get("source_checksum_sha256"))
    record.setdefault("attempts", []).append({
        "job_id": record.get("job_id"),
        "status": "rejected_visual",
        "provider_status": record.get("status"),
        "provider_model": record.get("provider_model"),
        "credit_cost": record.get("credit_cost"),
        "submitted_at": record.get("submitted_at"),
        "completed_at": record.get("completed_at"),
        "result_count": record.get("result_count"),
        "prompt": record.get("prompt"),
        "prompt_sha256": record.get("prompt_sha256"),
        "source_checksum_sha256": record.get("source_checksum_sha256"),
        "archived_sheet": archived_sheet,
        "review_reason": reason,
        "rejected_at": utc_now(),
    })
    record["prompt"] = f"{record['prompt']} REGENERATION CORRECTION: {suffix}".strip()
    record["prompt_sha256"] = prompt_digest(record["prompt"])
    record["status"] = "planned"
    record["crops"] = []
    for key in (
        "job_id", "provider_model", "credit_cost", "submitted_at", "completed_at", "last_polled_at", "error",
        "downloaded_at", "download_error", "source_mime", "source_bytes", "source_checksum_sha256",
        "sheet_width", "sheet_height", "sheet_checksum_sha256", "extracted_at", "evidence_contact_sheet",
    ):
        record[key] = None
    record["result_count"] = 0
    record["downloaded"] = False
    reset_transport_job(transport, record)
    save_state(state)
    print(f"Archived and prepared rejected coherent set for regeneration: {set_key}")


def finalize(state: dict[str, Any]) -> None:
    records = state.get("set_sources") or {}
    if set(records) != set(SETS):
        raise ValueError("Expected exactly the three coherent set sources before finalization")
    jobs = job_map(state)
    verified = 0
    for set_key, record in records.items():
        if record.get("status") not in {"adopted_pending_member_processing", "completed_member_processing"}:
            raise ValueError(f"Set is not ready for member-processing verification: {set_key}")
        for member_key in record["member_job_keys"]:
            job = jobs[member_key]
            if job.get("generation_method") != "set_sheet_crop":
                raise ValueError(f"Member does not retain coherent-sheet lineage: {member_key}")
            source = absolute(job["source_file"])
            target = absolute(job["target_file"])
            if not source.is_file() or digest(source) != job.get("source_checksum_sha256"):
                raise ValueError(f"Derived member source is missing or changed: {member_key}")
            if not target.is_file() or digest(target) != job.get("target_checksum_sha256"):
                raise ValueError(f"Canonical member target is missing or changed: {member_key}")
            if not job.get("optimized") or job.get("quality_status") == "FAIL":
                raise ValueError(f"Canonical member did not pass automated processing: {member_key}")
            if job.get("background_removal_required"):
                removed_value = job.get("removed_file")
                if not job.get("background_removed") or not removed_value:
                    raise ValueError(f"Background removal is incomplete: {member_key}")
                removed = absolute(removed_value)
                if not removed.is_file() or digest(removed) != job.get("removed_checksum_sha256"):
                    raise ValueError(f"Removed-background output is missing or changed: {member_key}")
            verified += 1
        record["status"] = "completed_member_processing"
        record["member_processing_verified_at"] = utc_now()
        record["canonical_review_state"] = "ART_REVIEW_PENDING"
    save_state(state)
    print(f"Finalized coherent-set processing evidence for {verified} canonical members across {len(records)} sets.")


def plan(state: dict[str, Any]) -> None:
    records = state.get("set_sources") or {}
    print(json.dumps({
        "configured_sets": len(SETS),
        "canonical_members": sum(len(config["member_job_keys"]) for config in SETS.values()),
        "transparent_members_requiring_background_removal": sum(
            len(config["member_job_keys"]) for config in SETS.values() if config["transparent"]
        ),
        "prepared": bool(records),
        "statuses": {key: value.get("status") for key, value in records.items()},
        "canonical_job_count": len(state.get("jobs", [])),
    }, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--prepare", action="store_true")
    action.add_argument("--extract", action="store_true")
    action.add_argument("--adopt", action="store_true")
    action.add_argument("--finalize", action="store_true")
    action.add_argument("--reject-set")
    action.add_argument("--plan", action="store_true")
    parser.add_argument("--reason")
    parser.add_argument("--prompt-suffix")
    args = parser.parse_args()

    state = load_state()
    if args.prepare:
        prepare(state)
    elif args.extract:
        extract(state)
    elif args.adopt:
        adopt(state)
    elif args.finalize:
        finalize(state)
    elif args.reject_set:
        if not args.reason or not args.prompt_suffix:
            parser.error("--reject-set requires --reason and --prompt-suffix")
        reject_set(state, args.reject_set, args.reason, args.prompt_suffix)
    else:
        plan(state)


if __name__ == "__main__":
    main()
