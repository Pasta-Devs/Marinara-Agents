// ──────────────────────────────────────────────
// The Engine's Modal, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Packages open the Engine's own Modal (`__MARINARA_HOST__.components.Modal`), so Escape, the back gesture and focus
// treat a package dialog like any other: only the topmost one closes. The feature build stacks this file over the
// vendored module. On an Engine without it the package does not load.
//
// The Engine portals its Modal to the page body. Noodle and Slurp style their screens with a stylesheet scoped to
// their element (`@scope (marinara-capability-<id>, [data-marinara-capability-scope="<id>"])`), and their portals
// carry theme variables. `ModalPortalContext` names that element, so the dialog content is wrapped in a scope root
// with the same scope and the variables the dialog panel does not set itself. What the content portals (a popover, a
// sheet) goes to a layer opened with the dialog, styled like the package portal and stacked above the dialog, where
// it was when the dialog lived in the package portal; the dialog's focus trap counts that layer as its own.
//
// Noodle and Slurp translate their screens with their own i18n instance (<I18nextProvider>). The Engine's Modal
// translates its own labels, so it renders with the Engine's instance and the content inside it with the package's.
import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { I18nContext, I18nextProvider, getI18n } from "react-i18next";
import { requireHostMember } from "../../lib/marinara-host-bridge";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width class, e.g. "max-w-md", "max-w-lg" */
  width?: string;
  contentRef?: Ref<HTMLDivElement>;
  chatFloatingPanel?: boolean;
  /** Below the sm breakpoint, fill the viewport edge-to-edge like a window instead of floating as a padded bubble. */
  mobileFullscreen?: boolean;
  /** Optional feature-local classes applied to the full panel, including its header. */
  panelClassName?: string;
  /** Optional feature-local style variables applied to the full panel. */
  panelStyle?: CSSProperties;
  /** Prevent every dismissal path while an action is in progress. */
  closeDisabled?: boolean;
  /** Optional classes for the scroll area. */
  contentClassName?: string;
}

type HostModalProps = ModalProps & { focusScopePortalSelector?: string };

const HostModal = requireHostMember<ComponentType<HostModalProps>>(
  "the Modal component",
  (host) => host.components?.Modal,
);

/** Where a package's own portals render; the package root provides its element. */
export const ModalPortalContext = createContext<Element | null>(null);

const SCOPE_ATTRIBUTE = "data-marinara-capability-scope";
const LAYER_ATTRIBUTE = "data-marinara-package-modal-layer";
const ELEMENT_PREFIX = "marinara-capability-";
// One above the Engine's Modal (z-index 10000), as package popovers (10001) sat above dialogs in the package portal.
// The layer is created before the dialog's own DOM, so an equal index would put it underneath.
// ponytail: a dialog the Engine lifts to the omnibar layer (opened while the omnibar is open) covers this layer; read
// the dialog's z-index if packages ever open dialogs from the omnibar.
const MODAL_LAYER_Z_INDEX = "10001";
// The Engine's dialog panel sets these itself (neutral-surface-styles.ts), so its content never saw the package
// portal's values for them. ponytail: a fixed list; a token the panel starts to set needs adding here.
const PANEL_TOKENS = new Set(
  [
    "accent",
    "accent-foreground",
    "background",
    "border",
    "card",
    "foreground",
    "input",
    "muted",
    "muted-foreground",
    "popover",
    "popover-foreground",
    "primary",
    "primary-foreground",
    "ring",
    "secondary",
  ].map((token) => `--${token}`),
);

type PackageScope = { id: string; root: Element; explicit: boolean; variables: Record<string, string> };

function packageScope(container: Element | null): PackageScope | null {
  if (!container) return null;
  const explicit = container.getAttribute(SCOPE_ATTRIBUTE);
  const tag = container.tagName.toLowerCase();
  const id = explicit ?? (tag.startsWith(ELEMENT_PREFIX) ? tag.slice(ELEMENT_PREFIX.length) : null);
  if (!id) return null;
  const variables: Record<string, string> = {};
  const style = (container as HTMLElement).style;
  for (let index = 0; style && index < style.length; index += 1) {
    const name = style.item(index);
    if (name.startsWith("--")) variables[name] = style.getPropertyValue(name);
  }
  return { id, root: container, explicit: explicit !== null, variables };
}

/** A body-level copy of the package portal for one open dialog, so its popovers stack above it. */
function usePackageLayer(scope: PackageScope | null, open: boolean, layerId: string): HTMLDivElement | null {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!scope || !open) return;
    const element = document.createElement("div");
    element.setAttribute(SCOPE_ATTRIBUTE, scope.id);
    element.setAttribute(LAYER_ATTRIBUTE, layerId);
    // Classes only from an explicit scope root: a package element's own classes are layout the Engine gave it.
    const classes = scope.explicit ? scope.root.getAttribute("class") : null;
    if (classes) element.setAttribute("class", classes);
    for (const [name, value] of Object.entries(scope.variables)) element.style.setProperty(name, value);
    Object.assign(element.style, { inset: "0", pointerEvents: "none", position: "fixed", zIndex: MODAL_LAYER_Z_INDEX });
    document.body.appendChild(element);
    setLayer(element);
    return () => {
      element.remove();
      setLayer(null);
    };
  }, [scope, open, layerId]);
  return layer;
}

export function Modal({ children, ...props }: ModalProps) {
  const container = useContext(ModalPortalContext);
  const packageTranslation = useContext(I18nContext);
  const scope = useMemo(() => packageScope(container), [container]);
  const layerId = useId();
  const layer = usePackageLayer(scope, props.open, layerId);
  const engineI18n = getI18n();
  const ownI18n = packageTranslation?.i18n && packageTranslation.i18n !== engineI18n ? packageTranslation : null;
  let content = children;
  if (ownI18n) content = <I18nContext.Provider value={ownI18n}>{content}</I18nContext.Provider>;
  let modal;
  if (!scope) {
    modal = <HostModal {...props}>{content}</HostModal>;
  } else {
    const inherited = Object.fromEntries(Object.entries(scope.variables).filter(([name]) => !PANEL_TOKENS.has(name)));
    modal = (
      <HostModal {...props} focusScopePortalSelector={`[${LAYER_ATTRIBUTE}="${CSS.escape(layerId)}"]`}>
        <div {...{ [SCOPE_ATTRIBUTE]: scope.id }} style={{ ...(inherited as CSSProperties), display: "contents" }}>
          <ModalPortalContext.Provider value={layer ?? container}>{content}</ModalPortalContext.Provider>
        </div>
      </HostModal>
    );
  }
  return ownI18n && engineI18n ? <I18nextProvider i18n={engineI18n}>{modal}</I18nextProvider> : modal;
}
