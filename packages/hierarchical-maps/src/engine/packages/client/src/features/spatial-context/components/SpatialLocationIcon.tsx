import { cn } from "../package-utils";
import { SPATIAL_LOCATION_ICON_MAX_LENGTH } from "../../../../../maps-shared/src/maps-model";

interface SpatialLocationIconProps {
  icon?: string | null;
  fallback?: string;
  className?: string;
}

export function SpatialLocationIcon({ icon, fallback = "⌖", className }: SpatialLocationIconProps) {
  const value = icon?.trim() || fallback;

  return (
    <span
      data-marinara-location-icon
      aria-hidden="true"
      title={value.length > SPATIAL_LOCATION_ICON_MAX_LENGTH ? value : undefined}
      className={cn(
        "inline-block max-w-[2.5em] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-center align-middle",
        className,
      )}
    >
      {value}
    </span>
  );
}
