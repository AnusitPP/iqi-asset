const MAX_CONCURRENT = 4;
const MAX_RETRIES = 3;
const MAX_RETRY_TIME_MS = 15_000;
const MAX_QUEUE_WAIT_MS = 10_000;
const RETRYABLE_METHODS = new Set(['get', 'list', 'batchGet']);
const TRANSIENT_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EPIPE',
  'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET',
]);
const retryableReasons = new Set([
  'ratelimitexceeded', 'userratelimitexceeded', 'quotaexceeded',
]);
let active = 0;
const waiters = [];
const inflight = new Map();

function errorStatus(error) {
  return Number(error?.response?.status || error?.status || 0);
}
function errorReason(error) {
  const reasons = error?.response?.data?.error?.errors || error?.errors || [];
  return String(reasons[0]?.reason || error?.response?.data?.error?.status || '').toLowerCase();
}
function retryAfterMs(error) {
  const headers = error?.response?.headers || {};
  const value = headers['retry-after'] ?? headers.get?.('retry-after');
  if (value === undefined) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(value));
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}
export function isTransientGoogleError(error) {
  const status = errorStatus(error);
  let cause = error?.cause;
  while (cause) {
    if (TRANSIENT_CODES.has(String(cause.code || ''))) return true;
    cause = cause.cause;
  }
  return (
    status === 429 || [500, 502, 503, 504].includes(status) ||
    (status === 403 && retryableReasons.has(errorReason(error))) ||
    TRANSIENT_CODES.has(String(error?.code || '')) ||
    (error?.name === 'TypeError' && /fetch failed|network error/i.test(String(error.message || '')))
  );
}

function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve(() => release());
  }
  return new Promise((resolve, reject) => {
    const entry = { resolve, reject, timer: undefined };
    entry.timer = setTimeout(() => {
      const index = waiters.indexOf(entry);
      if (index >= 0) waiters.splice(index, 1);
      reject(Object.assign(new Error('Google API request queue timed out'), { code: 'GOOGLE_QUEUE_TIMEOUT' }));
    }, MAX_QUEUE_WAIT_MS);
    waiters.push(entry);
  });
}
function release() {
  const next = waiters.shift();
  if (next) {
    clearTimeout(next.timer);
    next.resolve(() => release());
  } else active--;
}
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGoogleRequest(work, { retryable = false, key } = {}) {
  if (retryable && key && inflight.has(key)) return inflight.get(key);
  const request = (async () => {
    const started = Date.now();
    let attempt = 0;
    while (true) {
      const releaseSlot = await acquire();
      let released = false;
      try {
        return await work();
      } catch (error) {
        if (!retryable || !isTransientGoogleError(error) || attempt >= MAX_RETRIES) throw error;
        const delay = Math.max(
          retryAfterMs(error),
          Math.floor(Math.random() * Math.min(4000, 250 * 2 ** attempt)),
        );
        if (Date.now() - started + delay > MAX_RETRY_TIME_MS) throw error;
        attempt++;
        releaseSlot();
        released = true;
        await pause(delay);
        continue;
      }
      finally {
        if (!released) releaseSlot();
      }
    }
  })();
  if (retryable && key) {
    inflight.set(key, request);
    try { return await request; }
    finally { if (inflight.get(key) === request) inflight.delete(key); }
  }
  return request;
}

function stableKey(value) {
  try { return JSON.stringify(value); } catch { return undefined; }
}
const API_RESOURCES = new Set(['spreadsheets', 'values', 'files', 'permissions']);
const API_METHODS = new Set(['get', 'list', 'batchGet', 'append', 'clear', 'create', 'update', 'batchUpdate', 'delete']);
const NESTED_RESOURCES = new Set(['values', 'sheets', 'developerMetadata']);
const managedFunctions = new WeakSet();

export function manageGoogleClient(client) {
  const configure = (resource, path) => {
    if (!resource || typeof resource !== 'object') return;
    for (const method of API_METHODS) {
      const original = resource[method];
      if (typeof original !== 'function' || managedFunctions.has(original)) continue;
      const canRetry = RETRYABLE_METHODS.has(method);
      const wrapped = function (...args) {
        const key = canRetry ? `${path}.${method}:${stableKey(args)}` : undefined;
        return runGoogleRequest(() => Reflect.apply(original, resource, args), {
          retryable: canRetry,
          key,
        });
      };
      managedFunctions.add(wrapped);
      Object.defineProperty(resource, method, {
        value: wrapped,
        configurable: true,
        writable: true,
      });
    }
    for (const property of NESTED_RESOURCES) {
      const child = resource[property];
      if (child && typeof child === 'object') configure(child, `${path}.${property}`);
    }
  };
  for (const resource of API_RESOURCES) {
    const value = client[resource];
    if (value && typeof value === 'object') configure(value, resource);
  }
  return client;
}
