interface CacheValue<T> {
  value: T;
  handle: any;
}

export class PingableTimedCache<T> {
  values: Map<string, CacheValue<T>> = new Map();
  defaultTtl: number;

  constructor(defaultTtl?: number) {
    this.defaultTtl = defaultTtl ?? 30000;
  }

  delete(key: string) {
    const value = this.values.get(key);
    if (!value) return;
    clearTimeout(value.handle);
    this.values.delete(key);
  }

  set(key: string, value: T) {
    const handle = setTimeout(() => this.delete(key), this.defaultTtl);
    this.values.set(key, {
      value,
      handle,
    });
  }

  has(key: string) {
    return this.values.has(key);
  }

  get(key: string) {
    const value = this.values.get(key);
    if (!value) return;
    clearTimeout(value.handle);
    const handle = setTimeout(() => this.delete(key), this.defaultTtl);
    this.values.set(key, {
      value: value.value,
      handle,
    });
    return value.value;
  }
}
