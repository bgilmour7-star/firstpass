// Compares two drill records by content, ignoring key order. Postgres jsonb stores
// object keys in its own order, so a saved drill comes back with keys reordered.
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, v[k]]))
      : v,
  );
}

export function sameDrill(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
