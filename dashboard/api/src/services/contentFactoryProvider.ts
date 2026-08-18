import type { FactoryJob } from '../lib/contentFactory.ts';

export type ProviderResult = {
  provider_job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider_declared_gross_credits: number | null;
  result_urls: string[];
  model: string | null;
};

export class ContentFactoryProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, code: string, retryable: boolean, status: number | null = null) {
    super(message);
    this.name = 'ContentFactoryProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function entity(value: unknown) {
  const root = object(value);
  return object(root.data ?? root.video ?? root.image ?? root.generation ?? root);
}

function normalizeStatus(value: unknown): ProviderResult['status'] | null {
  const status = String(value ?? '').toLowerCase();
  if (status === 'canceled') return 'cancelled';
  return ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)
    ? status as ProviderResult['status']
    : null;
}

export function parseProviderResult(value: unknown): ProviderResult {
  const root = object(value);
  const item = entity(value);
  const providerJobId = item.id ?? root.id ?? item.job_id ?? item.jobId;
  const status = normalizeStatus(item.status ?? root.status);
  if (typeof providerJobId !== 'string' || !providerJobId || !status) {
    throw new ContentFactoryProviderError('Provider response lacks a stable id or status', 'INVALID_PROVIDER_RESPONSE', false);
  }
  const rawCost = root.creditCost ?? root.credit_cost ?? item.creditCost ?? item.credit_cost;
  const parsedCost = Number(rawCost);
  const list = item.resultUrls ?? item.result_urls ?? item.urls;
  const urls = Array.isArray(list)
    ? list.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
  const single = item.videoUrl ?? item.video_url ?? item.resultUrl ?? item.result_url ?? item.url;
  if (urls.length === 0 && typeof single === 'string' && single) urls.push(single);
  return {
    provider_job_id: providerJobId,
    status,
    provider_declared_gross_credits: Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : null,
    result_urls: urls,
    model: typeof (root.model ?? item.model) === 'string' ? String(root.model ?? item.model) : null,
  };
}

export function providerRequestForJob(job: FactoryJob) {
  if (job.provider !== 'flux') {
    throw new ContentFactoryProviderError(`Unsupported provider ${job.provider}`, 'UNSUPPORTED_PROVIDER', false);
  }
  if (job.kind === 'video') {
    if (!Number.isInteger(job.duration_seconds) || job.duration_seconds! < 5 || job.duration_seconds! > 20) {
      throw new ContentFactoryProviderError('FLUX video duration must be 5-20 seconds', 'INVALID_PROVIDER_INPUT', false);
    }
    return {
      submit_path: '/v1/flux/videos',
      poll_path: (id: string) => `/v1/flux/videos/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input.prompt,
        duration_seconds: job.duration_seconds,
        aspect_ratio: job.input.aspect_ratio ?? '16:9',
        ...(job.input.resolution ? { resolution: job.input.resolution } : {}),
      },
    };
  }
  if (job.kind === 'image' && job.operation === 'text-to-image') {
    return {
      submit_path: '/v1/images/text-to-image',
      poll_path: (id: string) => `/v1/images/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input.prompt,
        aspect_ratio: job.input.aspect_ratio,
        count: job.count ?? 1,
      },
    };
  }
  if (job.kind === 'image' && job.operation === 'image-to-image') {
    if (typeof job.input.image !== 'string' || !/^data:image\/[A-Za-z0-9.+-]+;base64,/.test(job.input.image)) {
      throw new ContentFactoryProviderError('image-to-image requires a base64 data URL', 'INVALID_PROVIDER_INPUT', false);
    }
    return {
      submit_path: '/v1/images/image-to-image',
      poll_path: (id: string) => `/v1/images/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input.prompt,
        aspect_ratio: job.input.aspect_ratio,
        count: job.count ?? 1,
        image: job.input.image,
      },
    };
  }
  throw new ContentFactoryProviderError(`${job.kind}/${job.operation} is not implemented`, 'UNSUPPORTED_OPERATION', false);
}

function providerBase(value: string | undefined) {
  const parsed = new URL(value || 'https://api.playveo.com');
  if (parsed.protocol !== 'https:') {
    throw new ContentFactoryProviderError('Provider base URL must use HTTPS', 'INSECURE_PROVIDER_URL', false);
  }
  return parsed;
}

async function providerJson(
  fetchImpl: typeof fetch,
  url: URL,
  apiKey: string,
  method: 'GET' | 'POST',
  payload?: Record<string, unknown>,
  idempotencyKey?: string,
) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new ContentFactoryProviderError(
      `Provider returned HTTP ${response.status}`,
      'PROVIDER_HTTP_ERROR',
      response.status === 408 || response.status === 429 || response.status >= 500,
      response.status,
    );
  }
  const text = await response.text();
  if (text.length > 1_000_000) throw new ContentFactoryProviderError('Provider response is too large', 'INVALID_PROVIDER_RESPONSE', false);
  try { return JSON.parse(text); } catch {
    throw new ContentFactoryProviderError('Provider returned invalid JSON', 'INVALID_PROVIDER_RESPONSE', false);
  }
}

export async function submitProviderJob(options: {
  job: FactoryJob;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  const request = providerRequestForJob(options.job);
  const base = providerBase(options.baseUrl);
  const payload = await providerJson(
    options.fetchImpl ?? fetch,
    new URL(request.submit_path, base),
    options.apiKey,
    'POST',
    request.payload,
    options.job.idempotency_key,
  );
  return parseProviderResult(payload);
}

export async function pollProviderJob(options: {
  job: FactoryJob;
  providerJobId: string;
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}) {
  const request = providerRequestForJob(options.job);
  const base = providerBase(options.baseUrl);
  const payload = await providerJson(
    options.fetchImpl ?? fetch,
    new URL(request.poll_path(options.providerJobId), base),
    options.apiKey,
    'GET',
  );
  return parseProviderResult(payload);
}

export async function downloadProviderAsset(options: {
  url: string;
  apiKey: string;
  baseUrl?: string;
  allowedHosts?: string;
  fetchImpl?: typeof fetch;
  maximumBytes: number;
}) {
  const base = providerBase(options.baseUrl);
  const target = new URL(options.url);
  const allowed = new Set([
    base.hostname,
    ...(options.allowedHosts ?? '').split(',').map((item) => item.trim()).filter(Boolean),
  ]);
  if (target.protocol !== 'https:' || !allowed.has(target.hostname)) {
    throw new ContentFactoryProviderError('Provider result host is not allow-listed', 'RESULT_HOST_NOT_ALLOWED', false);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response = await fetchImpl(target, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    response = await fetchImpl(target, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: AbortSignal.timeout(120_000),
    });
  }
  if (!response.ok) {
    throw new ContentFactoryProviderError(`Asset download returned HTTP ${response.status}`, 'ASSET_DOWNLOAD_FAILED', true, response.status);
  }
  const declared = Number(response.headers.get('Content-Length') ?? 0);
  if (declared > options.maximumBytes) {
    throw new ContentFactoryProviderError('Provider asset exceeds the maximum size', 'ASSET_TOO_LARGE', false);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > options.maximumBytes) {
    throw new ContentFactoryProviderError('Provider asset is empty or too large', 'INVALID_ASSET_SIZE', false);
  }
  return {
    bytes,
    content_type: response.headers.get('Content-Type')?.split(';')[0] ?? 'application/octet-stream',
  };
}
