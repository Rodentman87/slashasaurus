// Create a cache that clears a value after the default ttl
// and will refresh the timer on every get
export class PingableTimedCache<T> {
  private cache: Map<string, { value: T; time: number }> = new Map();
  private ttl: number;
  public timer: NodeJS.Timer;
  private leaveHook?: (value: T) => void;

  constructor(ttl: number, leaveHook?: (value: T) => void) {
    this.ttl = ttl;
    this.timer = setInterval(() => this.clear(), 1000);
    if (leaveHook) this.leaveHook = leaveHook;
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.time = Date.now();
      return entry.value;
    }
    return undefined;
  }

  public set(key: string, value: T): void {
    this.cache.set(key, { value, time: Date.now() });
  }

  public clear(): void {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now - entry.time > this.ttl) {
        this.leaveHook?.(entry.value);
        this.cache.delete(key);
      }
    });
  }
}
