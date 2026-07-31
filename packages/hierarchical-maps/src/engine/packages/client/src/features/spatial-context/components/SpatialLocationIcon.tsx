import { cn } from "../package-utils";

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
      title={value.length > 16 ? value : undefined}
      className={cn(
        "inline-block max-w-[2.5em] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-center align-middle",
        className,
      )}
    >
      {value}
    </span>
  );
}
