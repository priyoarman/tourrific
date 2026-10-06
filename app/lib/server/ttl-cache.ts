// A small in-memory cache for text that stays valid for a while. It is bounded
// both by how many entries it holds and by their total length, so it cannot
// grow past a known share of the server's memory.

type Entry = { value: string; expiresAt: number };

type Options = {
  maxEntries: number;
  /** The most characters all values together may take up. */
  maxSize: number;
  /** The clock, in milliseconds. Tests pass their own. */
  now?: () => number;
};

export function createTtlCache({ maxEntries, maxSize, now = Date.now }: Options) {
  // A Map keeps insertion order, so the first key is the least recently used.
  const entries = new Map<string, Entry>();
  let size = 0;

  function remove(key: string) {
    const entry = entries.get(key);
    if (!entry) return;
    size -= entry.value.length;
    entries.delete(key);
  }

  return {
    /** The value stored under `key`, unless it has expired. */
    get(key: string) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        remove(key);
        return undefined;
      }
      // Set again, so the key moves to the recently-used end. Its expiry stays as it was.
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    /** Stores `value` for `ttlMs`. A value too big to ever fit is not stored. */
    set(key: string, value: string, ttlMs: number) {
      remove(key);
      if (ttlMs <= 0 || value.length > maxSize) return;

      const time = now();
      for (const [other, entry] of entries) if (entry.expiresAt <= time) remove(other);

      entries.set(key, { value, expiresAt: time + ttlMs });
      size += value.length;

      // Make room by dropping the least recently used.
      for (const other of entries.keys()) {
        if (entries.size <= maxEntries && size <= maxSize) break;
        remove(other);
      }
    },

    clear() {
      entries.clear();
      size = 0;
    },

    /** How many entries are held, and how many characters they take up. */
    stats: () => ({ entries: entries.size, size }),
  };
}
