import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Regression coverage for POST /admin/tts/assets.
///
/// NarrationPage.tsx used to generate a working preview and then declare
/// saving unimplemented: no route wrote a content_assets row for a narration
/// take, so the only way to keep it was "download, then re-upload from the
/// media page". This file pins that the save route now exists, is guarded by
/// the same permission as generation, persists to content_assets rather than
/// silently succeeding, forces private visibility rather than trusting a
/// caller-supplied value, and does not call the paid TTS provider again.
///
/// Same convention as workflowReview.test.mjs / auditLogDateFilter.test.mjs: a
/// source assertion, not an HTTP test, because the suite runs on plain
/// `node --test` with no Workers/D1/R2 runtime.
const routePath = fileURLToPath(new URL('../src/routes/adminTts.ts', import.meta.url));
const source = readFileSync(routePath, 'utf8');
const code = source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('the save route exists and requires the same permission as generation', () => {
  assert.match(code, /route\.post\('\/tts\/assets', requirePermission\('upload_audio'\)/);
  assert.match(code, /route\.post\('\/tts\/preview', requirePermission\('upload_audio'\)/);
});

test('saving does not call the TTS provider again; it persists the request body as-is', () => {
  const saveHandler = code.slice(code.indexOf("route.post('/tts/assets'"));
  assert.doesNotMatch(saveHandler, /synthesizeSpeech/);
  assert.match(saveHandler, /bucket\.put\(key, c\.req\.raw\.body/);
});

test('visibility is hardcoded private, never read from the caller', () => {
  const saveHandler = code.slice(code.indexOf("route.post('/tts/assets'"));
  assert.match(saveHandler, /const visibility = 'private' as const/);
  assert.doesNotMatch(saveHandler, /body\.visibility|header\('X-Narration-Visibility'\)/);
});

test('a saved narration writes a real content_assets row with an audit entry', () => {
  const saveHandler = code.slice(code.indexOf("route.post('/tts/assets'"));
  assert.match(saveHandler, /INSERT INTO content_assets/);
  assert.match(saveHandler, /'audio', 'generated', 'ready'/);
  assert.match(saveHandler, /auditStatement\(c\.env\.DB, actorId\(c\), 'create', 'content_asset', id/);
});

test('a missing title, non-audio content type or missing size is rejected before any write', () => {
  const saveHandler = code.slice(code.indexOf("route.post('/tts/assets'"));
  assert.match(saveHandler, /if \(!title\) return c\.json\(\{ success: false, error: 'X-Narration-Title is required' \}, 400\)/);
  assert.match(saveHandler, /if \(!mime\.startsWith\('audio\/'\)\)/);
  assert.match(saveHandler, /if \(!Number\.isInteger\(size\) \|\| size < 1\)/);
});
