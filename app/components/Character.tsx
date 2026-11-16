// Yani's brand character: her black lines only, see-through everywhere else.
// Her drawing is never changed (public/character-lines.png, from scripts/character-lines-only.mjs).
// No dress-up any more (Round 32): it is a fixed logo.

export function CharacterPicture({ size }: { size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- her exact file; no resizing service needed
    <img src="/character-lines.png" alt="" width={size} height={size} className="block shrink-0" draggable={false} aria-hidden />
  );
}
