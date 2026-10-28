type Entry = { value: string; expiresAt: number };

type Options = {
  maxEntries: number;
  maxSize: number;
  now?: () => number;
};

export function createTtlCache({ maxEntries, maxSize, now = Date.now }: Options) {
  const entries = new Map<string, Entry>();
  let size = 0;

  function remove(key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    size -= entry.value.length;
    entries.delete(key);
  }

  return {
    get(key: string) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        remove(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    set(key: string, value: string, ttlMs: number) {
      remove(key);
      if (ttlMs <= 0 || value.length > maxSize) return;

      const time = now();
      for (const [other, entry] of entries) if (entry.expiresAt <= time) remove(other);

      entries.set(key, { value, expiresAt: time + ttlMs });
      size += value.length;

      for (const other of entries.keys()) {
        if (entries.size <= maxEntries && size <= maxSize) break;
        remove(other);
      }
    },

    clear() {
      entries.clear();
      size = 0;
    },

    stats: () => ({ entries: entries.size, size }),
  };
}
