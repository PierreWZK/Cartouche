// Cache mémoire à durée de vie : limite les appels aux API externes (quotas RAWG et IGDB).
// Appelé par upstream.ts.
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
