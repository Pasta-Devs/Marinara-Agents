// The Engine's search field (`__MARINARA_HOST__.components.SearchInput`, capability API 1.832). Its clear
// button and result count use the Engine's translations, so it renders under the Engine's i18n even
// where a package wraps its screen in its own <I18nextProvider>.
import { createElement, type ComponentType, type InputHTMLAttributes, type RefObject } from "react";
import { I18nextProvider, getI18n } from "react-i18next";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Read by screen readers; the placeholder can say more. */
  label: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  /** "compact" for dense toolbars and side panes. */
  size?: "default" | "compact";
  /** Shown as "4 found" / "None found" while there is text. */
  resultCount?: number;
  busy?: boolean;
  /** The page's main search: "/" focuses it. Once per page. */
  slashShortcut?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type" | "size">;

const HostSearchInput = requireHostMember<ComponentType<SearchInputProps>>(
  "the SearchInput component",
  (host) => host.components?.SearchInput,
);

export function SearchInput(props: SearchInputProps) {
  const field = createElement(HostSearchInput, props);
  const engineI18n = getI18n();
  return engineI18n ? createElement(I18nextProvider, { i18n: engineI18n }, field) : field;
}
