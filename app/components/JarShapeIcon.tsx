// Round 73: the small shape icon (heart / cloud / circle) used in the jar chips. Flat color, same shapes as the jar.
import { JAR_COLORS, JAR_SHAPES, type JarMacro } from "../lib/jar";

export function JarShapeIcon({ k, size = 18 }: { k: JarMacro; size?: number }) {
  const fill = JAR_COLORS[k];
  const shape = JAR_SHAPES[k];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} aria-hidden className="shrink-0">
      {shape === "heart" && <path d="M10 17 C2 11 2 4 6.5 3.5 C8.5 3.3 9.5 4.5 10 5.5 C10.5 4.5 11.5 3.3 13.5 3.5 C18 4 18 11 10 17Z" />}
      {shape === "cloud" && (
        <>
          <circle cx="6" cy="11" r="4.5" />
          <circle cx="14" cy="11" r="4.5" />
          <circle cx="10" cy="7.5" r="5" />
          <circle cx="10" cy="12.5" r="4.5" />
        </>
      )}
      {shape === "circle" && <circle cx="10" cy="10" r="8" />}
    </svg>
  );
}
