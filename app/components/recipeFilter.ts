// Round 66: tiny pure helper for the Recipes search (name only, case-insensitive, trimmed).
export function filterByName<T extends { name: string; alt?: { th?: string; en?: string } }>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  // Round 79: the other-language name finds it too.
  return list.filter((r) => [r.name, r.alt?.th, r.alt?.en].some((n) => n?.toLowerCase().includes(q)));
}
