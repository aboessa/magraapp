import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderError, createPlayVeoProvider } from '../lib/provider-playveo.mjs';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('PlayVeo adapter submits and polls FLUX video with model audio fields intact', async () => {
  const calls = [];
  const provider = createPlayVeoProvider({
    apiKey: 'test-key',
    baseUrl: 'https://provider.example',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (init.method === 'POST') return jsonResponse({ id: 'video-1', status: 'pending', creditCost: 0.75 });
      return jsonResponse({ id: 'video-1', status: 'completed', creditCost: 0.75, resultUrls: ['https://cdn.example/video.mp4'] });
    },
  });
  const job = {
    job_id: 'scene-01', kind: 'video', provider: 'flux', operation: 'text-to-video-model-audio',
    duration_seconds: 15, idempotency_key: 'cf-v1-test-idempotency',
    input: { prompt: 'Arabic model-audio scene', aspect_ratio: '16:9', resolution: '1080p' },
  };
  const submitted = await provider.submit(job);
  const completed = await provider.poll(job, submitted.provider_job_id);
  assert.equal(submitted.provider_declared_gross_credits, 0.75);
  assert.equal(completed.status, 'completed');
  assert.equal(calls[0].url, 'https://provider.example/v1/flux/videos');
  assert.equal(calls[1].url, 'https://provider.example/v1/flux/videos/video-1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  assert.equal(calls[0].init.headers['Idempotency-Key'], job.idempotency_key);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    prompt: 'Arabic model-audio scene',
    duration_seconds: 15,
    aspect_ratio: '16:9',
    resolution: '1080p',
  });
});

test('PlayVeo image adapter uses verified image payloads and rejects URL-only references', async () => {
  const calls = [];
  const provider = createPlayVeoProvider({
    apiKey: 'test-key',
    baseUrl: 'https://provider.example',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ id: 'image-1', status: 'pending', creditCost: 0.15 });
    },
  });
  await provider.submit({
    kind: 'image', provider: 'flux', operation: 'image-to-image', count: 1,
    idempotency_key: 'cf-v1-image',
    input: {
      prompt: 'Keep character identity', aspect_ratio: '16:9',
      image: 'data:image/png;base64,AAAA',
    },
  });
  assert.equal(calls[0].url, 'https://provider.example/v1/images/image-to-image');
  assert.equal(JSON.parse(calls[0].init.body).image, 'data:image/png;base64,AAAA');

  await assert.rejects(
    () => provider.submit({
      kind: 'image', provider: 'flux', operation: 'image-to-image',
      idempotency_key: 'cf-v1-bad-image', input: { prompt: 'x', image: 'https://example/image.png' },
    }),
    (error) => error instanceof ProviderError && error.code === 'INVALID_REQUEST',
  );
});
