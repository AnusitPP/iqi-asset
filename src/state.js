import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

// Local development uses expiring memory. Hosted instances share Redis state.
export class StateStore {
  constructor({ url, token, prefix = 'iqi' } = {}) {
    this.url = url;
    this.token = token;
    this.prefix = prefix;
    this.values = new Map();
    this.queues = new Map();
  }
  async command(...command) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (!response.ok || data.error)
      throw Object.assign(new Error('เชื่อมต่อที่เก็บ session ไม่สำเร็จ'), { status: 503 });
    return data.result;
  }
  key(key) { return `${this.prefix}:${key}`; }
  async get(key) {
    if (this.url) {
      const value = await this.command('GET', this.key(key));
      return value === null ? undefined : JSON.parse(value);
    }
    const entry = this.values.get(key);
    if (entry?.expires > Date.now()) return structuredClone(entry.value);
    this.values.delete(key);
  }
  async set(key, value, ttl) {
    if (this.url) return this.command('SET', this.key(key), JSON.stringify(value), 'PX', ttl);
    for (const [id, entry] of this.values) if (entry.expires <= Date.now()) this.values.delete(id);
    if (this.values.size >= 4000 && !this.values.has(key))
      this.values.delete(this.values.keys().next().value);
    this.values.set(key, { value: structuredClone(value), expires: Date.now() + ttl });
  }
  async delete(key) {
    if (this.url) return this.command('DEL', this.key(key));
    this.values.delete(key);
  }
  async withLock(name, work) {
    if (!this.url) {
      const previous = this.queues.get(name) || Promise.resolve();
      const next = previous.catch(() => {}).then(work);
      this.queues.set(name, next);
      try { return await next; }
      finally { if (this.queues.get(name) === next) this.queues.delete(name); }
    }
    const key = this.key(`lock:${name}`), owner = randomUUID();
    const deadline = Date.now() + 10000;
    // The lease exceeds the API's 120 second execution limit.
    while (!(await this.command('SET', key, owner, 'NX', 'PX', 300000))) {
      if (Date.now() >= deadline)
        throw Object.assign(new Error('มีคำขอกำลังบันทึก กรุณาลองใหม่อีกครั้ง'), { status: 409 });
      await setTimeout(100);
    }
    try { return await work(); }
    finally {
      await this.command('EVAL', "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, owner);
    }
  }
}

export function writeLocked(adapter, work) {
  return adapter.state
    ? adapter.state.withLock(`writes:${adapter.config.spreadsheetId}`, work)
    : work();
}
