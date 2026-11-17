// The Engine's shared on/off switch (`__MARINARA_HOST__.components.Switch`, capability API 1.830).
import type { ComponentType } from "react";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Not in the Engine type; its Switch passes other props to the button. */
  "aria-describedby"?: string;
  title?: string;
  className?: string;
}

export const Switch = requireHostMember<ComponentType<SwitchProps>>(
  "the Switch component",
  (host) => host.components?.Switch,
);
