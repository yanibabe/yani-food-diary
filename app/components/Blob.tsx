/** A little round blob friend with two dot eyes — the app's mascot. */
const SHAPES = [
  "M52 6C73 5 93 19 95 42C97 64 84 87 60 93C36 99 11 88 6 64C1 40 14 16 33 9C39 7 45 6 52 6Z",
  "M47 5C64 3 78 12 86 25C95 39 99 57 91 72C82 88 63 96 44 94C24 92 8 79 5 59C2 40 9 22 22 13C29 8 37 6 47 5Z",
  "M30 12C40 4 52 9 60 6C72 2 86 9 90 22C94 34 88 42 93 54C98 68 90 85 75 90C60 96 49 89 37 92C22 95 8 85 6 70C4 57 12 50 9 39C6 28 21 19 30 12Z",
];

export function Blob({
  color = "var(--yellow)",
  size = 40,
  shape = 0,
  eyes = true,
  look = 0,
  className = "",
}: {
  color?: string;
  size?: number;
  shape?: 0 | 1 | 2;
  eyes?: boolean;
  /** Moves the eyes left (−) or right (+), a few units. */
  look?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <path d={SHAPES[shape]} fill={color} />
      {eyes && (
        <g fill="#111">
          <ellipse cx={43 + look} cy={46} rx={4.2} ry={6} />
          <ellipse cx={58 + look} cy={46} rx={4.2} ry={6} />
        </g>
      )}
    </svg>
  );
}
