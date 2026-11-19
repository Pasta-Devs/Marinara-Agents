// The Engine's shared tab bar (`__MARINARA_HOST__.components.Tabs`, capability API 1.832).
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
  badge?: ReactNode;
  title?: string;
  disabled?: boolean;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | undefined>;
}

export interface TabsProps<T extends string = string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** "pill" switches views; "underline" picks a section inside a sheet or dialog. */
  variant?: "pill" | "underline";
  label: string;
  idPrefix?: string;
  columns?: number;
  inlineIcons?: boolean;
  className?: string;
  tabClassName?: string;
}

export const Tabs = requireHostMember<<T extends string = string>(props: TabsProps<T>) => ReactNode>(
  "the Tabs component",
  (host) => host.components?.Tabs,
);
