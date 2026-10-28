// Expiring state and queues are local to this process; no external storage is used.
export class StateStore {
  constructor() {
    this.values = new Map();
    this.queues = new Map();
  }
  async get(key) {
    const entry = this.values.get(key);
    if (entry?.expires > Date.now()) return structuredClone(entry.value);
    this.values.delete(key);
  }
  async set(key, value, ttl) {
    for (const [id, entry] of this.values) if (entry.expires <= Date.now()) this.values.delete(id);
    if (this.values.size >= 4000 && !this.values.has(key))
      this.values.delete(this.values.keys().next().value);
    this.values.set(key, { value: structuredClone(value), expires: Date.now() + ttl });
  }
  async delete(key) {
    this.values.delete(key);
  }
  async withLock(name, work) {
    const previous = this.queues.get(name) || Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    this.queues.set(name, next);
    try {
      return await next;
    } finally {
      if (this.queues.get(name) === next) this.queues.delete(name);
    }
  }
}

export function writeLocked(adapter, work) {
  return adapter.state
    ? adapter.state.withLock(`writes:${adapter.config.spreadsheetId}`, work)
    : work();
}
