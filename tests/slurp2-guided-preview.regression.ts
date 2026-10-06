/** Render the actual composer with small host fakes; prove compact preview, Edit, and publish safety. */
import assert from "node:assert/strict";
import { transformSync } from "esbuild";
import { runInNewContext } from "node:vm";
import { slurp2Source } from "./slurp2-source";

const source = (file: string) =>
  slurp2Source(new URL(`../packages/slurp2/src/engine/packages/client/src/slp/app/screens/${file}`, import.meta.url));
type Element = { type: string | { name: string }; props: Record<string, any> };
const jsx = (type: Element["type"], props: Element["props"]) => ({ type, props });
let cursor = 0;
const states: any[] = [];
const deps: any[][] = [];
const store = {
  composeGuide: { accountId: "persona", idea: "" } as object | null,
  setComposeGuide: (guide: object | null) => {
    store.composeGuide = guide;
  },
};
const names = new Map<string, (...args: any[]) => any>();
const named = (name: string) => {
  if (!names.has(name))
    names.set(
      name,
      Object.defineProperty(() => null, "name", { value: name }),
    );
  return names.get(name)!;
};
const host: Record<string, any> = {
  jsx,
  jsxs: jsx,
  Fragment: "fragment",
  useState: (initial: any) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (value: any) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      },
    ];
  },
  useRef: (initial: any) => {
    const index = cursor++;
    return (states[index] ??= { current: initial });
  },
  useEffect: (effect: () => void, next: any[]) => {
    const index = cursor++;
    if (!deps[index] || next.some((value, i) => value !== deps[index][i])) {
      deps[index] = next;
      effect();
    }
  },
  useTranslation: () => ({ t: (key: string) => key }),
  useSlurpUIStore: (select: (value: typeof store) => any) => select(store),
  useSlpViewerPersonaId: () => "persona",
  useSlurpTiesMutations: () => ({ markPosted: { mutate: () => undefined } }),
  useSlurpSettings: () => ({ data: {} }),
  useSlurpCreatorMessagingSettings: () => ({ data: undefined }),
  isEmptyCreatorPostDraft: (draft: any) => !draft.body && !draft.image,
  SLP_TYPE: { meta: "", body: "", title: "" },
  cn: (...values: any[]) => values.filter((value) => typeof value === "string").join(" "),
};
const load = (file: string) => {
  const exports = {};
  const module = { exports };
  runInNewContext(transformSync(source(file), { loader: "tsx", format: "cjs", jsx: "automatic" }).code, {
    exports,
    module,
    atob,
    File,
    require: () => new Proxy(host, { get: (target, name: string) => (name in target ? target[name] : named(name)) }),
  });
  return module.exports as Record<string, (...args: any[]) => Element>;
};
function elements(node: any): Element[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
const component = (tree: Element, name: string) =>
  elements(tree).filter((node) =>
    typeof node.type === "object"
      ? node.type.name === name
      : typeof node.type === "function" && node.type.name === name,
  );
async function main() {
  const composer = load("SlpScreenComposer.tsx").NoodlerPostComposer;
  let draft: any = {
    title: "",
    body: "",
    image: null,
    poll: null,
    postType: "post",
    access: "public",
    generateImage: false,
  };
  let posts = 0;
  let closed = 0;
  const props = {
    open: true,
    profile: { id: "persona", displayName: "Persona" },
    availablePosts: [],
    onClose: () => {
      closed++;
    },
    onDraftChange: (patch: object) => {
      draft = { ...draft, ...patch };
    },
    onClearDraft: () => undefined,
    onDiscardDraft: () => undefined,
    onManualPost: async () => {
      posts++;
    },
    manualPending: false,
  };
  const render = () => {
    cursor = 0;
    return composer({ ...props, draft });
  };
  let tree = render();
  assert.equal(component(tree, "SlpAutoGrowTextarea").length, 0, "Stir opens a preview, not the full editor");
  const guide = component(tree, "SlpPostGuide")[0];
  draft = { ...draft, body: "An older draft" };
  guide.props.onPendingChange(true);
  tree = render();
  assert.equal(tree.props.closeDisabled, true, "Cannot close while the draft is generating");
  assert.equal(
    component({ type: "footer", props: { children: tree.props.footer } }, "SlpPrimaryButton")[0].props.disabled,
    true,
  );
  await component({ type: "footer", props: { children: tree.props.footer } }, "SlpPrimaryButton")[0].props.onClick();
  assert.equal(posts, 0, "Generating never publishes an older draft");
  tree.props.onClose();
  assert.equal(closed, 0, "Generating cannot close the sheet");
  guide.props.onDraft({ text: "A drafted caption", image: "data:image/png;base64,AA", dealId: null });
  guide.props.onPendingChange(false);
  tree = render();
  assert.equal(component(tree, "SlpCreatorDraftImageFrame").length, 1);
  const keptPicture = draft.image;
  component(tree, "SlpPostGuide")[0].props.onDraft({ text: "A drafted caption", image: null, dealId: null });
  assert.equal(draft.image, keptPicture, "Text-only drafting preserves an uploaded or existing picture");
  assert.equal(
    component(tree, "SlpAutoGrowTextarea").length,
    0,
    "The preview remains compact after handoff is cleared",
  );
  const footer = { type: "footer", props: { children: tree.props.footer } };
  component(footer, "SlpButton")[0].props.onClick();
  tree = render();
  assert.equal(
    component(tree, "SlpAutoGrowTextarea")[0].props.value,
    "A drafted caption",
    "Edit preserves the caption",
  );
  assert.equal(component(tree, "SlpCreatorDraftImageFrame").length, 1, "Edit preserves the picture");
  assert.equal(posts, 0);
  assert.equal(closed, 0);
  component({ type: "footer", props: { children: tree.props.footer } }, "SlpPrimaryButton")[0].props.onClick();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(posts, 1, "Only the explicit Post action publishes");
  assert.equal(closed, 1);
  assert.equal(store.composeGuide, null, "Publishing clears the handoff for the next Stir request");

  // The own-page action enters Stir directly; other pages keep the existing manual composer.
  const actions = load("SlpProfileLeadingActions.tsx").SlpProfileLeadingActions;
  let guided = 0;
  let manual = 0;
  const model = {
    editing: false,
    viewingOwnCreator: true,
    localizeUi: (key: string) => key,
    openComposer: () => {
      manual++;
    },
  };
  cursor = 0;
  component(
    actions({
      model,
      onOpenGuide: () => {
        guided++;
      },
    }),
    "SlpButton",
  )[0].props.onClick();
  assert.equal(guided, 1);
  assert.equal(manual, 0);
  cursor = 0;
  component(actions({ model }), "SlpButton")[0].props.onClick();
  assert.equal(manual, 1);
  // NPC Stir hands off directly to the same guide, rather than opening its manual plan sheet.
  const npcSheet = slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/client/src/slp/features/stir/SlpStirCreatorSheet.tsx",
      import.meta.url,
    ),
  );
  const handoff = npcSheet.slice(
    npcSheet.indexOf('if (action === "write-post" && creator)'),
    npcSheet.indexOf("} else setPlaying(action);") + "} else setPlaying(action);".length,
  );
  const calls: string[] = [];
  runInNewContext(transformSync(handoff, { loader: "ts" }).code, {
    action: "write-post",
    creator: { id: "npc" },
    close: () => calls.push("close"),
    setPlaying: () => assert.fail("An NPC post should open the guide directly"),
    useSlurpUIStore: {
      getState: () => ({
        setComposeGuide: (guide: { accountId: string; idea: string }) => {
          assert.equal(guide.accountId, "npc");
          assert.equal(guide.idea, "");
          calls.push("guide");
        },
        setNavigation: (navigation: { accountId: string }) => {
          assert.equal(navigation.accountId, "npc");
          calls.push("navigate");
        },
      }),
    },
  });
  assert.deepEqual(calls, ["close", "guide", "navigate"]);
  // Exercise the actual guide's request, toggle, and direct-upload controls.
  states.length = 0;
  deps.length = 0;
  host.useSlurpTies = () => ({ data: undefined });
  const requests: any[] = [];
  host.runSlpAction = async (_action: string, input: any) => {
    requests.push(input);
    return { text: "Caption", image: null, imageError: null };
  };
  const postGuide = load("../../features/assist/SlpPostGuide.tsx").SlpPostGuide;
  let uploads = 0;
  const renderGuide = () => {
    cursor = 0;
    return postGuide({
      accountId: "persona",
      personaId: "persona",
      story: false,
      initialIdea: "An idea",
      onDraft: () => undefined,
      onUpload: () => uploads++,
    });
  };
  const submitGuide = async () => {
    elements(renderGuide())
      .find((node) => node.type === "form")!
      .props.onSubmit({ preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));
  };
  await submitGuide();
  assert.equal(requests.at(-1).picture, true, "Image generation is explicit in the request");
  elements(renderGuide())
    .find((node) => node.type === "input" && node.props.type === "checkbox")!
    .props.onChange({ target: { checked: false } });
  await submitGuide();
  assert.equal(requests.at(-1).picture, false, "The toggle permits text-only drafting");
  elements(renderGuide())
    .find((node) => node.type === "input" && node.props.type === "checkbox")!
    .props.onChange({ target: { checked: true } });
  component(renderGuide(), "SlpButton")[0].props.onClick();
  assert.equal(uploads, 1, "Upload is available directly in the shared guide");
  await submitGuide();
  assert.equal(requests.at(-1).picture, false, "Uploading turns generation off to preserve the picture");
  console.log("slurp2 guided preview: ok");
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
