// PlayVeo FLUX 3 live API verification.
//
// Safe/read-only phase (the default never sends POST requests):
//   node tools/playveo/flux3-api-test.mjs
//
// Validation probes (may consume credit if the provider accepts invalid input):
//   node tools/playveo/flux3-api-test.mjs --validation
//
// Full phase (creates four minimum-cost 5-second HD clips):
//   node tools/playveo/flux3-api-test.mjs --paid
//
// The key is loaded from PLAYVEO_API_KEY, the repository root .env.local, or
// %USERPROFILE%/.majarra/playveo.key. It is never printed or written to reports.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://playveo-api.aboessa101.workers.dev';
const RUN_PAID = process.argv.includes('--paid');
const RUN_VALIDATION = process.argv.includes('--validation');
const RUN_ID = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const OUT_DIR = path.join(ROOT, 'assets', 'playveo-flux3-tests', RUN_ID);
const REPORT_PATH = path.join(OUT_DIR, 'report.json');
const SOURCE_VIDEO_URL = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';
const KEY = loadKey();

const results = [];
const jobs = [];
let capabilities = null;
let declaredCredits = 0;

function loadKey() {
  const fromProcess = process.env.PLAYVEO_API_KEY?.trim();
  if (fromProcess) return fromProcess;

  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((candidate) => /^\s*PLAYVEO_API_KEY\s*=/.test(candidate));
    if (line) {
      let value = line.slice(line.indexOf('=') + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    }
  }

  const homePath = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(homePath)) return fs.readFileSync(homePath, 'utf8').trim();
  throw new Error('No PlayVeo key found. Set PLAYVEO_API_KEY or create .env.local.');
}

function redact(value) {
  return String(value ?? '')
    .replaceAll(KEY, '[REDACTED]')
    .replace(/pv_[A-Za-z0-9_-]+/g, 'pv_[REDACTED]')
    .replace(/([?&](?:token|signature|sig|key|expires)=[^&\s"]+)/gi, '[SIGNED_QUERY_REDACTED]');
}

function compact(value, max = 500) {
  const text = redact(typeof value === 'string' ? value : JSON.stringify(value));
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function record(phase, name, ok, detail = {}) {
  const safeDetail = JSON.parse(redact(JSON.stringify(detail)));
  results.push({ phase, name, ok, detail: safeDetail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} [${phase}] ${name}`);
  if (Object.keys(safeDetail).length) console.log(`     ${compact(safeDetail)}`);
  return ok;
}

async function request(method, route, { auth = 'valid', body, timeoutMs = 180_000 } = {}) {
  const headers = {};
  if (auth === 'valid') headers.Authorization = 'Bearer ' + KEY;
  if (auth === 'invalid') headers.Authorization = 'Bearer pv_intentionally_invalid'; // secret-scan:allow negative auth test fixture
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${route}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* A non-JSON body is reported below. */ }
    return {
      status: response.status,
      ok: response.ok,
      json,
      text: redact(text),
      headers: response.headers,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      json: null,
      text: redact(error.message),
      headers: new Headers(),
      latencyMs: Date.now() - started,
      networkError: true,
    };
  }
}

function serverMessage(response) {
  return compact(response.json?.error ?? response.json?.message ?? response.text ?? 'empty response', 300);
}

function videoFrom(response) {
  return response.json?.video ?? response.json ?? null;
}

function jobIdFrom(response) {
  return response.json?.id ?? response.json?.jobId ?? response.json?.video?.id ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A deterministic PNG encoder keeps test frames synthetic: no project artwork or
// user data is sent to the provider.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function makeTestFrame(ballX) {
  const width = 640;
  const height = 360;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      let color = y > 280 ? [70, 150, 82] : [132, 205, 235];
      const dx = x - ballX;
      const dy = y - 220;
      if (dx * dx + dy * dy <= 42 * 42) color = [255, 200, 45];
      const offset = row + 1 + x * 3;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function runReadOnlyChecks() {
  console.log('=== Phase 1: public surface and authentication (no credits) ===\n');

  const root = await request('GET', '/', { auth: 'none' });
  record('surface', 'GET / service health', root.status === 200 && root.json?.status === 'ok', {
    status: root.status,
    latencyMs: root.latencyMs,
    service: root.json?.service,
  });

  const cap = await request('GET', '/v1/flux/capabilities', { auth: 'none' });
  capabilities = cap.json;
  const capabilitiesOk = cap.status === 200 && cap.json?.model === 'flux3' &&
    Array.isArray(cap.json?.modes) && cap.json.modes.length === 4 &&
    cap.json?.duration?.min === 5 && cap.json?.duration?.max === 20;
  record('surface', 'GET /v1/flux/capabilities (public)', capabilitiesOk, {
    status: cap.status,
    latencyMs: cap.latencyMs,
    model: cap.json?.model,
    modes: cap.json?.modes,
    duration: cap.json?.duration,
    aspectRatios: cap.json?.aspectRatios,
    resolutions: cap.json?.resolutions,
    audio: cap.json?.audio,
  });

  const noAuth = await request('GET', '/v1/flux/videos?limit=1', { auth: 'none' });
  record('auth', 'GET list without bearer token is rejected', noAuth.status === 401, {
    status: noAuth.status,
    latencyMs: noAuth.latencyMs,
    message: serverMessage(noAuth),
  });

  const badAuth = await request('GET', '/v1/flux/videos?limit=1', { auth: 'invalid' });
  record('auth', 'GET list with invalid bearer token is rejected', badAuth.status === 401, {
    status: badAuth.status,
    latencyMs: badAuth.latencyMs,
    message: serverMessage(badAuth),
  });

  const valid = await request('GET', '/v1/flux/videos?limit=20');
  const validOk = valid.status === 200 && Array.isArray(valid.json?.videos);
  record('auth', 'GET /v1/flux/videos with supplied key', validOk, {
    status: valid.status,
    latencyMs: valid.latencyMs,
    count: valid.json?.count ?? valid.json?.videos?.length,
    message: validOk ? undefined : serverMessage(valid),
  });

  const missingId = '00000000-0000-0000-0000-000000000000';
  const missing = await request('GET', `/v1/flux/videos/${missingId}`);
  record('lookup', 'GET nonexistent FLUX job', missing.status === 404, {
    status: missing.status,
    latencyMs: missing.latencyMs,
    message: serverMessage(missing),
  });

  const missingNoAuth = await request('GET', `/v1/flux/videos/${missingId}`, { auth: 'none' });
  record('auth', 'GET one job without bearer token is rejected', missingNoAuth.status === 401, {
    status: missingNoAuth.status,
    latencyMs: missingNoAuth.latencyMs,
    message: serverMessage(missingNoAuth),
  });

  for (const status of ['pending', 'processing', 'completed', 'failed']) {
    const filtered = await request('GET', `/v1/flux/videos?status=${status}&limit=5`);
    const rows = filtered.json?.videos;
    const filterOk = filtered.status === 200 && Array.isArray(rows) &&
      rows.every((video) => video.status === status);
    record('list', `GET list filtered by status=${status}`, filterOk, {
      status: filtered.status,
      latencyMs: filtered.latencyMs,
      count: rows?.length,
      message: filterOk ? undefined : serverMessage(filtered),
    });
  }

  return validOk;
}

async function runValidationChecks(startFrame, endFrame) {
  if (!RUN_VALIDATION) return;
  console.log('\n=== Phase 2: documented validation failures (should spend no credits) ===\n');

  const base = {
    prompt: 'API validation probe; this request must be rejected before generation.',
    duration_seconds: 5,
    aspect_ratio: '16:9',
    resolution: 'hd',
  };
  const cases = [
    ['missing prompt', { duration_seconds: 5 }],
    ['duration below minimum', { ...base, duration_seconds: 4 }],
    ['fractional duration', { ...base, duration_seconds: 5.5 }],
    ['duration above maximum', { ...base, duration_seconds: 21 }],
    ['unsupported aspect ratio', { ...base, aspect_ratio: '5:4' }],
    ['unsupported resolution', { ...base, resolution: '4k' }],
    ['generate_audio=false', { ...base, generate_audio: false }],
    ['end_frame without start_frame', { ...base, end_frame: endFrame }],
    ['start_video combined with start_frame', {
      ...base,
      start_frame: startFrame,
      start_video: SOURCE_VIDEO_URL,
    }],
    ['prompt over 10,000 characters', { ...base, prompt: 'x'.repeat(10_001) }],
  ];

  for (const [name, body] of cases) {
    const response = await request('POST', '/v1/flux/videos', { body });
    const ok = response.status === 400;
    record('validation', `POST rejects ${name}`, ok, {
      status: response.status,
      latencyMs: response.latencyMs,
      message: serverMessage(response),
      unexpectedJobId: ok ? undefined : jobIdFrom(response) ?? undefined,
      unexpectedCreditCost: ok ? undefined : response.json?.creditCost ?? undefined,
    });

    // A 2xx response means a supposedly invalid request may now be consuming
    // credits. Stop these probes immediately so a validation regression can cost
    // at most one accidental job.
    if (response.status >= 200 && response.status < 300) {
      const id = jobIdFrom(response);
      const cost = Number(response.json?.creditCost);
      if (Number.isFinite(cost)) declaredCredits += cost;
      if (id) jobs.push({
        id,
        requestedMode: `unexpected-validation-${name}`,
        returnedMode: response.json?.mode,
        creditCost: Number.isFinite(cost) ? cost : null,
      });
      console.log('Stopping validation probes after an invalid request was accepted.');
      break;
    }
  }
}

async function waitForJob(id, mode, timeoutMs = 12 * 60_000) {
  const started = Date.now();
  const statuses = [];
  let consecutive404 = 0;

  while (Date.now() - started < timeoutMs) {
    const response = await request('GET', `/v1/flux/videos/${id}`);
    if (response.status === 404) {
      consecutive404 += 1;
      if (consecutive404 >= 3) {
        return { ok: false, reason: 'job disappeared: three consecutive 404 responses', statuses, elapsedMs: Date.now() - started };
      }
    } else {
      consecutive404 = 0;
    }

    if (response.status !== 200) {
      if (response.status === 429) {
        await sleep(15_000);
        continue;
      }
      if (response.status !== 404) {
        return {
          ok: false,
          reason: `poll returned ${response.status}: ${serverMessage(response)}`,
          statuses,
          elapsedMs: Date.now() - started,
        };
      }
    } else {
      const video = videoFrom(response);
      if (video?.status && statuses.at(-1)?.status !== video.status) {
        const event = { status: video.status, afterSeconds: Math.round((Date.now() - started) / 1000) };
        statuses.push(event);
        console.log(`     ${mode}: ${event.status} after ${event.afterSeconds}s`);
      }
      if (video?.status === 'completed') {
        return { ok: true, video, statuses, elapsedMs: Date.now() - started };
      }
      if (video?.status === 'failed') {
        return {
          ok: false,
          reason: video.error ?? 'provider returned failed without an error message',
          video,
          statuses,
          elapsedMs: Date.now() - started,
        };
      }
    }
    await sleep(10_000);
  }

  return { ok: false, reason: 'timed out after 12 minutes', statuses, elapsedMs: Date.now() - started };
}

async function inspectVideo(url, mode) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return { ok: false, reason: 'completed job did not return an HTTPS videoUrl' };
  }

  const started = Date.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(240_000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const prefix = bytes.subarray(0, 64).toString('latin1');
  const binaryText = bytes.toString('latin1');
  const contentType = response.headers.get('content-type') ?? '';
  const hasFtyp = prefix.includes('ftyp');
  const hasVideoTrack = binaryText.includes('vide');
  const hasAudioTrack = binaryText.includes('soun');
  const ok = response.ok && bytes.length > 10_000 && hasFtyp && hasVideoTrack && hasAudioTrack;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, `${mode}.mp4`);
  fs.writeFileSync(filePath, bytes);

  return {
    ok,
    status: response.status,
    contentType,
    bytes: bytes.length,
    hasFtyp,
    hasVideoTrack,
    hasAudioTrack,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    downloadMs: Date.now() - started,
    file: path.relative(ROOT, filePath).replaceAll('\\', '/'),
  };
}

async function runPaidChecks(startFrame, endFrame) {
  if (!RUN_PAID) {
    console.log('\nSkipping paid generation. Re-run with --paid to create one minimum-cost clip for each of the four modes.');
    return;
  }

  const skipText = process.argv.includes('--skip-text');
  const common = { duration_seconds: 5, aspect_ratio: '16:9', resolution: 'hd' };
  const allCases = [
    {
      mode: 'text-to-video',
      body: {
        ...common,
        prompt: 'A simple 2D cartoon test scene: a yellow ball rolls gently across a green field under a blue sky, locked camera, clean shapes, no text. A soft bell and light wind are audible.',
      },
    },
    {
      mode: 'image-to-video',
      body: {
        ...common,
        prompt: 'Animate the yellow ball rolling slowly to the right while preserving the flat 2D colors and locked camera. Add a soft bell and light wind, no text.',
        start_frame: startFrame,
      },
    },
    {
      mode: 'frames-to-video',
      body: {
        ...common,
        prompt: 'Move the yellow ball smoothly from its starting position to its ending position, preserving the exact flat 2D scene and locked camera. Add a soft bell, no text.',
        start_frame: startFrame,
        end_frame: endFrame,
      },
    },
    {
      mode: 'video-to-video',
      body: {
        ...common,
        prompt: 'Continue the source motion naturally for five seconds with stable camera movement and coherent audio; do not add titles or captions.',
        start_video: SOURCE_VIDEO_URL,
      },
    },
  ];
  if (process.argv.includes('--video-base64')) {
    const sourceResponse = await fetch(SOURCE_VIDEO_URL, { signal: AbortSignal.timeout(180_000) });
    if (!sourceResponse.ok) throw new Error(`Could not load public MP4 fixture: HTTP ${sourceResponse.status}`);
    const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
    if (sourceBytes.length > 50 * 1024 * 1024 || !sourceBytes.subarray(0, 64).toString('latin1').includes('ftyp')) {
      throw new Error(`Public video fixture is not a valid in-limit MP4 (${sourceBytes.length} bytes)`);
    }
    allCases.find((testCase) => testCase.mode === 'video-to-video').body.start_video =
      `data:video/mp4;base64,${sourceBytes.toString('base64')}`;
    console.log(`Loaded synthetic/public MP4 fixture as base64 (${sourceBytes.length} bytes); content is not logged.`);
  }

  const onlyModeIndex = process.argv.indexOf('--only-mode');
  const onlyMode = onlyModeIndex === -1 ? null : process.argv[onlyModeIndex + 1];
  if (onlyModeIndex !== -1 && !allCases.some((testCase) => testCase.mode === onlyMode)) {
    throw new Error('--only-mode requires one of: text-to-video, image-to-video, frames-to-video, video-to-video');
  }
  const cases = onlyMode
    ? allCases.filter((testCase) => testCase.mode === onlyMode)
    : skipText
      ? allCases.filter((testCase) => testCase.mode !== 'text-to-video')
      : allCases;
  console.log(`\n=== Phase 3: ${cases.length} real minimum-cost FLUX generations (parallel polling) ===\n`);

  const submitted = [];
  for (const testCase of cases) {
    console.log(`Submitting ${testCase.mode}...`);
    const created = await request('POST', '/v1/flux/videos', { body: testCase.body, timeoutMs: 240_000 });
    const id = jobIdFrom(created);
    const createOk = [200, 201, 202].includes(created.status) && Boolean(id);
    record('create', `POST /v1/flux/videos (${testCase.mode})`, createOk, {
      status: created.status,
      latencyMs: created.latencyMs,
      id: id ?? undefined,
      returnedMode: created.json?.mode,
      statusValue: created.json?.status,
      creditCost: created.json?.creditCost,
      estimatedTime: created.json?.estimated_time,
      message: createOk ? undefined : serverMessage(created),
    });

    if (!createOk) {
      if (created.status === 402) {
        console.log('Stopping submissions because the API reported insufficient credits.');
        break;
      }
      continue;
    }

    const cost = Number(created.json?.creditCost);
    if (Number.isFinite(cost)) declaredCredits += cost;
    const job = {
      id,
      requestedMode: testCase.mode,
      returnedMode: created.json?.mode,
      creditCost: Number.isFinite(cost) ? cost : null,
      createdAt: new Date().toISOString(),
    };
    jobs.push(job);
    submitted.push(job);
    await sleep(1_000);
  }

  await Promise.all(submitted.map(async (job) => {
    const final = await waitForJob(job.id, job.requestedMode);
    job.statuses = final.statuses;
    job.elapsedMs = final.elapsedMs;
    job.finalStatus = final.video?.status ?? 'unknown';
    job.error = final.ok ? null : redact(final.reason);
    job.providerDuration = final.video?.duration;
    job.providerResolution = final.video?.resolution;
    job.providerAspectRatio = final.video?.aspectRatio;

    record('poll', `GET /v1/flux/videos/:id completes (${job.requestedMode})`, final.ok, {
      id: job.id,
      elapsedSeconds: Math.round(final.elapsedMs / 1000),
      statuses: final.statuses,
      finalStatus: job.finalStatus,
      error: job.error ?? undefined,
      duration: job.providerDuration,
      resolution: job.providerResolution,
      aspectRatio: job.providerAspectRatio,
    });

    if (!final.ok) return;
    const media = await inspectVideo(final.video?.videoUrl, job.requestedMode);
    job.media = media;
    record('media', `downloaded MP4 has video and audio tracks (${job.requestedMode})`, media.ok, media);
  }));

  const after = await request('GET', '/v1/flux/videos?limit=20');
  const listedIds = new Set(after.json?.videos?.map((video) => video.id) ?? []);
  const expectedIds = submitted.map((job) => job.id);
  const missingIds = expectedIds.filter((id) => !listedIds.has(id));
  record('list', 'new FLUX jobs appear in GET /v1/flux/videos', after.status === 200 && missingIds.length === 0, {
    status: after.status,
    expected: expectedIds.length,
    found: expectedIds.length - missingIds.length,
    missingIds,
  });
}

function writeReport() {
  const failed = results.filter((result) => !result.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    runId: RUN_ID,
    baseUrl: BASE,
    paidRequested: RUN_PAID,
    validationRequested: RUN_VALIDATION,
    keyMetadata: { prefix: KEY.slice(0, 3), length: KEY.length },
    capabilities,
    declaredCredits,
    summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
    results,
    jobs,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nSanitized report: ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`Declared credits submitted this run: ${declaredCredits.toFixed(2)}`);
  console.log(`Result: ${report.summary.passed}/${report.summary.total} checks passed.`);
  if (failed.length) {
    process.exitCode = 1;
    console.log('Unexpected results:');
    for (const failure of failed) console.log(`  - [${failure.phase}] ${failure.name}`);
  }
}

async function main() {
  console.log(`PlayVeo key loaded securely (prefix=${KEY.slice(0, 3)}, length=${KEY.length}); value redacted.`);
  const authenticated = await runReadOnlyChecks();
  if (!authenticated) {
    console.log('\nThe supplied key did not authenticate. Paid and validation requests were not attempted.');
    return;
  }

  const resumeIndex = process.argv.indexOf('--resume');
  if (resumeIndex !== -1) {
    const id = process.argv[resumeIndex + 1];
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('--resume requires a FLUX job UUID');

    const current = await request('GET', `/v1/flux/videos/${id}`);
    const currentVideo = videoFrom(current);
    const lookupOk = current.status === 200 && currentVideo?.id === id;
    record('resume', 'GET existing FLUX job for inspection', lookupOk, {
      status: current.status,
      id,
      jobStatus: currentVideo?.status,
      mode: currentVideo?.mode,
      creditCost: currentVideo?.creditCost,
      message: lookupOk ? undefined : serverMessage(current),
    });
    if (!lookupOk) return;

    const cost = Number(currentVideo.creditCost);
    if (Number.isFinite(cost)) declaredCredits += cost;
    const job = {
      id,
      requestedMode: currentVideo.mode ?? 'unknown',
      returnedMode: currentVideo.mode,
      creditCost: Number.isFinite(cost) ? cost : null,
      createdAt: currentVideo.createdAt,
    };
    jobs.push(job);

    const noWait = process.argv.includes('--no-wait');
    const final = currentVideo.status === 'completed'
      ? { ok: true, video: currentVideo, statuses: [{ status: 'completed', afterSeconds: 0 }], elapsedMs: 0 }
      : currentVideo.status === 'failed'
        ? { ok: false, video: currentVideo, reason: currentVideo.error ?? 'job failed', statuses: [{ status: 'failed', afterSeconds: 0 }], elapsedMs: 0 }
        : noWait
          ? {
              ok: false,
              video: currentVideo,
              reason: `job is still ${currentVideo.status}; no-wait snapshot requested`,
              statuses: [{ status: currentVideo.status, afterSeconds: 0 }],
              elapsedMs: 0,
            }
          : await waitForJob(id, `resume-${currentVideo.mode ?? 'job'}`);
    job.statuses = final.statuses;
    job.elapsedMs = final.elapsedMs;
    job.finalStatus = final.video?.status ?? currentVideo.status;
    job.error = final.ok ? null : redact(final.reason);
    record('resume', 'existing FLUX job reaches completed', final.ok, {
      id,
      finalStatus: job.finalStatus,
      elapsedSeconds: Math.round(final.elapsedMs / 1000),
      statuses: final.statuses,
      error: job.error ?? undefined,
    });
    if (final.ok) {
      const media = await inspectVideo(final.video?.videoUrl, `resume-${currentVideo.mode ?? 'job'}`);
      job.media = media;
      record('resume', 'existing job MP4 has video and audio tracks', media.ok, media);
    }
    return;
  }

  const startFrame = makeTestFrame(170);
  const endFrame = makeTestFrame(470);
  await runValidationChecks(startFrame, endFrame);
  await runPaidChecks(startFrame, endFrame);
}

try {
  await main();
} catch (error) {
  record('runner', 'uncaught runner error', false, { message: redact(error.stack ?? error.message) });
} finally {
  writeReport();
}
