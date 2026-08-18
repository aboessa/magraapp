const DEFAULT_BASE_URL = 'https://api.playveo.com';

export class ProviderError extends Error {
  constructor(message, { code = 'PROVIDER_ERROR', status = null, retryable = false, details = null } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

function entity(response) {
  return response?.data ?? response?.video ?? response?.image ?? response?.generation ?? response;
}

function providerId(response) {
  const item = entity(response);
  return item?.id ?? response?.id ?? item?.job_id ?? item?.jobId ?? null;
}

function providerStatus(response) {
  const item = entity(response);
  return String(item?.status ?? response?.status ?? '').toLowerCase() || null;
}

function declaredCost(response) {
  const item = entity(response);
  const value = response?.creditCost ?? response?.credit_cost ?? item?.creditCost ?? item?.credit_cost;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resultUrls(response) {
  const item = entity(response);
  const list = item?.resultUrls ?? item?.result_urls ?? item?.urls;
  if (Array.isArray(list)) return list.filter((url) => typeof url === 'string' && url.length > 0);
  const single = item?.videoUrl ?? item?.video_url ?? item?.resultUrl ?? item?.result_url ?? item?.url;
  return typeof single === 'string' && single.length > 0 ? [single] : [];
}

function sanitizedResult(response) {
  return {
    provider_job_id: providerId(response),
    status: providerStatus(response),
    provider_declared_gross_credits: declaredCost(response),
    result_urls: resultUrls(response),
    model: response?.model ?? entity(response)?.model ?? null,
  };
}

function submission(job) {
  if (job.provider !== 'flux') throw new ProviderError(`Unsupported provider: ${job.provider}`, { code: 'UNSUPPORTED_PROVIDER' });
  if (job.kind === 'video') {
    if (!Number.isInteger(job.duration_seconds) || job.duration_seconds < 5 || job.duration_seconds > 20) {
      throw new ProviderError('FLUX video duration must be an integer from 5 to 20 seconds', { code: 'INVALID_REQUEST' });
    }
    return {
      route: '/v1/flux/videos',
      pollRoute: (id) => `/v1/flux/videos/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input?.prompt,
        duration_seconds: job.duration_seconds,
        aspect_ratio: job.input?.aspect_ratio ?? '16:9',
        ...(job.input?.resolution ? { resolution: job.input.resolution } : {}),
      },
    };
  }
  if (job.kind === 'image' && job.operation === 'text-to-image') {
    return {
      route: '/v1/images/text-to-image',
      pollRoute: (id) => `/v1/images/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input?.prompt,
        aspect_ratio: job.input?.aspect_ratio,
        count: job.count ?? job.input?.count ?? 1,
      },
    };
  }
  if (job.kind === 'image' && job.operation === 'image-to-image') {
    const image = job.input?.image;
    if (typeof image !== 'string' || !/^data:image\/[A-Za-z0-9.+-]+;base64,/.test(image)) {
      throw new ProviderError('image-to-image requires input.image as a base64 data URL', { code: 'INVALID_REQUEST' });
    }
    return {
      route: '/v1/images/image-to-image',
      pollRoute: (id) => `/v1/images/${encodeURIComponent(id)}`,
      payload: {
        prompt: job.input?.prompt,
        aspect_ratio: job.input?.aspect_ratio,
        count: job.count ?? job.input?.count ?? 1,
        image,
      },
    };
  }
  throw new ProviderError(`Unsupported FLUX operation: ${job.kind}/${job.operation}`, { code: 'UNSUPPORTED_OPERATION' });
}

function assertUrl(url, baseUrl) {
  const parsed = new URL(url, baseUrl);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new ProviderError('Provider transport requires HTTPS', { code: 'INSECURE_PROVIDER_URL' });
  }
  return parsed;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('Provider returned a non-JSON response', {
      code: 'INVALID_PROVIDER_RESPONSE', status: response.status, retryable: response.status >= 500,
    });
  }
}

export function createPlayVeoProvider({
  apiKey,
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 180_000,
} = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') throw new TypeError('A PlayVeo API key is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  async function request(method, routeOrUrl, { body, idempotencyKey, includeAuth = true } = {}) {
    const url = assertUrl(routeOrUrl, normalizedBaseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method,
        headers: {
          ...(includeAuth ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new ProviderError(`Provider request failed with HTTP ${response.status}`, {
          code: 'PROVIDER_HTTP_ERROR',
          status: response.status,
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
          details: details.slice(0, 1000),
        });
      }
      return response;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ProviderError('Provider request timed out', { code: 'PROVIDER_TIMEOUT', retryable: true });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    name: 'playveo',
    async submit(job) {
      const requestShape = submission(job);
      const response = await request('POST', requestShape.route, {
        body: requestShape.payload,
        idempotencyKey: job.idempotency_key,
      });
      const payload = await parseResponse(response);
      const result = sanitizedResult(payload);
      if (!result.provider_job_id) {
        throw new ProviderError('Provider submission did not return an id', {
          code: 'INVALID_PROVIDER_RESPONSE', details: payload,
        });
      }
      return result;
    },
    async poll(job, providerJobId) {
      if (!providerJobId) throw new TypeError('providerJobId is required');
      const requestShape = submission(job);
      const response = await request('GET', requestShape.pollRoute(providerJobId));
      const payload = await parseResponse(response);
      return sanitizedResult(payload);
    },
    async download(url) {
      const target = assertUrl(url, normalizedBaseUrl);
      try {
        const publicResponse = await request('GET', target, { includeAuth: false });
        return new Uint8Array(await publicResponse.arrayBuffer());
      } catch (publicError) {
        const authenticatedResponse = await request('GET', target, { includeAuth: true });
        return new Uint8Array(await authenticatedResponse.arrayBuffer());
      }
    },
  };
}
