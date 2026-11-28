// The Engine's shared checkbox (`__MARINARA_HOST__.components.Checkbox`, capability API 1.830).
import type { ComponentType, InputHTMLAttributes } from "react";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export const Checkbox = requireHostMember<ComponentType<Omit<InputHTMLAttributes<HTMLInputElement>, "type">>>(
  "the Checkbox component",
  (host) => host.components?.Checkbox,
);
