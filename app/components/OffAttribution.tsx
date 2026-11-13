import { OFF_ATTRIBUTION } from "../lib/food/openFoodFacts";

/** Must show wherever Open Food Facts data appears (ODbL). */
export function OffAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[13px] text-muted ${className}`} data-testid="off-attribution">
      <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline">
        {OFF_ATTRIBUTION}
      </a>
    </p>
  );
}
