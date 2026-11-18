// Round 66: tiny pure helper for the Recipes search (name only, case-insensitive, trimmed).
export function filterByName<T extends { name: string }>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((r) => r.name.toLowerCase().includes(q));
}
