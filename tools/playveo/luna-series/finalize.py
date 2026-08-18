"""Offline QC and stream-copy finalization for Luna series model-audio clips.

The manifest chooses a dynamic clip list and output root. This module never
contacts a provider, reads credentials, creates production state, approves a
review, renders an overlay, or synthesizes/replaces audio. ``--qc-only`` does
write contact-sheet and QC artifacts after verifying local state/media hashes.
Finalization additionally requires an immutable human clip-review fingerprint.
Glyph-overlay episodes require separately fingerprinted overlay evidence and a
qualified linguistic/calligraphy approval before concatenation is allowed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SERIES_ROOT = Path(__file__).resolve().parent
MANIFEST_ROOT = SERIES_ROOT / "manifests"
EPISODE_OUTPUT_ROOT = ROOT / "assets" / "episodes"
FFMPEG = Path(imageio_ffmpeg.get_ffmpeg_exe())

THUMB_W = 320
THUMB_H = 180
FRAMES_PER_CLIP = 3
LABEL_H = 30
GAP = 12
SHEET_COLUMNS = 5
BACKGROUND = (10, 15, 36)
AUDIO_SAMPLE_RATE = 16_000
MASTER_DURATION_TOLERANCE_SECONDS = 2.0
URI_SCHEME_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9+.-]*:(?=//|[^\s/])")
SECRET_KEY_RE = re.compile(
    r"(?:api[_-]?key|authorization|password|passphrase|secret|private[_-]?key|"
    r"client[_-]?secret|credential|access[_-]?token|refresh[_-]?token|"
    r"session[_-]?token|bearer|cookie)",
    re.IGNORECASE,
)
SECRET_VALUE_RE = re.compile(
    r"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|"
    r"client[_-]?secret|password|passphrase|private[_-]?key|secret|signature)\s*[=:]"
    r"|\bbearer\s+[A-Za-z0-9._~+/-]+|-----BEGIN[^\r\n]*PRIVATE KEY-----",
    re.IGNORECASE,
)
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
COMPLETED_STATES = {
    "completed",
    "approved",
    "provider_completed",
    "downloaded",
    "awaiting_human_review",
}
OVERLAY_PROFILE = "model_video_audio_plus_deterministic_glyph_overlay"
PREPRODUCTION_BINDING_SCHEMA = "luna-series.preproduction-binding/v1"


class FinalizationError(RuntimeError):
    """Raised when an immutable finalization gate is not satisfied."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def ensure_within(base: Path, candidate: Path, label: str, *, allow_base: bool = False) -> Path:
    resolved_base = base.resolve()
    resolved = candidate.resolve()
    try:
        relation = resolved.relative_to(resolved_base)
    except ValueError as error:
        raise FinalizationError(f"{label} escapes {resolved_base}") from error
    if not allow_base and relation == Path("."):
        raise FinalizationError(f"{label} must be below {resolved_base}")
    return resolved


def resolve_manifest(value: str) -> Path:
    candidate = Path(value)
    resolved = candidate.resolve() if candidate.is_absolute() else (ROOT / candidate).resolve()
    ensure_within(MANIFEST_ROOT, resolved, "manifest")
    if resolved.suffix.lower() != ".json" or not resolved.is_file():
        raise FinalizationError(f"Manifest is missing or not JSON: {resolved}")
    return resolved


def resolve_repository_file(value: str, label: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        raise FinalizationError(f"{label} must be repository-relative")
    return ensure_within(ROOT, ROOT / candidate, label)


def resolve_output_root(manifest: dict[str, Any]) -> Path:
    value = manifest.get("output_root")
    if not isinstance(value, str) or not value.startswith("assets/episodes/"):
        raise FinalizationError("Manifest output_root must remain below assets/episodes")
    return ensure_within(EPISODE_OUTPUT_ROOT, ROOT / value, "output_root")


def resolve_output_child(output_root: Path, value: str, label: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        raise FinalizationError(f"{label} must be relative to output_root")
    return ensure_within(output_root, output_root / candidate, label)


def walk_for_forbidden_state_content(value: Any, current_path: str = "$") -> list[str]:
    findings: list[str] = []
    if isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(walk_for_forbidden_state_content(child, f"{current_path}[{index}]"))
    elif isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{current_path}.{key}"
            if SECRET_KEY_RE.search(str(key)):
                findings.append(f"{child_path}: secret-like key")
            findings.extend(walk_for_forbidden_state_content(child, child_path))
    elif isinstance(value, str):
        if URI_SCHEME_RE.search(value):
            findings.append(f"{current_path}: URI scheme")
        if SECRET_VALUE_RE.search(value):
            findings.append(f"{current_path}: secret-like value")
    return findings


def build_visual_prompt(manifest: dict[str, Any], clip: dict[str, Any]) -> str:
    locks = manifest["shared_locks"]
    direction = manifest["episode_direction"]
    if manifest["pipeline"]["profile"] == OVERLAY_PROFILE:
        overlay_policy = (
            "The model must leave every pedagogical display surface blank. Do not draw text, "
            "letters, words, captions, pseudo-writing, dotted glyph paths, or glyph-like marks. "
            "Deterministic post-model overlay data is applied separately."
        )
    else:
        overlay_policy = (
            "Do not draw text, letters, words, captions, numbers, logos, or labels. "
            "Player and application overlays are separate from the generated picture."
        )
    return "\n\n".join(
        [
            f"Create one continuous {clip['duration_seconds']}-second 16:9 HD stylized 3D preschool cartoon shot.",
            f"CURRENT SHOT\n{clip['visual']}",
            f"STYLE LOCK\n{locks['style']}",
            f"LUNA LOCK\n{locks['luna']}",
            f"NAJMI LOCK\n{locks['najmi']}",
            f"BASE WORLD LOCK\n{locks['base_world']}",
            f"EPISODE WORLD\n{direction['world']}",
            f"EPISODE PROPS\n{direction['props']}",
            f"CAMERA LOCK\n{locks['camera']}",
            f"VISUAL TEXT POLICY\n{overlay_policy}",
            f"NEGATIVE LOCK\n{locks['negative']}",
        ]
    )


def build_prompt(manifest: dict[str, Any], clip: dict[str, Any]) -> str:
    locks = manifest["shared_locks"]
    dialogue = "\n".join(
        f"{index}. {line}" for index, line in enumerate(clip["exact_spoken_dialogue"], start=1)
    ) or "No spoken dialogue."
    timeline_lines: list[str] = []
    for event in clip["timeline"]:
        payload = f"SPEAK EXACTLY: {event['spoken']}" if event.get("spoken") else event["action"]
        timeline_lines.append(f"- {event['at_seconds']}s: {payload}")
    timeline = "\n".join(timeline_lines)
    return "\n\n".join(
        [
            build_visual_prompt(manifest, clip),
            f"AUDIO VOICE LOCK\n{locks['voice']}",
            f"EXACT DIALOGUE RULE\n{locks['dialogue_rule']}",
            f"EPISODE PRONUNCIATION\n{manifest['episode_direction']['pronunciation']}",
            f"AUDIO MIX LOCK\n{locks['mix']}\n{locks['silence_rule']}",
            f"EXACT SPOKEN DIALOGUE IN ORDER\n{dialogue}",
            f"TIMELINE\n{timeline}",
            "DELIVERY RULES\nGenerate the Arabic performance, lip-sync, ambience, music, and sound "
            "effects inside the clip. Do not add, omit, translate, paraphrase, or repeat dialogue. "
            "Preserve specified silent response windows. Never replace speech with subtitles.",
        ]
    ).strip()


def prompt_hashes(manifest: dict[str, Any], clips: list[dict[str, Any]]) -> dict[str, str]:
    return {
        str(clip["id"]): sha256_bytes(build_prompt(manifest, clip).encode("utf-8"))
        for clip in clips
    }


def manifest_clips(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    clips = manifest.get("clips")
    if clips is None:
        clips = manifest.get("scenes")
    if not isinstance(clips, list) or not clips:
        raise FinalizationError("Manifest must contain a non-empty clips or scenes array")
    seen_ids: set[str] = set()
    seen_files: set[str] = set()
    total = 0
    for index, clip in enumerate(clips):
        if not isinstance(clip, dict):
            raise FinalizationError(f"Clip {index} is not an object")
        clip_id = clip.get("id")
        file_name = clip.get("file")
        duration = clip.get("duration_seconds")
        if not isinstance(clip_id, str) or not clip_id:
            raise FinalizationError(f"Clip {index} has no stable id")
        if clip_id in seen_ids:
            raise FinalizationError(f"Duplicate clip id: {clip_id}")
        seen_ids.add(clip_id)
        if not isinstance(file_name, str) or not file_name.lower().endswith(".mp4"):
            raise FinalizationError(f"{clip_id} has no MP4 file")
        if file_name in seen_files:
            raise FinalizationError(f"Duplicate clip file: {file_name}")
        seen_files.add(file_name)
        if not isinstance(duration, int) or isinstance(duration, bool) or duration < 5 or duration > 20:
            raise FinalizationError(f"{clip_id} duration must be an integer from 5 to 20 seconds")
        total += duration
    if total != 180:
        raise FinalizationError(f"Clip duration total is {total}, expected 180")
    return clips


def validate_manifest_integrity(manifest: dict[str, Any], manifest_path: Path) -> list[dict[str, Any]]:
    if manifest.get("schema_version") != "luna-series.preproduction/v1":
        raise FinalizationError("Unsupported manifest schema")
    if manifest.get("episode", {}).get("duration_seconds") != 180 \
            or manifest.get("format", {}).get("expected_total_seconds") != 180:
        raise FinalizationError("Manifest episode and expected total duration must both be 180 seconds")
    source = manifest.get("source")
    if not isinstance(source, dict):
        raise FinalizationError("Manifest source descriptor is missing")
    source_path = resolve_repository_file(str(source.get("path", "")), "source.path")
    if not source_path.is_file():
        raise FinalizationError(f"Source is missing: {source_path}")
    if source.get("sha256") != sha256_file(source_path):
        raise FinalizationError("Source SHA-256 differs from the manifest")
    if manifest.get("pipeline", {}).get("model_audio_required") is not True:
        raise FinalizationError("Manifest does not require model audio")
    if manifest.get("pipeline", {}).get("external_tts_forbidden") is not True:
        raise FinalizationError("Manifest does not forbid external TTS")
    if manifest.get("pipeline", {}).get("retain_model_audio_in_master") is not True:
        raise FinalizationError("Manifest does not require retained model audio")
    if manifest.get("runtime_state_policy", {}).get("provider_result_urls_persisted") is not False:
        raise FinalizationError("Manifest runtime policy does not forbid persisted provider result URLs")
    if walk_for_forbidden_state_content(manifest):
        raise FinalizationError("Manifest contains a forbidden URL or secret-like field")
    clips = manifest_clips(manifest)
    output_root = resolve_output_root(manifest)
    for clip in clips:
        resolve_output_child(output_root, str(clip["file"]), f"{clip['id']} file")
    # Bind every downstream state/review check to the exact manifest, source,
    # identity, and prompt set used for this finalization attempt.
    plan_projection = {
        key: value for key, value in manifest.items() if key != "_finalizer_context"
    }
    current_prompt_hashes = prompt_hashes(manifest, clips)
    manifest["_finalizer_context"] = {
        "manifest_file": relative(manifest_path),
        "manifest_file_sha256": sha256_file(manifest_path),
        "manifest_plan_sha256": sha256_bytes(canonical_json(plan_projection).encode("utf-8")),
        "source_sha256": source["sha256"],
        "visual_identity_pack_sha256": manifest["visual_identity"]["reference_pack_sha256"],
        "prompt_sha256_by_clip": current_prompt_hashes,
        "prompt_set_sha256": sha256_bytes(canonical_json(current_prompt_hashes).encode("utf-8")),
    }
    return clips


def load_state(manifest: dict[str, Any], output_root: Path) -> tuple[Path, dict[str, Any]]:
    state_name = manifest.get("runtime_state_policy", {}).get("state_file", "_production-state.json")
    state_path = resolve_output_child(output_root, str(state_name), "production state")
    if not state_path.is_file():
        raise FinalizationError("Production state is missing; QC/finalization cannot infer local clip provenance")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    findings = walk_for_forbidden_state_content(state)
    if findings:
        raise FinalizationError("Production state contains a forbidden URL or secret-like field")
    if state.get("production_id") != manifest.get("production_id"):
        raise FinalizationError("Production state belongs to a different production_id")
    context = manifest["_finalizer_context"]
    binding = state.get("preproduction_binding")
    if not isinstance(binding, dict) or binding.get("schema_version") != PREPRODUCTION_BINDING_SCHEMA:
        raise FinalizationError("Production state lacks the required preproduction binding schema")
    expected_binding = {
        "source_sha256": context["source_sha256"],
        "preproduction_plan_sha256": context["manifest_plan_sha256"],
        "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        "prompt_set_sha256": context["prompt_set_sha256"],
    }
    for field, expected in expected_binding.items():
        if binding.get(field) != expected:
            raise FinalizationError(f"Production state {field} differs from the current preproduction plan")
    manifest_pack = context["visual_identity_pack_sha256"]
    state_pack = state.get("visual_identity", {}).get("reference_pack_sha256")
    if state_pack != manifest_pack:
        raise FinalizationError("Production state visual identity differs from the manifest")
    if state.get("provider_result_urls_persisted") is not False:
        raise FinalizationError("Production state must explicitly declare that provider result URLs are not persisted")
    return state_path, state


def state_job_id(job: dict[str, Any]) -> str | None:
    value = job.get("clip_id", job.get("scene_id"))
    return str(value) if value is not None else None


def verify_state_and_local_files(
    manifest: dict[str, Any],
    clips: list[dict[str, Any]],
    output_root: Path,
    state: dict[str, Any],
) -> dict[str, Any]:
    jobs = state.get("jobs")
    if not isinstance(jobs, list):
        raise FinalizationError("Production state jobs array is missing")
    jobs_by_id: dict[str, dict[str, Any]] = {}
    for job in jobs:
        if not isinstance(job, dict) or not state_job_id(job):
            raise FinalizationError("Production state contains an invalid job")
        clip_id = state_job_id(job)
        assert clip_id is not None
        if clip_id in jobs_by_id:
            raise FinalizationError(f"Production state duplicates {clip_id}")
        jobs_by_id[clip_id] = job
    expected_ids = {str(clip["id"]) for clip in clips}
    if set(jobs_by_id) != expected_ids:
        raise FinalizationError("Production state does not cover the manifest clip set exactly")

    fingerprint: list[dict[str, Any]] = []
    for clip in clips:
        clip_id = str(clip["id"])
        job = jobs_by_id[clip_id]
        media = job.get("media")
        if job.get("status") not in COMPLETED_STATES:
            raise FinalizationError(f"Production state does not mark {clip_id} as completed")
        if not isinstance(media, dict) or media.get("ok") is not True:
            raise FinalizationError(f"Production state has no validated media record for {clip_id}")
        if media.get("has_video_track") is not True or media.get("has_audio_track") is not True:
            raise FinalizationError(f"Production state lacks video-plus-audio validation for {clip_id}")
        if str(job.get("output_file", "")).replace("\\", "/") != str(clip["file"]).replace("\\", "/"):
            raise FinalizationError(f"Production state output path differs for {clip_id}")
        expected_prompt_sha = manifest["_finalizer_context"]["prompt_sha256_by_clip"][clip_id]
        job_input = job.get("input") if isinstance(job.get("input"), dict) else {}
        job_prompt_sha = job.get("prompt_sha256", job_input.get("prompt_sha256"))
        if job_prompt_sha != expected_prompt_sha:
            raise FinalizationError(f"Production state prompt hash differs from the current plan for {clip_id}")
        clip_path = resolve_output_child(output_root, str(clip["file"]), f"{clip_id} file")
        if not clip_path.is_file():
            raise FinalizationError(f"Local clip is missing: {relative(clip_path)}")
        actual_sha = sha256_file(clip_path)
        actual_bytes = clip_path.stat().st_size
        if media.get("sha256") != actual_sha:
            raise FinalizationError(f"Local clip hash differs from production state for {clip_id}")
        if int(media.get("bytes", -1)) != actual_bytes:
            raise FinalizationError(f"Local clip size differs from production state for {clip_id}")
        fingerprint.append(
            {
                "clip_id": clip_id,
                "sha256": actual_sha,
                "bytes": actual_bytes,
                "prompt_sha256": expected_prompt_sha,
            }
        )
    return {
        "state_updated_at": state.get("updated_at"),
        "state_fingerprint_matches_local_files": True,
        "preproduction_binding": state["preproduction_binding"],
        "local_fingerprint": fingerprint,
        "review_status": state.get("review", {}).get("clips", {}).get("status", "pending"),
    }


def require_approval_metadata(record: dict[str, Any], label: str) -> dict[str, str]:
    reviewer_id = record.get("reviewer_id")
    approved_at = record.get("approved_at")
    basis = record.get("basis")
    if not all(isinstance(value, str) and value.strip() for value in (reviewer_id, approved_at, basis)):
        raise FinalizationError(f"{label} lacks reviewer identity, timestamp, or review basis")
    try:
        parsed = datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise FinalizationError(f"{label} approved_at is not an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise FinalizationError(f"{label} approved_at must include a timezone")
    return {
        "reviewer_id": reviewer_id,
        "approved_at": approved_at,
        "basis": basis,
    }


def require_approved_source_reviews(
    manifest: dict[str, Any],
    state: dict[str, Any],
) -> dict[str, Any]:
    required = [
        review
        for review in manifest.get("reviews", {}).get("required", [])
        if isinstance(review, dict) and review.get("required") is True
    ]
    expected_types = {str(review.get("review_type")) for review in required}
    source_reviews = state.get("review", {}).get("source_reviews")
    if not isinstance(source_reviews, list):
        raise FinalizationError("Production state has no approved source_reviews chain")
    by_type: dict[str, dict[str, Any]] = {}
    for review in source_reviews:
        if not isinstance(review, dict) or not isinstance(review.get("review_type"), str):
            raise FinalizationError("Production state contains an invalid source review")
        review_type = review["review_type"]
        if review_type in by_type:
            raise FinalizationError(f"Production state duplicates source review {review_type}")
        by_type[review_type] = review
    if set(by_type) != expected_types:
        raise FinalizationError("Approved source review chain does not exactly cover manifest reviews.required")

    context = manifest["_finalizer_context"]
    normalized: list[dict[str, Any]] = []
    for review_type in sorted(expected_types):
        review = by_type[review_type]
        if review.get("status") != "approved":
            raise FinalizationError(f"Source review {review_type} is not approved")
        if review.get("source_sha256") != context["source_sha256"]:
            raise FinalizationError(f"Source review {review_type} is stale for the source")
        if review.get("preproduction_plan_sha256") != context["manifest_plan_sha256"]:
            raise FinalizationError(f"Source review {review_type} is stale for the preproduction plan")
        if review.get("visual_identity_pack_sha256") != context["visual_identity_pack_sha256"]:
            raise FinalizationError(f"Source review {review_type} is stale for the visual identity")
        metadata = require_approval_metadata(review, f"Source review {review_type}")
        normalized.append(
            {
                "review_type": review_type,
                "status": "approved",
                "source_sha256": context["source_sha256"],
                "preproduction_plan_sha256": context["manifest_plan_sha256"],
                "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
                **metadata,
            }
        )
    return {
        "status": "approved",
        "reviews": normalized,
        "chain_sha256": sha256_bytes(canonical_json(normalized).encode("utf-8")),
    }


def approved_fingerprint(review: dict[str, Any]) -> dict[str, dict[str, Any]]:
    fingerprint = review.get("fingerprint")
    if not isinstance(fingerprint, list):
        raise FinalizationError("Approved review has no immutable fingerprint")
    result: dict[str, dict[str, Any]] = {}
    for item in fingerprint:
        if not isinstance(item, dict):
            raise FinalizationError("Approved review fingerprint entry is invalid")
        item_id = item.get("clip_id", item.get("scene_id"))
        item_sha = item.get("sha256")
        prompt_sha = item.get("prompt_sha256")
        if (
            not item_id
            or not isinstance(item_sha, str)
            or not SHA256_RE.fullmatch(item_sha)
            or not isinstance(prompt_sha, str)
            or not SHA256_RE.fullmatch(prompt_sha)
        ):
            raise FinalizationError("Approved review fingerprint entry lacks media or prompt hash")
        item_id = str(item_id)
        if item_id in result:
            raise FinalizationError(f"Approved review duplicates {item_id}")
        result[item_id] = item
    return result


def require_approved_clip_review(
    manifest: dict[str, Any],
    clips: list[dict[str, Any]],
    output_root: Path,
    state: dict[str, Any],
    source_review_approval: dict[str, Any],
) -> dict[str, Any]:
    review = state.get("review", {}).get("clips", {})
    if review.get("status") != "approved":
        raise FinalizationError("Finalization requires approved human visual-and-auditory clip review")
    metadata = require_approval_metadata(review, "Human clip review")
    context = manifest["_finalizer_context"]
    required_bindings = {
        "source_sha256": context["source_sha256"],
        "preproduction_plan_sha256": context["manifest_plan_sha256"],
        "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        "prompt_set_sha256": context["prompt_set_sha256"],
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
    }
    for field, expected in required_bindings.items():
        if review.get(field) != expected:
            raise FinalizationError(f"Human clip review {field} is stale")

    fingerprint = approved_fingerprint(review)
    expected_ids = {str(clip["id"]) for clip in clips}
    if set(fingerprint) != expected_ids:
        raise FinalizationError("Approved clip review does not cover the manifest clip set exactly")
    for clip in clips:
        clip_id = str(clip["id"])
        item = fingerprint[clip_id]
        clip_path = resolve_output_child(output_root, str(clip["file"]), f"{clip_id} file")
        if item["sha256"] != sha256_file(clip_path):
            raise FinalizationError(f"Clip changed after human approval: {clip_id}")
        per_clip_bindings = {
            "prompt_sha256": context["prompt_sha256_by_clip"][clip_id],
            "source_sha256": context["source_sha256"],
            "preproduction_plan_sha256": context["manifest_plan_sha256"],
            "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
            "source_review_chain_sha256": source_review_approval["chain_sha256"],
        }
        for field, expected in per_clip_bindings.items():
            if item.get(field) != expected:
                raise FinalizationError(f"Clip review fingerprint {field} is stale for {clip_id}")
    return {
        "status": "approved",
        **metadata,
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
        "fingerprint": review.get("fingerprint"),
    }


def overlay_plan_hash(overlay: dict[str, Any]) -> str:
    projection = dict(overlay)
    projection.pop("overlay_plan_sha256", None)
    return sha256_bytes(canonical_json(projection).encode("utf-8"))


def verify_overlay_manifest_assets(manifest: dict[str, Any]) -> dict[str, Any]:
    overlay = manifest.get("overlay_plan")
    if not isinstance(overlay, dict) or overlay.get("required") is not True:
        raise FinalizationError("Glyph-overlay pipeline has no required overlay plan")
    expected_plan_hash = overlay_plan_hash(overlay)
    if overlay.get("overlay_plan_sha256") != expected_plan_hash:
        raise FinalizationError("Overlay plan hash is stale")
    selected_font = overlay.get("selected_font")
    license_info = overlay.get("license")
    if not isinstance(selected_font, dict) or not isinstance(license_info, dict):
        raise FinalizationError("Overlay selected font or license is missing")
    font_path = resolve_repository_file(str(selected_font.get("path", "")), "overlay font")
    license_path = resolve_repository_file(str(license_info.get("path", "")), "overlay license")
    if not font_path.is_file() or sha256_file(font_path) != selected_font.get("sha256"):
        raise FinalizationError("Overlay font is missing or its hash differs")
    if not license_path.is_file() or sha256_file(license_path) != license_info.get("sha256"):
        raise FinalizationError("Overlay font license is missing or its hash differs")
    return {
        "overlay_plan_sha256": expected_plan_hash,
        "font_path": relative(font_path),
        "font_sha256": selected_font["sha256"],
        "license_path": relative(license_path),
        "license_sha256": license_info["sha256"],
    }


def require_overlay_evidence(
    manifest: dict[str, Any],
    clips: list[dict[str, Any]],
    output_root: Path,
    state: dict[str, Any],
    source_review_approval: dict[str, Any],
) -> dict[str, Any]:
    assets = verify_overlay_manifest_assets(manifest)
    context = manifest["_finalizer_context"]
    overlay_review = state.get("review", {}).get("overlay", {})
    if overlay_review.get("status") != "approved":
        raise FinalizationError("Glyph-overlay finalization requires approved overlay evidence")
    overlay_review_metadata = require_approval_metadata(overlay_review, "Overlay evidence review")
    overlay_bindings = {
        "overlay_plan_sha256": assets["overlay_plan_sha256"],
        "font_sha256": assets["font_sha256"],
        "source_sha256": context["source_sha256"],
        "preproduction_plan_sha256": context["manifest_plan_sha256"],
        "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        "prompt_set_sha256": context["prompt_set_sha256"],
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
    }
    for field, expected in overlay_bindings.items():
        if overlay_review.get(field) != expected:
            raise FinalizationError(f"Overlay review {field} is stale")

    approval = overlay_review.get("linguistic_and_calligraphy_approval")
    if not isinstance(approval, dict) or approval.get("status") != "approved":
        raise FinalizationError("Qualified linguistic/calligraphy approval is missing")
    approval_metadata = require_approval_metadata(approval, "Linguistic/calligraphy approval")
    specialist_bindings = {
        "source_sha256": context["source_sha256"],
        "preproduction_plan_sha256": context["manifest_plan_sha256"],
        "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        "overlay_plan_sha256": assets["overlay_plan_sha256"],
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
    }
    for field, expected in specialist_bindings.items():
        if approval.get(field) != expected:
            raise FinalizationError(f"Linguistic/calligraphy approval {field} is stale")

    evidence_file = overlay_review.get("evidence_file")
    evidence_sha = overlay_review.get("evidence_sha256")
    if not isinstance(evidence_file, str) or not isinstance(evidence_sha, str):
        raise FinalizationError("Overlay evidence file/hash is missing")
    evidence_path = resolve_output_child(output_root, evidence_file, "overlay evidence")
    if not evidence_path.is_file() or sha256_file(evidence_path) != evidence_sha:
        raise FinalizationError("Overlay evidence file is missing or its hash differs")
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("schema_version") != "luna-series.overlay-evidence/v1":
        raise FinalizationError("Overlay evidence schema is unsupported")
    evidence_bindings = {
        "production_id": manifest.get("production_id"),
        "overlay_plan_sha256": assets["overlay_plan_sha256"],
        "font_sha256": assets["font_sha256"],
        "source_sha256": context["source_sha256"],
        "preproduction_plan_sha256": context["manifest_plan_sha256"],
        "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        "prompt_set_sha256": context["prompt_set_sha256"],
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
    }
    for field, expected in evidence_bindings.items():
        if evidence.get(field) != expected:
            raise FinalizationError(f"Overlay evidence {field} differs from the approved plan")

    evidence_clips = evidence.get("clips")
    if not isinstance(evidence_clips, list):
        raise FinalizationError("Overlay evidence clip fingerprint is missing")
    by_id: dict[str, dict[str, Any]] = {}
    for item in evidence_clips:
        if not isinstance(item, dict) or not item.get("clip_id") or not item.get("sha256"):
            raise FinalizationError("Overlay evidence contains an invalid clip fingerprint")
        clip_id = str(item["clip_id"])
        if clip_id in by_id:
            raise FinalizationError(f"Overlay evidence duplicates {clip_id}")
        by_id[clip_id] = item
    expected_ids = {str(clip["id"]) for clip in clips}
    if set(by_id) != expected_ids:
        raise FinalizationError("Overlay evidence does not cover the manifest clip set exactly")
    for clip in clips:
        clip_id = str(clip["id"])
        item = by_id[clip_id]
        clip_path = resolve_output_child(output_root, str(clip["file"]), f"{clip_id} file")
        if item.get("sha256") != sha256_file(clip_path):
            raise FinalizationError(f"Overlay evidence is stale for {clip_id}")
        per_clip_bindings = {
            "prompt_sha256": context["prompt_sha256_by_clip"][clip_id],
            "source_sha256": context["source_sha256"],
            "preproduction_plan_sha256": context["manifest_plan_sha256"],
            "visual_identity_pack_sha256": context["visual_identity_pack_sha256"],
        }
        for field, expected in per_clip_bindings.items():
            if item.get(field) != expected:
                raise FinalizationError(f"Overlay evidence {field} is stale for {clip_id}")
    return {
        **assets,
        "status": "approved",
        **overlay_review_metadata,
        "evidence_file": relative(evidence_path),
        "evidence_sha256": evidence_sha,
        "source_review_chain_sha256": source_review_approval["chain_sha256"],
        "linguistic_and_calligraphy_approval": {
            "status": "approved",
            **approval_metadata,
            **specialist_bindings,
        },
    }


def overlay_gate_snapshot(
    manifest: dict[str, Any],
    clips: list[dict[str, Any]],
    output_root: Path,
    state: dict[str, Any],
) -> dict[str, Any]:
    if manifest.get("pipeline", {}).get("profile") != OVERLAY_PROFILE:
        return {"required": False, "status": "not_applicable"}
    try:
        source_reviews = require_approved_source_reviews(manifest, state)
        result = require_overlay_evidence(
            manifest,
            clips,
            output_root,
            state,
            source_reviews,
        )
        return {"required": True, "status": "approved", **result}
    except FinalizationError as error:
        return {"required": True, "status": "blocked", "reason": str(error)}


def run(command: list[str], *, binary: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=not binary,
    )


def frame_at(capture: cv2.VideoCapture, frame_index: int) -> tuple[Image.Image, np.ndarray]:
    capture.set(cv2.CAP_PROP_POS_FRAMES, max(0, frame_index))
    ok, frame = capture.read()
    if not ok or frame is None:
        raise FinalizationError(f"Could not decode frame {frame_index}")
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    thumbnail = Image.fromarray(rgb).resize((THUMB_W, THUMB_H), Image.Resampling.LANCZOS)
    analysis = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 90))
    return thumbnail, analysis


def decode_audio_pcm(path: Path) -> bytes:
    result = run(
        [
            str(FFMPEG),
            "-v", "error",
            "-i", str(path),
            "-map", "0:a:0",
            "-vn",
            "-ac", "1",
            "-ar", str(AUDIO_SAMPLE_RATE),
            "-f", "s16le",
            "pipe:1",
        ],
        binary=True,
    )
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise FinalizationError(f"Could not decode audio from {path.name}: {error}")
    return result.stdout


def audio_metrics(pcm: bytes) -> dict[str, Any]:
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float64)
    if samples.size == 0:
        return {
            "decoded_duration_seconds": 0.0,
            "mean_dbfs": -120.0,
            "peak_dbfs": -120.0,
            "active_window_ratio": 0.0,
            "pcm_sha256": sha256_bytes(pcm),
        }
    normalized = samples / 32768.0
    rms = float(np.sqrt(np.mean(np.square(normalized))))
    peak = float(np.max(np.abs(normalized)))
    window_size = int(AUDIO_SAMPLE_RATE * 0.1)
    window_count = samples.size // window_size
    if window_count:
        windows = normalized[: window_count * window_size].reshape(window_count, window_size)
        window_rms = np.sqrt(np.mean(np.square(windows), axis=1))
        active_ratio = float(np.mean(window_rms > 10 ** (-45 / 20)))
    else:
        active_ratio = 0.0
    return {
        "decoded_duration_seconds": round(samples.size / AUDIO_SAMPLE_RATE, 4),
        "mean_dbfs": round(20 * math.log10(max(rms, 1e-6)), 2),
        "peak_dbfs": round(20 * math.log10(max(peak, 1e-6)), 2),
        "active_window_ratio": round(active_ratio, 4),
        "pcm_sha256": sha256_bytes(pcm),
    }


def inspect_clip(clip: dict[str, Any], output_root: Path) -> tuple[dict[str, Any], list[Image.Image]]:
    clip_id = str(clip["id"])
    clip_path = resolve_output_child(output_root, str(clip["file"]), f"{clip_id} file")
    if not clip_path.is_file():
        raise FinalizationError(f"Missing {relative(clip_path)}")
    data = clip_path.read_bytes()
    capture = cv2.VideoCapture(str(clip_path))
    if not capture.isOpened():
        raise FinalizationError(f"OpenCV could not open {relative(clip_path)}")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0.0
    positions = (0.15, 0.50, 0.85)
    frames: list[Image.Image] = []
    analysis_frames: list[np.ndarray] = []
    for position in positions:
        image, analysis = frame_at(capture, min(frame_count - 1, int(frame_count * position)))
        frames.append(image)
        analysis_frames.append(analysis)
    capture.release()

    differences = [
        float(np.mean(cv2.absdiff(analysis_frames[index], analysis_frames[index + 1])))
        for index in range(len(analysis_frames) - 1)
    ]
    motion_score = float(np.mean(differences))
    average_luma = float(np.mean(analysis_frames))
    audio = audio_metrics(decode_audio_pcm(clip_path))
    expected = float(clip["duration_seconds"])
    duration_error = duration - expected
    aspect_ratio = width / height if height else 0.0
    has_ftyp = b"ftyp" in data[:128]
    has_video_track = b"vide" in data
    has_audio_track = b"soun" in data
    structural_ok = (
        len(data) > 10_000
        and has_ftyp
        and has_video_track
        and has_audio_track
        and width > 0
        and height > 0
        and fps > 0
        and frame_count > 0
        and abs(aspect_ratio - (16 / 9)) <= 0.06
        and abs(duration_error) <= 1.0
    )
    motion_ok = motion_score >= 0.35
    audio_ok = (
        audio["decoded_duration_seconds"] >= expected - 1.5
        and audio["peak_dbfs"] > -45.0
        and audio["active_window_ratio"] >= 0.02
    )
    record = {
        "clip_id": clip_id,
        "file": relative(clip_path),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "width": width,
        "height": height,
        "aspect_ratio": round(aspect_ratio, 5),
        "fps": round(fps, 4),
        "frame_count": frame_count,
        "expected_duration_seconds": expected,
        "measured_video_duration_seconds": round(duration, 4),
        "duration_error_seconds": round(duration_error, 4),
        "has_ftyp": has_ftyp,
        "has_video_track": has_video_track,
        "has_audio_track": has_audio_track,
        "motion_score": round(motion_score, 4),
        "average_luma": round(average_luma, 2),
        "audio": audio,
        "structural_ok": structural_ok,
        "motion_ok": motion_ok,
        "audio_signal_ok": audio_ok,
        "ok": structural_ok and motion_ok and audio_ok,
    }
    return record, frames


def inspect_clips(
    clips: list[dict[str, Any]], output_root: Path
) -> tuple[list[tuple[dict[str, Any], list[Image.Image]]], list[dict[str, Any]]]:
    rows = [inspect_clip(clip, output_root) for clip in clips]
    records = [row[0] for row in rows]
    failures = [record["clip_id"] for record in records if not record["ok"]]
    if failures:
        raise FinalizationError(f"Clip QC failed: {', '.join(failures)}")
    if len({record["sha256"] for record in records}) != len(records):
        raise FinalizationError("Duplicate MP4 hashes detected")
    return rows, records


def create_contact_sheet(
    rows: list[tuple[dict[str, Any], list[Image.Image]]], contact_sheet: Path
) -> None:
    columns = min(SHEET_COLUMNS, max(1, len(rows)))
    cell_width = THUMB_W
    cell_height = THUMB_H * FRAMES_PER_CLIP + LABEL_H
    row_count = math.ceil(len(rows) / columns)
    sheet_width = columns * cell_width + (columns + 1) * GAP
    sheet_height = row_count * cell_height + (row_count + 1) * GAP
    sheet = Image.new("RGB", (sheet_width, sheet_height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, (record, frames) in enumerate(rows):
        column = index % columns
        row = index // columns
        x = GAP + column * (cell_width + GAP)
        y = GAP + row * (cell_height + GAP)
        for frame_index, frame in enumerate(frames):
            sheet.paste(frame, (x, y + frame_index * THUMB_H))
        label_y = y + FRAMES_PER_CLIP * THUMB_H
        draw.rectangle((x, label_y, x + cell_width, label_y + LABEL_H), fill=(24, 37, 102))
        draw.text(
            (x + 7, label_y + 7),
            f"{record['clip_id']} motion={record['motion_score']:.1f} audio={record['audio']['mean_dbfs']:.1f}dB",
            fill=(245, 247, 255),
        )
    contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(contact_sheet, "JPEG", quality=92, subsampling=0, optimize=True)


def concat_line(path: Path) -> str:
    normalized = path.resolve().as_posix().replace("'", "'\\''")
    return f"file '{normalized}'"


def write_concat_list(clips: list[dict[str, Any]], output_root: Path, concat_list: Path) -> None:
    lines = [
        concat_line(resolve_output_child(output_root, str(clip["file"]), f"{clip['id']} file"))
        for clip in clips
    ]
    concat_list.parent.mkdir(parents=True, exist_ok=True)
    concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")


def stream_hash(input_args: list[str], stream: str, codec: str) -> str:
    command = [str(FFMPEG), "-v", "error", *input_args, "-map", stream]
    if codec == "rawvideo":
        command.extend(["-an", "-c:v", "rawvideo", "-pix_fmt", "yuv420p"])
    else:
        command.extend(["-c", codec])
    command.extend(["-f", "hash", "-hash", "sha256", "pipe:1"])
    result = run(command)
    if result.returncode != 0:
        raise FinalizationError(f"Could not hash {codec} stream: {result.stderr.strip()}")
    value = result.stdout.strip()
    if not value.startswith("SHA256="):
        raise FinalizationError(f"Unexpected FFmpeg hash output: {value}")
    return value.removeprefix("SHA256=").lower()


def merge_stream_copy(concat_list: Path, temporary_master: Path) -> dict[str, Any]:
    if temporary_master.exists():
        temporary_master.unlink()
    try:
        command = [
            str(FFMPEG),
            "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-map", "0:v:0", "-map", "0:a:0",
            "-c", "copy", "-movflags", "+faststart",
            str(temporary_master),
        ]
        result = run(command)
        if result.returncode != 0:
            raise FinalizationError(f"FFmpeg stream-copy concat failed: {result.stderr.strip()}")
        if not temporary_master.is_file() or temporary_master.stat().st_size <= 10_000:
            raise FinalizationError("FFmpeg produced no valid temporary master")

        concat_input = ["-f", "concat", "-safe", "0", "-i", str(concat_list)]
        candidate_input = ["-i", str(temporary_master)]
        source_audio_hash = stream_hash(concat_input, "0:a:0", "copy")
        candidate_audio_hash = stream_hash(candidate_input, "0:a:0", "copy")
        source_video_packet_hash = stream_hash(concat_input, "0:v:0", "copy")
        candidate_video_packet_hash = stream_hash(candidate_input, "0:v:0", "copy")
        source_decoded_video_hash = stream_hash(concat_input, "0:v:0", "rawvideo")
        candidate_decoded_video_hash = stream_hash(candidate_input, "0:v:0", "rawvideo")
        if source_audio_hash != candidate_audio_hash:
            raise FinalizationError("Candidate audio packet hash differs from concatenated model audio")
        if source_decoded_video_hash != candidate_decoded_video_hash:
            raise FinalizationError("Candidate decoded video differs from concatenated approved clip frames")
        return {
            "mode": "ffmpeg_concat_demuxer_stream_copy",
            "publication": "candidate_validated_before_atomic_replace",
            "video_codec_action": "copy",
            "audio_codec_action": "copy",
            "external_voice_or_audio_added": False,
            "source_audio_packet_sha256": source_audio_hash,
            "final_audio_packet_sha256": candidate_audio_hash,
            "audio_packet_hash_match": True,
            "source_video_packet_sha256": source_video_packet_hash,
            "final_video_packet_sha256": candidate_video_packet_hash,
            "video_packet_hash_match": source_video_packet_hash == candidate_video_packet_hash,
            "video_packet_hash_note": "Container remuxing can normalize headers; decoded-frame equality is the visual preservation gate.",
            "source_decoded_video_sha256": source_decoded_video_hash,
            "final_decoded_video_sha256": candidate_decoded_video_hash,
            "decoded_video_hash_match": True,
        }
    except BaseException:
        if temporary_master.exists():
            temporary_master.unlink()
        raise


def inspect_master(final_master: Path, expected_duration: float) -> dict[str, Any]:
    capture = cv2.VideoCapture(str(final_master))
    if not capture.isOpened():
        raise FinalizationError("OpenCV could not decode the final master")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    capture.release()
    duration = frame_count / fps if fps > 0 else 0.0
    data = final_master.read_bytes()
    audio = audio_metrics(decode_audio_pcm(final_master))
    ok = (
        len(data) > 10_000
        and b"ftyp" in data[:128]
        and b"vide" in data
        and b"soun" in data
        and width > 0
        and height > 0
        and fps > 0
        and frame_count > 0
        and abs((width / height) - (16 / 9)) <= 0.06
        and abs(duration - expected_duration) <= MASTER_DURATION_TOLERANCE_SECONDS
        and abs(audio["decoded_duration_seconds"] - expected_duration) <= MASTER_DURATION_TOLERANCE_SECONDS
        and audio["active_window_ratio"] >= 0.02
    )
    return {
        "file": relative(final_master),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "width": width,
        "height": height,
        "fps": round(fps, 4),
        "frame_count": frame_count,
        "measured_video_duration_seconds": round(duration, 4),
        "audio": audio,
        "has_video_track": b"vide" in data,
        "has_audio_track": b"soun" in data,
        "ok": ok,
    }


def print_clip_qc(records: list[dict[str, Any]]) -> None:
    for record in records:
        print(
            f"{record['clip_id']} {record['width']}x{record['height']} {record['fps']}fps "
            f"{record['measured_video_duration_seconds']}s motion={record['motion_score']} "
            f"audio={record['audio']['mean_dbfs']}dB active={record['audio']['active_window_ratio']} "
            f"ok={record['ok']}"
        )
    measured_total = sum(record["measured_video_duration_seconds"] for record in records)
    print(f"clips total={measured_total:.4f}s unique={len({record['sha256'] for record in records})}/{len(records)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Offline Luna clip QC or finalization. --qc-only writes QC artifacts but never approves or concatenates."
    )
    parser.add_argument("--manifest", required=True, help="Manifest path below tools/playveo/luna-series/manifests")
    parser.add_argument(
        "--qc-only",
        action="store_true",
        help="Write contact-sheet/QC artifacts only; do not approve, concatenate, or create a final master.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not FFMPEG.is_file():
        raise FinalizationError(f"imageio-ffmpeg binary is missing: {FFMPEG}")
    manifest_path = resolve_manifest(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    clips = validate_manifest_integrity(manifest, manifest_path)
    output_root = resolve_output_root(manifest)
    state_path, state = load_state(manifest, output_root)
    state_context = verify_state_and_local_files(manifest, clips, output_root, state)

    qc_dir = output_root / "qc"
    contact_sheet = qc_dir / "clips-contact-sheet.jpg"
    clip_report_path = qc_dir / "clips-qc-report.json"
    concat_list = qc_dir / "concat-list.txt"
    final_report_path = qc_dir / "final-qc-report.json"
    final_master = output_root / f"{output_root.name}-final.mp4"
    temporary_master = output_root / "_finalizing.mp4"

    source_review_approval: dict[str, Any] = {"status": "not_checked"}
    clip_review: dict[str, Any] = {}
    overlay_approval: dict[str, Any] = {"required": False, "status": "not_applicable"}
    if not args.qc_only:
        # Finalization mode must pass every immutable human gate before any QC
        # artifact, concat list, temporary master, or final master is written.
        source_review_approval = require_approved_source_reviews(manifest, state)
        clip_review = require_approved_clip_review(
            manifest,
            clips,
            output_root,
            state,
            source_review_approval,
        )
        if manifest.get("pipeline", {}).get("profile") == OVERLAY_PROFILE:
            overlay_approval = {
                "required": True,
                **require_overlay_evidence(
                    manifest,
                    clips,
                    output_root,
                    state,
                    source_review_approval,
                ),
            }

    rows, records = inspect_clips(clips, output_root)
    create_contact_sheet(rows, contact_sheet)
    measured_total = sum(record["measured_video_duration_seconds"] for record in records)
    expected_total = float(manifest["format"]["expected_total_seconds"])
    aggregate_duration_error = measured_total - expected_total
    aggregate_duration_ok = abs(aggregate_duration_error) <= MASTER_DURATION_TOLERANCE_SECONDS
    ffmpeg_version = run([str(FFMPEG), "-version"]).stdout.splitlines()[0]
    overlay_snapshot = overlay_gate_snapshot(manifest, clips, output_root, state)

    clip_report = {
        "schema_version": "luna-series.clip-qc/v1",
        "report_type": "offline_clip_structural_qc",
        "generated_at": utc_now(),
        "production_id": manifest["production_id"],
        "manifest": manifest["_finalizer_context"],
        "state_file": relative(state_path),
        "ffmpeg": ffmpeg_version,
        "clip_count": len(records),
        "expected_script_seconds": expected_total,
        "master_duration_tolerance_seconds": MASTER_DURATION_TOLERANCE_SECONDS,
        "measured_clip_total_seconds": round(measured_total, 4),
        "aggregate_duration_error_seconds": round(aggregate_duration_error, 4),
        "aggregate_duration_within_tolerance": aggregate_duration_ok,
        "unique_clip_sha256_count": len({record["sha256"] for record in records}),
        "all_clips_structural_motion_audio_signal_ok": all(record["ok"] for record in records),
        "production_state": state_context,
        "overlay_gate": overlay_snapshot,
        "execution_guards": {
            "offline_only": True,
            "network_requests_sent": 0,
            "provider_submissions_sent": 0,
            "production_state_modified": False,
            "review_status_modified": False,
            "concat_or_final_master_modified": False,
        },
        "model_audio_policy": {
            "external_tts_used": False,
            "external_dubbing_used": False,
            "semantic_dialogue_note": "Automatic QC proves a decodable active audio signal. Exact Arabic wording, pronunciation, voice identity, timing, and mix still require human listening.",
        },
        "human_review": {
            "status": state_context["review_status"],
            "required_before_finalization": state_context["review_status"] != "approved",
            "automated_qc_is_not_human_approval": True,
            "release_gate_open": False,
            "queue": [
                {
                    "clip_id": clip["id"],
                    "file": clip["file"],
                    "expected_timeline": clip.get("timeline", []),
                    "visual_decision": "pending",
                    "audio_decision": "pending",
                }
                for clip in clips
            ],
        },
        "contact_sheet": relative(contact_sheet),
        "clips": records,
        "all_automated_checks_ok": all(record["ok"] for record in records) and aggregate_duration_ok,
    }
    qc_dir.mkdir(parents=True, exist_ok=True)
    clip_report_path.write_text(json.dumps(clip_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.qc_only:
        print_clip_qc(records)
        print(f"contact sheet={relative(contact_sheet)}")
        print(f"clip QC report={relative(clip_report_path)}")
        print(
            "qc-only wrote QC artifacts; no approval, state change, provider request, "
            "concat, or final-master change was performed"
        )
        return

    # The immutable approval objects above remain the only approval snapshot
    # used for this run; they are not re-read or synthesized after QC.
    if not aggregate_duration_ok:
        raise FinalizationError(
            f"Measured clip total differs from the manifest 180-second duration by "
            f"{aggregate_duration_error:.4f}s (allowed {MASTER_DURATION_TOLERANCE_SECONDS:.1f}s)"
        )
    write_concat_list(clips, output_root, concat_list)
    try:
        merge = merge_stream_copy(concat_list, temporary_master)
        master = inspect_master(temporary_master, expected_total)
        if not master["ok"]:
            raise FinalizationError(
                "Temporary master failed duration, stream, decode, aspect, or audio-signal validation"
            )
        master["validated_candidate_file"] = relative(temporary_master)
        os.replace(temporary_master, final_master)
        master["file"] = relative(final_master)
        master["published_after_candidate_qc"] = True
        merge["published_final_master"] = relative(final_master)
    except BaseException:
        if temporary_master.exists():
            temporary_master.unlink()
        raise

    report = {
        "schema_version": "luna-series.final-qc/v1",
        "generated_at": utc_now(),
        "production_id": manifest["production_id"],
        "manifest": manifest["_finalizer_context"],
        "ffmpeg": ffmpeg_version,
        "clip_count": len(records),
        "expected_script_seconds": expected_total,
        "master_duration_tolerance_seconds": MASTER_DURATION_TOLERANCE_SECONDS,
        "measured_clip_total_seconds": round(measured_total, 4),
        "aggregate_duration_error_seconds": round(aggregate_duration_error, 4),
        "aggregate_duration_within_tolerance": aggregate_duration_ok,
        "unique_clip_sha256_count": len({record["sha256"] for record in records}),
        "all_clips_structural_motion_audio_signal_ok": all(record["ok"] for record in records),
        "source_reviews": source_review_approval,
        "human_clip_review": clip_review,
        "overlay_approval": overlay_approval,
        "model_audio_policy": {
            "external_tts_used": False,
            "external_dubbing_used": False,
            "music_or_sfx_added_during_montage": False,
            "semantic_dialogue_note": "Automatic QC proves active audio and exact packet preservation; semantic Arabic approval comes from the immutable human clip review.",
        },
        "merge": merge,
        "contact_sheet": relative(contact_sheet),
        "clips": records,
        "final_master": master,
        "all_automated_checks_ok": (
            all(record["ok"] for record in records)
            and aggregate_duration_ok
            and merge["audio_packet_hash_match"]
            and merge["decoded_video_hash_match"]
            and master["ok"]
        ),
        "all_release_gates_ok": (
            source_review_approval["status"] == "approved"
            and clip_review["status"] == "approved"
            and overlay_approval["status"] in {"approved", "not_applicable"}
            and aggregate_duration_ok
            and all(record["ok"] for record in records)
            and merge["audio_packet_hash_match"]
            and merge["decoded_video_hash_match"]
            and master["ok"]
        ),
    }
    final_report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print_clip_qc(records)
    print(f"audio packet preservation={merge['audio_packet_hash_match']}")
    print(f"decoded video preservation={merge['decoded_video_hash_match']}")
    print(
        f"final={relative(final_master)} {master['width']}x{master['height']} "
        f"{master['measured_video_duration_seconds']}s audio={master['has_audio_track']} ok={master['ok']}"
    )
    print(f"contact sheet={relative(contact_sheet)}")
    print(f"report={relative(final_report_path)}")


if __name__ == "__main__":
    try:
        main()
    except (FinalizationError, json.JSONDecodeError, OSError) as error:
        raise SystemExit(f"ERROR: {error}") from error
