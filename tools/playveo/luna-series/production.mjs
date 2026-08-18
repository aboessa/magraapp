#!/usr/bin/env node
// Pure local preproduction validation and planning for Luna E02-E06.
// This module intentionally has no network, credential, provider execution, or state-writing path.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  canonicalJson,
  computeReferencePackSha256,
} from '../../content-factory/lib/contract.mjs';
import { approvedVisualIdentityPack } from '../../content-factory/lib/visual-identity-registry.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SERIES_ROOT = path.resolve(import.meta.dirname);
const MANIFEST_ROOT = path.join(SERIES_ROOT, 'manifests');
const EPISODE_OUTPUT_ROOT = path.join(ROOT, 'assets', 'episodes');
const SCHEMA_VERSION = 'luna-series.preproduction/v1';
const PRICING_VERSION = 'playveo-observed-2026-08-12-v1';
const EXPECTED_EPISODES = new Set([2, 3, 4, 5, 6]);
const EXPECTED_DIALOGUE_COUNTS = new Map([[2, 37], [3, 37], [4, 35], [5, 36], [6, 31]]);
const OVERLAY_EPISODES = new Set([3, 4]);
const SIMPLE_EPISODES = new Set([2, 5, 6]);
const DISALLOWED_EXECUTION_FLAGS = new Set([
  '--run',
  '--dispatch',
  '--allow-paid',
  '--retry-failed',
  '--resume',
  '--approve-spend',
  '--approve-clips',
]);
const URI_SCHEME_RE = /\b[A-Za-z][A-Za-z0-9+.-]*:(?=\/\/|[^\s/])/;
const SECRET_KEY_RE = /(?:api[_-]?key|authorization|password|passphrase|secret|private[_-]?key|client[_-]?secret|credential|access[_-]?token|refresh[_-]?token|session[_-]?token|bearer|cookie)/i;
const SECRET_VALUE_RE = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|client[_-]?secret|password|passphrase|private[_-]?key|secret|signature)\s*[=:]|\bbearer\s+[A-Za-z0-9._~+/-]+|-----BEGIN[^\r\n]*PRIVATE KEY-----/i;
const SHA256_RE = /^[a-f0-9]{64}$/;
const ARABIC_RE = /[\u0600-\u06ff]/;

const EXPECTED_TRACE_PATHS = {
  lam: {
    glyph: 'ل',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    stroke_paths: [
      { id: 's1', order: 1, points: [[0.55, 0.20], [0.55, 0.62], [0.40, 0.75], [0.30, 0.68]], direction: 'forward' },
    ],
  },
  waw: {
    glyph: 'و',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    stroke_paths: [
      { id: 's1', order: 1, points: [[0.58, 0.38], [0.48, 0.32], [0.40, 0.40], [0.48, 0.50], [0.58, 0.46]], direction: 'forward' },
      { id: 's2', order: 2, points: [[0.58, 0.46], [0.58, 0.72]], direction: 'forward' },
    ],
  },
  noon: {
    glyph: 'ن',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    stroke_paths: [
      { id: 's1', order: 1, points: [[0.68, 0.42], [0.62, 0.62], [0.50, 0.70], [0.38, 0.62], [0.32, 0.42]], direction: 'forward' },
      { id: 's2', order: 2, points: [[0.50, 0.28]], type: 'dot' },
    ],
  },
  alif: {
    glyph: 'ا',
    letter_form: 'isolated',
    writing_direction: 'rtl',
    stroke_paths: [
      { id: 's1', order: 1, points: [[0.50, 0.22], [0.50, 0.74]], direction: 'forward' },
    ],
  },
};

class ValidationError extends Error {
  constructor(manifestPath, errors) {
    super(`Manifest validation failed: ${relative(manifestPath)}`);
    this.name = 'ValidationError';
    this.manifestPath = manifestPath;
    this.errors = errors;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function approximatelyEqual(left, right, epsilon = 1e-9) {
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= epsilon;
}

function confinedPath(base, candidate, label, errors, { allowBase = false } = {}) {
  if (typeof candidate !== 'string' || candidate.length === 0 || path.isAbsolute(candidate)) {
    errors.push(`${label} must be a non-empty repository-relative path`);
    return null;
  }
  const resolved = path.resolve(ROOT, candidate);
  const relation = path.relative(base, resolved);
  if (relation.startsWith('..') || path.isAbsolute(relation) || (!allowBase && relation === '')) {
    errors.push(`${label} escapes its allowed root`);
    return null;
  }
  return resolved;
}

function confinedChild(base, candidate, label, errors) {
  if (typeof candidate !== 'string' || candidate.length === 0 || path.isAbsolute(candidate)) {
    errors.push(`${label} must be a non-empty relative path`);
    return null;
  }
  const resolved = path.resolve(base, candidate);
  const relation = path.relative(base, resolved);
  if (relation.startsWith('..') || path.isAbsolute(relation) || relation === '') {
    errors.push(`${label} escapes its output root`);
    return null;
  }
  return resolved;
}

function walkForForbiddenContent(value, currentPath = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForForbiddenContent(item, `${currentPath}[${index}]`, findings));
    return findings;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${currentPath}.${key}`;
      if (SECRET_KEY_RE.test(key)) findings.push(`${childPath}: secret-like key is forbidden`);
      walkForForbiddenContent(child, childPath, findings);
    }
    return findings;
  }
  if (typeof value === 'string') {
    if (URI_SCHEME_RE.test(value)) findings.push(`${currentPath}: URI scheme is forbidden`);
    if (SECRET_VALUE_RE.test(value)) findings.push(`${currentPath}: secret-like value is forbidden`);
  }
  return findings;
}

function parseClock(value) {
  const match = String(value).match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (seconds > 59) return null;
  return minutes * 60 + seconds;
}

function parseSourceRange(value) {
  const match = String(value).match(/^(\d+:\d{2})-(\d+:\d{2})$/);
  if (!match) return null;
  const start = parseClock(match[1]);
  const end = parseClock(match[2]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function extractSourceDialogue(markdown) {
  const heading = /^##\s+نص التعليق الصوتي للتسجيل\s*$/m;
  const headingMatch = heading.exec(markdown);
  if (!headingMatch) throw new Error('Source recording-script heading is missing');
  const remainder = markdown.slice(headingMatch.index + headingMatch[0].length);
  const blockMatch = remainder.match(/```[^\r\n]*\r?\n([\s\S]*?)\r?\n```/);
  if (!blockMatch) throw new Error('Source recording-script code block is missing');
  return blockMatch[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\d+\.\s+(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => match[1]);
}

function overlayPlanProjection(plan) {
  const projection = structuredClone(plan);
  delete projection.overlay_plan_sha256;
  return projection;
}

function buildVisualPrompt(manifest, clip) {
  const locks = manifest.shared_locks;
  const direction = manifest.episode_direction;
  const overlayPolicy = OVERLAY_EPISODES.has(manifest.episode.episode_number)
    ? 'The model must leave every pedagogical display surface blank. Do not draw text, letters, words, captions, pseudo-writing, dotted glyph paths, or glyph-like marks. Deterministic post-model overlay data is applied separately.'
    : 'Do not draw text, letters, words, captions, numbers, logos, or labels. Player and application overlays are separate from the generated picture.';
  return [
    `Create one continuous ${clip.duration_seconds}-second 16:9 HD stylized 3D preschool cartoon shot.`,
    `CURRENT SHOT\n${clip.visual}`,
    `STYLE LOCK\n${locks.style}`,
    `LUNA LOCK\n${locks.luna}`,
    `NAJMI LOCK\n${locks.najmi}`,
    `BASE WORLD LOCK\n${locks.base_world}`,
    `EPISODE WORLD\n${direction.world}`,
    `EPISODE PROPS\n${direction.props}`,
    `CAMERA LOCK\n${locks.camera}`,
    `VISUAL TEXT POLICY\n${overlayPolicy}`,
    `NEGATIVE LOCK\n${locks.negative}`,
  ].join('\n\n');
}

function buildPrompt(manifest, clip) {
  const locks = manifest.shared_locks;
  return [
    buildVisualPrompt(manifest, clip),
    `AUDIO VOICE LOCK\n${locks.voice}`,
    `EXACT DIALOGUE RULE\n${locks.dialogue_rule}`,
    `EPISODE PRONUNCIATION\n${manifest.episode_direction.pronunciation}`,
    `AUDIO MIX LOCK\n${locks.mix}\n${locks.silence_rule}`,
    `EXACT SPOKEN DIALOGUE IN ORDER\n${clip.exact_spoken_dialogue.map((line, index) => `${index + 1}. ${line}`).join('\n') || 'No spoken dialogue.'}`,
    `TIMELINE\n${clip.timeline.map((event) => {
      const payload = event.spoken ? `SPEAK EXACTLY: ${event.spoken}` : event.action;
      return `- ${event.at_seconds}s: ${payload}`;
    }).join('\n')}`,
    'DELIVERY RULES\nGenerate the Arabic performance, lip-sync, ambience, music, and sound effects inside the clip. Do not add, omit, translate, paraphrase, or repeat dialogue. Preserve specified silent response windows. Never replace speech with subtitles.',
  ].join('\n\n').trim();
}

function validateIdentity(manifest, errors) {
  const identity = manifest.visual_identity;
  if (!isPlainObject(identity)) {
    errors.push('visual_identity is required');
    return;
  }
  if (identity.status !== 'approved') errors.push('visual_identity.status must be approved');
  if (identity.series_slug !== manifest.episode?.series_slug) errors.push('visual_identity series_slug differs from the episode series');
  if (!Array.isArray(identity.references) || identity.references.length < 2) {
    errors.push('visual_identity requires immutable character_sheet and visual_guide references');
  } else {
    const referenceKeys = new Set();
    for (const [index, reference] of identity.references.entries()) {
      if (!isPlainObject(reference)) {
        errors.push(`visual_identity reference ${index} is invalid`);
        continue;
      }
      const key = `${reference.kind}\u0000${reference.path}`;
      if (referenceKeys.has(key)) errors.push(`duplicate visual identity reference: ${reference.path}`);
      referenceKeys.add(key);
      const resolved = confinedPath(ROOT, reference.path, `visual_identity.references[${index}].path`, errors);
      if (!resolved) continue;
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        errors.push(`visual identity reference is missing: ${reference.path}`);
        continue;
      }
      if (!SHA256_RE.test(reference.sha256 ?? '') || sha256File(resolved) !== reference.sha256) {
        errors.push(`visual identity reference hash mismatch: ${reference.path}`);
      }
    }
  }
  if (!identity.references?.some((reference) => reference.kind === 'character_sheet')) {
    errors.push('visual_identity must include character_sheet');
  }
  if (!identity.references?.some((reference) => reference.kind === 'visual_guide')) {
    errors.push('visual_identity must include visual_guide');
  }
  if (computeReferencePackSha256(identity) !== identity.reference_pack_sha256) {
    errors.push('visual_identity reference_pack_sha256 is stale');
  }
  const registered = approvedVisualIdentityPack(identity.series_slug, identity.version);
  if (!registered) {
    errors.push('visual_identity is not in the trusted registry');
  } else if (canonicalJson(registered) !== canonicalJson(identity)) {
    errors.push('visual_identity differs from the trusted registry entry');
  }

  const guideReference = identity.references?.find((reference) => reference.kind === 'visual_guide');
  if (guideReference) {
    const guidePath = confinedPath(ROOT, guideReference.path, 'visual guide path', errors);
    if (guidePath && fs.existsSync(guidePath)) {
      const guide = readJson(guidePath);
      const locks = manifest.shared_locks ?? {};
      const expectedVisual = guide.visual_direction ?? {};
      const pairs = [
        ['style', expectedVisual.style],
        ['luna', expectedVisual.luna],
        ['najmi', expectedVisual.najmi],
        ['base_world', expectedVisual.world],
        ['camera', expectedVisual.camera],
        ['negative', expectedVisual.negative],
      ];
      for (const [key, expected] of pairs) {
        if (locks[key] !== expected) errors.push(`shared_locks.${key} drifted from the approved visual guide`);
      }
      if (locks.visual_guide_sha256 !== guideReference.sha256 || locks.visual_guide_path !== guideReference.path) {
        errors.push('shared visual guide path/hash differs from the approved identity reference');
      }
      if (manifest.episode_direction?.pronunciation === guide.audio_direction?.pronunciation) {
        errors.push('episode pronunciation must be episode-specific and must not copy E01 pronunciation');
      }
    }
  }
}

function validateOverlay(manifest, errors) {
  const episodeNumber = manifest.episode.episode_number;
  const overlay = manifest.overlay_plan;
  if (!isPlainObject(overlay) || overlay.required !== true) {
    errors.push('overlay_plan is required for E03/E04');
    return;
  }
  if (overlay.renderer_implemented !== false) errors.push('preproduction overlay renderer status must remain false until real implementation evidence exists');
  if (overlay.linguistic_and_calligraphy_review_required !== true || overlay.dispatch_blocked !== true) {
    errors.push('overlay plan must require specialist review and block dispatch');
  }
  if (!SHA256_RE.test(overlay.overlay_plan_sha256 ?? '')) {
    errors.push('overlay_plan_sha256 must be lowercase SHA-256');
  } else {
    const expectedHash = sha256(canonicalJson(overlayPlanProjection(overlay)));
    if (expectedHash !== overlay.overlay_plan_sha256) errors.push('overlay_plan_sha256 is stale');
  }
  if (overlay.execution_stage !== 'deterministic_post_model_pre_master') {
    errors.push('overlay execution stage must be deterministic_post_model_pre_master');
  }
  if (overlay.rendering?.direction !== 'rtl' || overlay.rendering?.shaping_required !== true || overlay.rendering?.bidi_required !== true) {
    errors.push('overlay rendering must explicitly require RTL shaping and bidi handling');
  }

  const assets = [...(overlay.font_assets ?? []), overlay.license].filter(Boolean);
  if (!assets.length || !overlay.selected_font) errors.push('overlay font assets, selected font, and license are required');
  for (const [index, asset] of assets.entries()) {
    const resolved = confinedPath(ROOT, asset.path, `overlay asset ${index}`, errors);
    if (!resolved) continue;
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      errors.push(`overlay asset is missing: ${asset.path}`);
      continue;
    }
    if (!SHA256_RE.test(asset.sha256 ?? '') || sha256File(resolved) !== asset.sha256) {
      errors.push(`overlay asset hash mismatch: ${asset.path}`);
    }
  }
  const selected = overlay.font_assets?.find((asset) => asset.path === overlay.selected_font.path);
  if (!selected || selected.sha256 !== overlay.selected_font.sha256 || selected.weight !== overlay.selected_font.weight) {
    errors.push('selected overlay font must match a fingerprinted font asset');
  }
  if (overlay.license?.identifier !== 'OFL-1.1') errors.push('Readex Pro overlay license must be OFL-1.1');

  const clipsById = new Map((manifest.clips ?? []).map((clip) => [clip.id, clip]));
  for (const clip of manifest.clips ?? []) {
    if (ARABIC_RE.test(clip.visual ?? '')) errors.push(`${clip.id} visual prompt contains Arabic; glyphs must remain overlay data only`);
    for (const event of clip.timeline ?? []) {
      if (event.action && ARABIC_RE.test(event.action)) errors.push(`${clip.id} visual timeline action contains Arabic glyph content`);
    }
    const visualPrompt = buildVisualPrompt(manifest, clip);
    if (ARABIC_RE.test(visualPrompt)) errors.push(`${clip.id} raw visual prompt contains Arabic glyphs`);
  }

  if (episodeNumber === 3) {
    const requiredGlyphs = new Set(['بـ', 'مـ', 'سـ', 'قـ']);
    const glyphs = overlay.glyphs ?? [];
    for (const glyph of glyphs) {
      if (glyph.form !== 'initial') errors.push(`E03 glyph ${glyph.glyph_id ?? '?'} must use initial form`);
      if (!requiredGlyphs.has(glyph.glyph)) errors.push(`E03 overlay contains an unsupported glyph: ${glyph.glyph}`);
      const clip = clipsById.get(glyph.clip_id);
      if (!clip) {
        errors.push(`E03 glyph ${glyph.glyph_id ?? '?'} references an unknown clip`);
      } else if (!Number.isFinite(glyph.start_seconds) || !Number.isFinite(glyph.duration_seconds)
        || glyph.start_seconds < 0 || glyph.duration_seconds <= 0
        || glyph.start_seconds + glyph.duration_seconds > clip.duration_seconds) {
        errors.push(`E03 glyph ${glyph.glyph_id ?? '?'} timing exceeds ${glyph.clip_id}`);
      }
      if (typeof glyph.anchor !== 'string' || glyph.anchor.length === 0) {
        errors.push(`E03 glyph ${glyph.glyph_id ?? '?'} requires an explicit anchor`);
      }
    }
    for (const required of requiredGlyphs) {
      if (!glyphs.some((glyph) => glyph.glyph === required)) errors.push(`E03 overlay is missing required initial glyph ${required}`);
    }
  }

  if (episodeNumber === 4) {
    const requiredGlyphs = new Map([['lam', 'ل'], ['waw', 'و'], ['noon', 'ن'], ['alif', 'ا']]);
    const glyphById = new Map();
    for (const [glyphId, glyphValue] of requiredGlyphs) {
      const glyph = overlay.glyphs?.find((item) => item.glyph_id === glyphId);
      if (!glyph || glyph.glyph !== glyphValue || glyph.form !== 'isolated') {
        errors.push(`E04 overlay requires isolated glyph ${glyphId}`);
      } else {
        glyphById.set(glyphId, glyph);
        if (!Array.isArray(glyph.clips) || glyph.clips.some((clipId) => !clipsById.has(clipId))) {
          errors.push(`E04 glyph ${glyphId} has an invalid clip reference`);
        }
      }
    }
    if (canonicalJson(overlay.trace_paths) !== canonicalJson(EXPECTED_TRACE_PATHS)) {
      errors.push('E04 trace paths differ from the source coordinates/order');
    }
    const noonStrokes = overlay.trace_paths?.noon?.stroke_paths ?? [];
    if (noonStrokes[0]?.order !== 1 || noonStrokes[1]?.order !== 2 || noonStrokes[1]?.type !== 'dot') {
      errors.push('E04 noon trace must draw the body first and touch the dot second');
    }

    const frameCoordinates = overlay.coordinate_system?.frame;
    const panelCoordinates = overlay.coordinate_system?.panel_local;
    if (frameCoordinates?.units !== 'normalized_0_to_1' || frameCoordinates?.origin !== 'top_left'
      || frameCoordinates?.x_axis !== 'right' || frameCoordinates?.y_axis !== 'down'
      || canonicalJson(frameCoordinates?.bounds) !== canonicalJson({ x_min: 0, y_min: 0, x_max: 1, y_max: 1 })) {
      errors.push('E04 frame coordinates must be explicit normalized top-left 0..1 coordinates');
    }
    if (panelCoordinates?.units !== 'normalized_0_to_1' || panelCoordinates?.origin !== 'top_left'
      || panelCoordinates?.x_axis !== 'right' || panelCoordinates?.y_axis !== 'down'
      || panelCoordinates?.trace_path_coordinates !== 'panel_local') {
      errors.push('E04 trace paths must use explicit normalized panel-local coordinates');
    }
    if (overlay.surface_tracking?.method !== 'planar_four_corner_track'
      || overlay.surface_tracking?.stable_surface_track_required !== true
      || overlay.surface_tracking?.full_panel_visible_required !== true
      || typeof overlay.surface_tracking?.camera_rule !== 'string'
      || overlay.surface_tracking.camera_rule.length === 0) {
      errors.push('E04 overlay requires stable planar panel tracking and a complete camera rule');
    }
    if (overlay.raw_model_staging?.physical_wand_outside_panel_required !== true
      || overlay.raw_model_staging?.raw_wand_path_following_forbidden !== true
      || overlay.guide_overlay?.rendered_by_overlay !== true
      || overlay.guide_overlay?.raw_model_motion_forbidden !== true
      || overlay.guide_overlay?.actor_id !== 'deterministic_wand_tip_cursor') {
      errors.push('E04 raw wand must stay outside the panel and all guide motion must be deterministic overlay data');
    }

    const validateRect = (rect, label, safeMargin = 0) => {
      if (!isPlainObject(rect)) {
        errors.push(`${label} must be a normalized rectangle`);
        return false;
      }
      const { x, y, width, height } = rect;
      const valid = [x, y, width, height].every(Number.isFinite)
        && width > 0 && height > 0
        && x >= safeMargin && y >= safeMargin
        && x + width <= 1 - safeMargin + 1e-9
        && y + height <= 1 - safeMargin + 1e-9;
      if (!valid) errors.push(`${label} exceeds normalized bounds`);
      return valid;
    };

    const summaryTiming = Array.isArray(overlay.timing) ? overlay.timing : [];
    for (const [index, timing] of summaryTiming.entries()) {
      const clip = clipsById.get(timing.clip_id);
      if (!clip) {
        errors.push(`E04 timing ${index} references an unknown clip`);
        continue;
      }
      const glyphIds = timing.sequence ?? (timing.glyph_id ? [timing.glyph_id] : []);
      const interval = timing.interval_seconds ?? 0;
      if (!Array.isArray(glyphIds) || glyphIds.length === 0 || glyphIds.some((glyphId) => !requiredGlyphs.has(glyphId))) {
        errors.push(`E04 timing ${index} has invalid glyph references`);
      }
      if (!Number.isFinite(timing.start_seconds) || timing.start_seconds < 0
        || !Number.isFinite(interval) || interval < 0
        || timing.start_seconds + Math.max(0, glyphIds.length - 1) * interval >= clip.duration_seconds) {
        errors.push(`E04 timing ${index} exceeds ${timing.clip_id}`);
      }
      if (typeof timing.anchor !== 'string' || timing.anchor.length === 0) errors.push(`E04 timing ${index} requires an anchor`);
    }

    const requiredClipIds = new Set(Array.from({ length: 8 }, (_, index) => `E04-C${String(index + 4).padStart(2, '0')}`));
    const schedules = Array.isArray(overlay.clip_overlays) ? overlay.clip_overlays : [];
    const scheduleIds = new Set();
    const observedPhases = new Set();
    const safeMargin = Number(overlay.rendering?.safe_area_pct) / 100;
    for (const [scheduleIndex, schedule] of schedules.entries()) {
      const label = `E04 clip_overlays[${scheduleIndex}]`;
      const clip = clipsById.get(schedule.clip_id);
      if (!clip) {
        errors.push(`${label} references an unknown clip`);
        continue;
      }
      if (scheduleIds.has(schedule.clip_id)) errors.push(`${label} duplicates ${schedule.clip_id}`);
      scheduleIds.add(schedule.clip_id);
      if (!requiredClipIds.has(schedule.clip_id)) errors.push(`${label} is outside required C04-C11 coverage`);
      if (typeof schedule.surface_track_id !== 'string' || schedule.surface_track_id.length === 0
        || typeof schedule.panel_anchor !== 'string' || schedule.panel_anchor.length === 0) {
        errors.push(`${label} requires a stable surface_track_id and panel_anchor`);
      }
      validateRect(schedule.panel_rect, `${label}.panel_rect`, Number.isFinite(safeMargin) ? safeMargin : 0.08);

      const targets = Array.isArray(schedule.targets) ? schedule.targets : [];
      const targetIds = new Set();
      const targetById = new Map();
      if (!targets.length) errors.push(`${label} requires at least one transformed glyph target`);
      for (const [targetIndex, target] of targets.entries()) {
        const targetLabel = `${label}.targets[${targetIndex}]`;
        if (typeof target.target_id !== 'string' || target.target_id.length === 0 || targetIds.has(target.target_id)) {
          errors.push(`${targetLabel} requires a unique target_id`);
          continue;
        }
        targetIds.add(target.target_id);
        targetById.set(target.target_id, target);
        if (!requiredGlyphs.has(target.glyph_id)) errors.push(`${targetLabel} references an unknown glyph`);
        validateRect(target.panel_local_rect, `${targetLabel}.panel_local_rect`);
        const transform = target.path_transform;
        if (!isPlainObject(transform)
          || ![transform.scale_x, transform.scale_y, transform.translate_x, transform.translate_y].every(Number.isFinite)
          || transform.scale_x <= 0 || transform.scale_y <= 0) {
          errors.push(`${targetLabel} requires an explicit positive scale and finite translation`);
        }
      }

      const phases = Array.isArray(schedule.phases) ? schedule.phases : [];
      if (!phases.length) errors.push(`${label} requires executable phases`);
      let previousEnd = 0;
      for (const [phaseIndex, phase] of phases.entries()) {
        const phaseLabel = `${label}.phases[${phaseIndex}]`;
        if (!['dotted_path', 'start_pulse', 'guide_draw', 'completed_hold', 'child_trace_hold'].includes(phase.phase)) {
          errors.push(`${phaseLabel} has an unsupported phase`);
        } else {
          observedPhases.add(phase.phase);
        }
        if (!Number.isFinite(phase.start_seconds) || !Number.isFinite(phase.end_seconds)
          || phase.start_seconds < 0 || phase.end_seconds <= phase.start_seconds
          || phase.end_seconds > clip.duration_seconds || phase.start_seconds < previousEnd) {
          errors.push(`${phaseLabel} has invalid, overlapping, or out-of-clip timing`);
        }
        previousEnd = Number.isFinite(phase.end_seconds) ? phase.end_seconds : previousEnd;
        if (!Array.isArray(phase.target_ids) || phase.target_ids.length === 0
          || phase.target_ids.some((targetId) => !targetIds.has(targetId))) {
          errors.push(`${phaseLabel} references an unknown target`);
        }
        if (phase.phase === 'start_pulse' && phase.pulse_count !== 2) {
          errors.push(`${phaseLabel} must use the source-defined two-pulse start marker`);
        }
        if (phase.phase === 'guide_draw') {
          if (phase.guide_actor !== overlay.guide_overlay?.actor_id
            || !Array.isArray(phase.stroke_ids) || phase.stroke_ids.length === 0
            || !Number.isFinite(phase.progress_start) || !Number.isFinite(phase.progress_end)
            || phase.progress_start < 0 || phase.progress_end > 1 || phase.progress_end <= phase.progress_start) {
            errors.push(`${phaseLabel} lacks deterministic guide/stroke/progress data`);
          }
          for (const targetId of phase.target_ids ?? []) {
            const glyphId = targetById.get(targetId)?.glyph_id;
            const validStrokeIds = new Set((overlay.trace_paths?.[glyphId]?.stroke_paths ?? []).map((stroke) => stroke.id));
            if ((phase.stroke_ids ?? []).some((strokeId) => !validStrokeIds.has(strokeId))) {
              errors.push(`${phaseLabel} references a stroke outside ${glyphId}`);
            }
          }
        }
      }
    }

    for (const clipId of requiredClipIds) {
      if (!scheduleIds.has(clipId)) errors.push(`E04 overlay schedule does not cover ${clipId}`);
      const clip = clipsById.get(clipId);
      if (clip && !/physical[^.]*wand[^.]*outside|physical[^.]*wand parked outside/i.test(clip.visual ?? '')) {
        errors.push(`${clipId} raw staging must keep the physical wand outside the tracked panel`);
      }
    }
    for (const phase of ['dotted_path', 'start_pulse', 'guide_draw', 'completed_hold', 'child_trace_hold']) {
      if (!observedPhases.has(phase)) errors.push(`E04 overlay schedule is missing ${phase}`);
    }

    const requiredGuideCompletions = [
      { clipId: 'E04-C04', targetId: 'lam-main', strokeId: 's1' },
      { clipId: 'E04-C06', targetId: 'waw-main', strokeId: 's1' },
      { clipId: 'E04-C06', targetId: 'waw-main', strokeId: 's2' },
      { clipId: 'E04-C08', targetId: 'noon-main', strokeId: 's1' },
      { clipId: 'E04-C10', targetId: 'alif-main', strokeId: 's1' },
    ];
    for (const requirement of requiredGuideCompletions) {
      const schedule = schedules.find((item) => item.clip_id === requirement.clipId);
      const segments = (schedule?.phases ?? [])
        .filter((phase) => phase.phase === 'guide_draw'
          && phase.target_ids?.includes(requirement.targetId)
          && phase.stroke_ids?.includes(requirement.strokeId))
        .sort((left, right) => left.start_seconds - right.start_seconds);
      let expectedProgress = 0;
      for (const segment of segments) {
        if (!approximatelyEqual(segment.progress_start, expectedProgress)) {
          errors.push(`${requirement.clipId} ${requirement.strokeId} guide progress is discontinuous`);
          break;
        }
        expectedProgress = segment.progress_end;
      }
      if (!segments.length || !approximatelyEqual(expectedProgress, 1)) {
        errors.push(`${requirement.clipId} must complete ${requirement.targetId}/${requirement.strokeId} from progress 0 to 1`);
      }
    }
    const wawGuideSchedule = schedules.find((item) => item.clip_id === 'E04-C06');
    const wawTailSegments = (wawGuideSchedule?.phases ?? []).filter((phase) => phase.phase === 'guide_draw'
      && phase.target_ids?.includes('waw-main') && phase.stroke_ids?.includes('s2'));
    const wawTailEnd = Math.max(-1, ...wawTailSegments.map((phase) => phase.end_seconds));
    const wawClip = clipsById.get('E04-C06');
    const wawHoldSchedule = schedules.find((item) => item.clip_id === 'E04-C07');
    if (!wawClip || !approximatelyEqual(wawTailEnd, wawClip.duration_seconds)
      || wawHoldSchedule?.phases?.[0]?.phase !== 'completed_hold'
      || wawHoldSchedule.phases[0].start_seconds !== 0) {
      errors.push('E04 waw s2 must finish at the end of C06 before C07 begins with completed_hold');
    }

    const timedClipIds = new Set(summaryTiming.map((timing) => timing.clip_id));
    for (const glyph of glyphById.values()) {
      for (const clipId of glyph.clips) {
        if (!scheduleIds.has(clipId) && !timedClipIds.has(clipId)) {
          errors.push(`E04 glyph ${glyph.glyph_id} clip ${clipId} has no executable or summary timing`);
        }
      }
    }
  }
}

function validateReviewsAndBlockers(manifest, errors) {
  if (manifest.source?.content_status !== 'draft' || manifest.reviews?.source_status !== 'draft') {
    errors.push('source and review status must remain draft');
  }
  if (manifest.pipeline?.dispatch_blocked !== true || manifest.reviews?.dispatch_blocked !== true) {
    errors.push('dispatch must remain blocked while source reviews are pending');
  }
  const requiredReviews = manifest.reviews?.required;
  if (!Array.isArray(requiredReviews)) {
    errors.push('reviews.required must be an array');
    return;
  }
  for (const reviewType of ['editorial', 'linguistic', 'educational']) {
    const review = requiredReviews.find((item) => item.review_type === reviewType);
    if (!review || review.required !== true || review.status !== 'pending') {
      errors.push(`${reviewType} review must be required and pending`);
    } else if (review.source_sha256 !== manifest.source.sha256) {
      errors.push(`${reviewType} review does not fingerprint the current source`);
    }
  }
  if (OVERLAY_EPISODES.has(manifest.episode.episode_number)) {
    const specialist = requiredReviews.find((item) => item.review_type === 'calligraphy_and_glyph');
    if (!specialist || specialist.required !== true || specialist.status !== 'pending' || specialist.source_sha256 !== manifest.source.sha256) {
      errors.push('E03/E04 calligraphy_and_glyph review must be required, pending, and source-bound');
    }
    if (manifest.reviews.preproduction_ready !== false) errors.push('E03/E04 cannot claim preproduction readiness before specialist review');
  } else if (manifest.reviews.preproduction_ready !== true) {
    errors.push('E02/E05/E06 should be preproduction-ready while still dispatch-blocked');
  }

  const blockers = Array.isArray(manifest.blockers) ? manifest.blockers : [];
  const blockerCodes = new Set(blockers.map((blocker) => blocker.code));
  for (const code of manifest.pipeline?.dispatch_blockers ?? []) {
    if (!blockerCodes.has(code)) errors.push(`pipeline dispatch blocker has no matching blocker record: ${code}`);
  }
  for (const blocker of blockers) {
    if (!/^[A-Z0-9_]+$/.test(blocker.code ?? '')) errors.push(`invalid blocker code: ${blocker.code}`);
    if (!['error', 'hard_block'].includes(blocker.severity)) errors.push(`${blocker.code} must remain an error or hard_block`);
  }
}

function validatePackaging(manifest, errors) {
  if (manifest.packaging?.generated_now !== false || !Array.isArray(manifest.packaging?.requirements)) {
    errors.push('packaging requirements must be declared as not generated now');
    return;
  }
  const thumbnail = manifest.packaging.requirements.find((item) => item.kind === 'thumbnail');
  const captions = manifest.packaging.requirements.find((item) => item.kind === 'captions');
  if (!thumbnail || thumbnail.required !== true || thumbnail.status !== 'not_generated' || thumbnail.aspect_ratio !== '16:9') {
    errors.push('a pending 16:9 thumbnail packaging requirement is required');
  }
  if (!captions || captions.required !== true || captions.status !== 'not_generated'
    || captions.format !== 'webvtt' || captions.locale !== 'ar'
    || captions.delivery !== 'player_overlay' || captions.burned_in !== false) {
    errors.push('a pending Arabic WebVTT player-overlay captions requirement is required');
  }
  const outputRoot = path.resolve(ROOT, manifest.output_root ?? '');
  for (const requirement of manifest.packaging.requirements) {
    confinedChild(outputRoot, requirement.file, `packaging ${requirement.kind} file`, errors);
  }
}

function validateEpisodeSpecificRules(manifest, errors) {
  const episode = manifest.episode;
  if (episode.series_id !== 'luna-discovers-words' || episode.series_slug !== 'luna-discovers-words') {
    errors.push('series_id and series_slug must be normalized to luna-discovers-words');
  }
  if (episode.supervision_level !== 'recommended') errors.push('supervision_level must be recommended');
  if (episode.duration_seconds !== 180 || manifest.format?.expected_total_seconds !== 180) {
    errors.push('episode and format duration must both be exactly 180 seconds');
  }
  if (manifest.format?.aspect_ratio !== '16:9' || manifest.format?.resolution !== 'hd') {
    errors.push('format must be 16:9 HD');
  }
  if (SIMPLE_EPISODES.has(episode.episode_number)) {
    if (manifest.pipeline?.profile !== 'model_video_audio') errors.push('E02/E05/E06 require model_video_audio pipeline');
    if (manifest.ui_overlays?.delivery !== 'player_or_application_layer' || manifest.ui_overlays?.burned_in !== false) {
      errors.push('E02/E05/E06 labels and captions must remain non-burned player/UI overlays');
    }
  }
  if (OVERLAY_EPISODES.has(episode.episode_number)
    && manifest.pipeline?.profile !== 'model_video_audio_plus_deterministic_glyph_overlay') {
    errors.push('E03/E04 require deterministic glyph overlay pipeline');
  }
  const pipeline = manifest.pipeline ?? {};
  if (pipeline.factory_profile !== 'cartoon_video_model_audio'
    || pipeline.operation !== 'text-to-video-model-audio'
    || pipeline.model_audio_required !== true
    || pipeline.external_tts_forbidden !== true
    || pipeline.external_dubbing_forbidden !== true
    || pipeline.retain_model_audio_in_master !== true
    || pipeline.provider_result_urls_persisted !== false) {
    errors.push('model-audio production policy is incomplete or unsafe');
  }
  if (manifest.runtime_state_policy?.provider_result_urls_persisted !== false
    || manifest.runtime_state_policy?.create_placeholder !== false) {
    errors.push('runtime state policy must forbid persisted result URLs and placeholder creation');
  }
  const outputRoot = path.resolve(ROOT, manifest.output_root ?? '');
  const statePath = confinedChild(
    outputRoot,
    manifest.runtime_state_policy?.state_file,
    'runtime_state_policy.state_file',
    errors,
  );
  if (statePath && path.extname(statePath).toLowerCase() !== '.json') {
    errors.push('runtime_state_policy.state_file must be a JSON file below output_root');
  }

  if (episode.episode_number === 6) {
    const expectedPrerequisites = ['ep-01', 'ep-02', 'ep-03', 'ep-04', 'ep-05'];
    if (episode.age_min !== 4 || canonicalJson(episode.prerequisites) !== canonicalJson(expectedPrerequisites)) {
      errors.push('E06 must use age_min 4 and preserve all five prerequisites');
    }
    const override = manifest.source?.overrides?.find((item) => item.field === 'age_min');
    if (!override || override.source_value !== 3 || override.production_value !== 4 || !String(override.reason).includes('prerequisite')) {
      errors.push('E06 must record the explicit source age override and prerequisite rationale');
    }
    const notes = (manifest.source?.production_notes ?? []).join('\n');
    if (!notes.includes('شَجرة') || !notes.includes('طائِر') || !notes.includes('exactly the two new words')) {
      errors.push('E06 must resolve the new-word contradiction as exactly tree and bird, with all others review');
    }
  }
}

function validateBudget(manifest, errors) {
  const budget = manifest.budget ?? {};
  if (budget.unit !== 'credits' || budget.pricing_version !== PRICING_VERSION) errors.push('budget unit or pricing version is invalid');
  if (!approximatelyEqual(budget.baseline_credits, 9)
    || !approximatelyEqual(budget.contingency_pct, 15)
    || !approximatelyEqual(budget.contingency_credits, 1.35)
    || !approximatelyEqual(budget.ceiling_credits, 10.35)) {
    errors.push('episode budget must be exactly 9 + 1.35 contingency = 10.35 credits');
  }
  if (!approximatelyEqual(budget.baseline_credits * budget.contingency_pct / 100, budget.contingency_credits)
    || !approximatelyEqual(budget.baseline_credits + budget.contingency_credits, budget.ceiling_credits)) {
    errors.push('budget arithmetic is inconsistent');
  }
  const duration = (manifest.clips ?? []).reduce((sum, clip) => sum + (Number(clip.duration_seconds) || 0), 0);
  if (!approximatelyEqual(duration * 0.05, budget.baseline_credits)) {
    errors.push('baseline does not match the established 0.05 credits per second catalog rate');
  }
}

function validateClips(manifest, errors) {
  const clips = manifest.clips;
  if (!Array.isArray(clips) || clips.length === 0) {
    errors.push('clips must be a non-empty array');
    return { dialogue: [], maxPromptCharacters: 0, promptJobs: [] };
  }
  const ids = new Set();
  const files = new Set();
  const outputRoot = path.resolve(ROOT, manifest.output_root ?? '');
  let totalSeconds = 0;
  let previousRangeEnd = 0;
  const dialogue = [];
  const promptJobs = [];

  for (const [index, clip] of clips.entries()) {
    if (!isPlainObject(clip)) {
      errors.push(`clip ${index} must be an object`);
      continue;
    }
    if (!/^E\d{2}-C\d{2}$/.test(clip.id ?? '')) errors.push(`invalid clip id: ${clip.id}`);
    if (ids.has(clip.id)) errors.push(`duplicate clip id: ${clip.id}`);
    ids.add(clip.id);
    if (files.has(clip.file)) errors.push(`duplicate clip file: ${clip.file}`);
    files.add(clip.file);
    const destination = confinedChild(outputRoot, clip.file, `${clip.id} file`, errors);
    if (destination && path.extname(destination).toLowerCase() !== '.mp4') errors.push(`${clip.id} file must be MP4`);
    if (!Number.isInteger(clip.duration_seconds) || clip.duration_seconds < 5 || clip.duration_seconds > 20) {
      errors.push(`${clip.id} duration must be an integer from 5 to 20 seconds`);
    }
    totalSeconds += Number(clip.duration_seconds) || 0;

    const range = parseSourceRange(clip.source_range);
    if (!range) {
      errors.push(`${clip.id} has an invalid source_range`);
    } else {
      if (range.start !== previousRangeEnd) errors.push(`${clip.id} source_range is not contiguous`);
      if (range.end - range.start !== clip.duration_seconds) errors.push(`${clip.id} source_range duration mismatch`);
      previousRangeEnd = range.end;
    }

    if (typeof clip.visual !== 'string' || clip.visual.trim().length === 0) errors.push(`${clip.id} visual is required`);
    if (!Array.isArray(clip.timeline) || clip.timeline.length === 0) errors.push(`${clip.id} timeline is required`);
    let previousEventTime = -1;
    const timelineDialogue = [];
    for (const [eventIndex, event] of (clip.timeline ?? []).entries()) {
      if (!isPlainObject(event) || !Number.isFinite(event.at_seconds)
        || event.at_seconds < 0 || event.at_seconds >= clip.duration_seconds) {
        errors.push(`${clip.id} timeline event ${eventIndex} has an invalid at_seconds`);
        continue;
      }
      if (event.at_seconds < previousEventTime) errors.push(`${clip.id} timeline events are out of order`);
      previousEventTime = event.at_seconds;
      const hasSpoken = typeof event.spoken === 'string' && event.spoken.length > 0;
      const hasAction = typeof event.action === 'string' && event.action.length > 0;
      if (hasSpoken === hasAction) errors.push(`${clip.id} timeline event ${eventIndex} must contain exactly one of spoken or action`);
      if (hasSpoken) timelineDialogue.push(event.spoken);
    }
    if (!Array.isArray(clip.exact_spoken_dialogue)
      || canonicalJson(timelineDialogue) !== canonicalJson(clip.exact_spoken_dialogue)) {
      errors.push(`${clip.id} exact_spoken_dialogue differs from timeline spoken events`);
    }
    dialogue.push(...(clip.exact_spoken_dialogue ?? []));

    const prompt = buildPrompt(manifest, clip);
    if (prompt.length >= 10_000) errors.push(`${clip.id} prompt is ${prompt.length} characters; limit is below 10,000`);
    promptJobs.push({
      clip_id: clip.id,
      file: clip.file,
      duration_seconds: clip.duration_seconds,
      dialogue_count: clip.exact_spoken_dialogue?.length ?? 0,
      prompt_characters: prompt.length,
      prompt_sha256: sha256(prompt),
      estimated_credits: Number((clip.duration_seconds * 0.05).toFixed(6)),
    });
  }

  if (totalSeconds !== 180) errors.push(`clip duration sum is ${totalSeconds}, expected exactly 180`);
  if (previousRangeEnd !== 180) errors.push(`source ranges end at ${previousRangeEnd}, expected 180`);
  return {
    dialogue,
    maxPromptCharacters: Math.max(0, ...promptJobs.map((job) => job.prompt_characters)),
    promptJobs,
  };
}

function validateManifest(manifestPath) {
  const errors = [];
  const manifest = readJson(manifestPath);
  if (manifest.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (!isPlainObject(manifest.episode) || !EXPECTED_EPISODES.has(manifest.episode?.episode_number)) {
    errors.push('episode metadata is missing or episode_number is outside E02-E06');
  }
  const expectedDialogueCount = EXPECTED_DIALOGUE_COUNTS.get(manifest.episode?.episode_number);
  if (manifest.source?.dialogue_count !== expectedDialogueCount) errors.push(`source dialogue_count must be ${expectedDialogueCount}`);

  const sourcePath = confinedPath(ROOT, manifest.source?.path, 'source.path', errors);
  let sourceDialogue = [];
  if (sourcePath) {
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      errors.push(`source file is missing: ${manifest.source.path}`);
    } else {
      const sourceBytes = fs.readFileSync(sourcePath);
      if (!SHA256_RE.test(manifest.source.sha256 ?? '') || sha256(sourceBytes) !== manifest.source.sha256) {
        errors.push('source SHA-256 does not match current bytes');
      }
      try {
        sourceDialogue = extractSourceDialogue(sourceBytes.toString('utf8'));
      } catch (error) {
        errors.push(error.message);
      }
    }
  }

  const outputPath = confinedPath(EPISODE_OUTPUT_ROOT, manifest.output_root, 'output_root', errors);
  if (outputPath && !String(manifest.output_root).startsWith('assets/episodes/')) {
    errors.push('output_root must remain below assets/episodes');
  }

  validateIdentity(manifest, errors);
  validateEpisodeSpecificRules(manifest, errors);
  validateReviewsAndBlockers(manifest, errors);
  validateBudget(manifest, errors);
  validatePackaging(manifest, errors);
  const clipValidation = validateClips(manifest, errors);

  if (sourceDialogue.length !== expectedDialogueCount) {
    errors.push(`source recording script contains ${sourceDialogue.length} numbered lines, expected ${expectedDialogueCount}`);
  }
  if (clipValidation.dialogue.length !== expectedDialogueCount) {
    errors.push(`flattened clip dialogue contains ${clipValidation.dialogue.length} lines, expected ${expectedDialogueCount}`);
  }
  if (canonicalJson(sourceDialogue) !== canonicalJson(clipValidation.dialogue)) {
    const mismatch = sourceDialogue.findIndex((line, index) => line !== clipValidation.dialogue[index]);
    errors.push(`flattened dialogue differs from source recording script at line ${mismatch + 1}`);
  }

  if (OVERLAY_EPISODES.has(manifest.episode?.episode_number)) validateOverlay(manifest, errors);
  if (walkForForbiddenContent(manifest).length) errors.push(...walkForForbiddenContent(manifest));

  if (errors.length) throw new ValidationError(manifestPath, errors);
  const planSha256 = sha256(canonicalJson(manifest));
  return {
    manifest,
    manifestPath,
    planSha256,
    dialogueCount: clipValidation.dialogue.length,
    maxPromptCharacters: clipValidation.maxPromptCharacters,
    promptJobs: clipValidation.promptJobs,
  };
}

function manifestFiles() {
  if (!fs.existsSync(MANIFEST_ROOT)) return [];
  return fs.readdirSync(MANIFEST_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.manifest.json'))
    .map((entry) => path.join(MANIFEST_ROOT, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function resolveManifestArgument(value) {
  if (typeof value !== 'string' || value.length === 0) throw new Error('--manifest requires a path');
  const resolved = path.resolve(ROOT, value);
  const relation = path.relative(MANIFEST_ROOT, resolved);
  if (relation.startsWith('..') || path.isAbsolute(relation) || relation === '' || path.extname(resolved) !== '.json') {
    throw new Error('--manifest must resolve to a JSON file inside tools/playveo/luna-series/manifests');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error(`Manifest is missing: ${relative(resolved)}`);
  return resolved;
}

function validatePortfolio(validated) {
  const errors = [];
  const episodeNumbers = new Set(validated.map((item) => item.manifest.episode.episode_number));
  const productionIds = new Set(validated.map((item) => item.manifest.production_id));
  const outputRoots = new Set(validated.map((item) => item.manifest.output_root));
  if (validated.length !== 5 || episodeNumbers.size !== 5 || [...EXPECTED_EPISODES].some((number) => !episodeNumbers.has(number))) {
    errors.push('the --all portfolio must contain exactly E02-E06');
  }
  if (productionIds.size !== validated.length) errors.push('production_id values must be unique across the portfolio');
  if (outputRoots.size !== validated.length) errors.push('output_root values must be isolated across the portfolio');
  const totals = validated.reduce((result, item) => {
    result.seconds += item.manifest.clips.reduce((sum, clip) => sum + clip.duration_seconds, 0);
    result.clips += item.manifest.clips.length;
    result.dialogue += item.dialogueCount;
    result.baseline += item.manifest.budget.baseline_credits;
    result.contingency += item.manifest.budget.contingency_credits;
    result.ceiling += item.manifest.budget.ceiling_credits;
    return result;
  }, { seconds: 0, clips: 0, dialogue: 0, baseline: 0, contingency: 0, ceiling: 0 });
  if (!approximatelyEqual(totals.baseline, 45)
    || !approximatelyEqual(totals.contingency, 6.75)
    || !approximatelyEqual(totals.ceiling, 51.75)) {
    errors.push('portfolio budget must be exactly 45 + 6.75 contingency = 51.75 credits');
  }
  if (totals.seconds !== 900) errors.push('portfolio duration must be exactly 900 seconds');
  if (errors.length) throw new Error(`Portfolio validation failed: ${errors.join('; ')}`);
  return totals;
}

function baseSummary(item) {
  const manifest = item.manifest;
  return {
    valid: true,
    manifest: relative(item.manifestPath),
    schema_version: manifest.schema_version,
    production_id: manifest.production_id,
    episode_id: manifest.episode.episode_id,
    episode_number: manifest.episode.episode_number,
    title_ar: manifest.episode.title_ar,
    source_sha256: manifest.source.sha256,
    visual_identity_pack_sha256: manifest.visual_identity.reference_pack_sha256,
    plan_sha256: item.planSha256,
    pipeline: manifest.pipeline.profile,
    dispatch_blocked: manifest.pipeline.dispatch_blocked,
    clip_count: manifest.clips.length,
    duration_seconds: manifest.clips.reduce((sum, clip) => sum + clip.duration_seconds, 0),
    dialogue_count: item.dialogueCount,
    maximum_prompt_characters: item.maxPromptCharacters,
    output_root: manifest.output_root,
    budget: manifest.budget,
    blockers: manifest.blockers.map((blocker) => blocker.code),
    packaging: manifest.packaging.requirements.map((requirement) => ({
      kind: requirement.kind,
      status: requirement.status,
      file: requirement.file,
    })),
    ...(manifest.overlay_plan ? {
      overlay: {
        required: true,
        renderer_implemented: manifest.overlay_plan.renderer_implemented,
        overlay_plan_sha256: manifest.overlay_plan.overlay_plan_sha256,
        specialist_review_required: manifest.overlay_plan.linguistic_and_calligraphy_review_required,
      },
    } : {}),
  };
}

function inspectExistingConfinedChild(base, candidate) {
  const relation = path.relative(base, candidate);
  if (relation.startsWith('..') || path.isAbsolute(relation) || relation === '') {
    return { safe: false, reason: 'lexical path escapes output_root' };
  }
  if (!fs.existsSync(base)) return { safe: true, exists: false };
  try {
    const baseStat = fs.lstatSync(base);
    if (baseStat.isSymbolicLink() || !baseStat.isDirectory()) {
      return { safe: false, reason: 'output_root is a symbolic link, junction, or non-directory' };
    }
    const realBase = fs.realpathSync.native(base);
    let current = base;
    for (const segment of relation.split(path.sep)) {
      current = path.join(current, segment);
      if (!fs.existsSync(current)) return { safe: true, exists: false };
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        return { safe: false, reason: `symbolic-link or junction component: ${relative(current)}` };
      }
      const realCurrent = fs.realpathSync.native(current);
      const realRelation = path.relative(realBase, realCurrent);
      if (realRelation.startsWith('..') || path.isAbsolute(realRelation)) {
        return { safe: false, reason: `real path escapes output_root: ${relative(current)}` };
      }
    }
    return { safe: true, exists: true };
  } catch (error) {
    return { safe: false, reason: `path inspection failed: ${error.message}` };
  }
}

function localStatus(item) {
  const manifest = item.manifest;
  const outputRoot = path.resolve(ROOT, manifest.output_root);
  const statePath = path.resolve(outputRoot, manifest.runtime_state_policy.state_file);
  const statePathSafety = inspectExistingConfinedChild(outputRoot, statePath);
  const clips = manifest.clips.map((clip) => {
    const clipPath = path.resolve(outputRoot, clip.file);
    const pathSafety = inspectExistingConfinedChild(outputRoot, clipPath);
    return {
      clip_id: clip.id,
      exists: pathSafety.safe && pathSafety.exists && fs.lstatSync(clipPath).isFile(),
      path_safe: pathSafety.safe,
      ...(pathSafety.safe ? {} : { unsafe_reason: pathSafety.reason }),
    };
  });
  let state = {
    exists: false,
    valid_json: false,
    production_matches: false,
    review_status: 'unavailable',
    path_safe: statePathSafety.safe,
    ...(statePathSafety.safe ? {} : { unsafe_reason: statePathSafety.reason }),
  };
  if (statePathSafety.safe && statePathSafety.exists && fs.lstatSync(statePath).isFile()) {
    try {
      const parsed = readJson(statePath);
      state = {
        exists: true,
        valid_json: true,
        production_matches: parsed.production_id === manifest.production_id,
        review_status: parsed.review?.clips?.status ?? 'missing',
        job_count: Array.isArray(parsed.jobs) ? parsed.jobs.length : null,
        path_safe: true,
      };
    } catch {
      state = {
        exists: true,
        valid_json: false,
        production_matches: false,
        review_status: 'unavailable',
        path_safe: true,
      };
    }
  }
  const finalName = `${path.basename(manifest.output_root)}-final.mp4`;
  const finalPath = path.join(outputRoot, finalName);
  const finalPathSafety = inspectExistingConfinedChild(outputRoot, finalPath);
  const outputRootExists = fs.existsSync(outputRoot);
  const outputRootPathSafe = !outputRootExists
    || (!fs.lstatSync(outputRoot).isSymbolicLink() && fs.lstatSync(outputRoot).isDirectory());
  return {
    output_root_exists: outputRootExists && outputRootPathSafe,
    output_root_path_safe: outputRootPathSafe,
    status_paths_safe: outputRootPathSafe
      && statePathSafety.safe
      && finalPathSafety.safe
      && clips.every((clip) => clip.path_safe),
    state,
    clips_present: clips.filter((clip) => clip.exists).length,
    clips_expected: clips.length,
    missing_clip_ids: clips.filter((clip) => !clip.exists).map((clip) => clip.clip_id),
    final_master_exists: finalPathSafety.safe && finalPathSafety.exists && fs.lstatSync(finalPath).isFile(),
    inspection_only: true,
  };
}

function parseArgs(argv) {
  for (const argument of argv) {
    if (DISALLOWED_EXECUTION_FLAGS.has(argument) || [...DISALLOWED_EXECUTION_FLAGS].some((flag) => argument.startsWith(`${flag}=`))) {
      throw new Error(`${argument} is forbidden here. This tool is read-only; use the Content Factory for reviewed, approved execution.`);
    }
  }
  const options = { all: false, manifest: null, action: null };
  const allowedActions = new Set(['--validate', '--plan', '--status']);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--all') {
      options.all = true;
    } else if (argument === '--manifest') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--manifest requires a path');
      options.manifest = value;
    } else if (allowedActions.has(argument)) {
      if (options.action) throw new Error('Choose exactly one of --validate, --plan, or --status');
      options.action = argument.slice(2);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!options.action) throw new Error('Choose one read-only action: --validate, --plan, or --status');
  if (options.all === Boolean(options.manifest)) throw new Error('Choose exactly one manifest selection: --all or --manifest PATH');
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = options.all ? manifestFiles() : [resolveManifestArgument(options.manifest)];
  if (!files.length) throw new Error('No Luna series manifests were found');
  const validated = files.map(validateManifest);
  const totals = options.all ? validatePortfolio(validated) : null;
  const manifests = validated.map((item) => {
    const summary = baseSummary(item);
    if (options.action === 'plan') {
      summary.jobs = item.promptJobs;
      summary.paid_requests_sent = 0;
      summary.execution_available = false;
    }
    if (options.action === 'status') summary.local_status = localStatus(item);
    return summary;
  });
  const output = options.all ? {
    command: options.action,
    valid: true,
    read_only: true,
    network_requests_sent: 0,
    manifest_count: manifests.length,
    portfolio_plan_sha256: sha256(canonicalJson(manifests.map((item) => ({
      production_id: item.production_id,
      plan_sha256: item.plan_sha256,
    })))),
    totals: {
      clips: totals.clips,
      duration_seconds: totals.seconds,
      dialogue_lines: totals.dialogue,
      baseline_credits: Number(totals.baseline.toFixed(6)),
      contingency_credits: Number(totals.contingency.toFixed(6)),
      ceiling_credits: Number(totals.ceiling.toFixed(6)),
    },
    manifests,
  } : {
    command: options.action,
    read_only: true,
    network_requests_sent: 0,
    ...manifests[0],
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

export {
  buildPrompt,
  buildVisualPrompt,
  validateManifest as validatePreproductionManifest,
};

const invokedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (invokedAsScript) {
  try {
    main();
  } catch (error) {
    const output = {
      valid: false,
      error: error.message,
      ...(error instanceof ValidationError ? {
        manifest: relative(error.manifestPath),
        diagnostics: error.errors,
      } : {}),
    };
    process.stderr.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = 1;
  }
}
