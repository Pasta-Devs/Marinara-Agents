// The Engine's shared loading ring (`__MARINARA_HOST__.components.Spinner`, capability API 1.830). Pass `label` to
// announce it; without one it is hidden from screen readers.
import type { ComponentType, HTMLAttributes } from "react";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export const Spinner = requireHostMember<ComponentType<SpinnerProps>>(
  "the Spinner component",
  (host) => host.components?.Spinner,
);
