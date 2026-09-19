import {
  ArrowDown,
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Info,
  Link,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Moon,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { SlurpComposeTarget } from "../../features/messages/slp-messages-contract";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { CommissionRequest, CommissionRow, isCommissionRequest, SlurpCommissionsPanel } from "./commissions/SlpCommissions";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { getApiErrorMessage } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { SlurpEmptyArtwork } from "../../base/chrome/SlpEmptyArtwork";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreateSlurpCommission } from "../../features/messages/commissions/slp-commission-hooks";
import type {
  SlurpMessage,
  SlurpThread,
  SlurpThreadRelationship,
} from "../../features/messages/slp-messages-contract";
import {
  useBroadcastSlurpMessage,
  useCancelSlurpFollowUp,
  useDraftSlurpCreatorReply,
  useForceSlurpReply,
  useGenerateSlurpViewerImage,
  useReactToSlurpMessage,
  useRequestSlurpReply,
  useResetSlurpThread,
  useResolveSlurpMessageRequest,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorPpv,
  useSendSlurpCreatorReply,
  useSendSlurpMessage,
  useSendSlurpViewerImage,
  useSetSlurpThreadNotes,
  useSlurpCheatDirective,
  useTipInSlurpThread,
  useUnlockSlurpMessage,
} from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
  useSlurpThreads,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";

// Creator-side tools: broadcast, the message toolbar and the fan image picker.

export function BroadcastPanel({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const broadcast = useBroadcastSlurpMessage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const content = draft.trim();
    if (!content || broadcast.isPending) return;
    try {
      const sent = await broadcast.mutateAsync({ creatorAccountId, personaId, content });
      setDraft("");
      setResult(
        localizeUi("ui.slurp.messages.broadcastSent", {
          defaultValue: "Sent to {{count}} subscribers.",
          count: sent.sent,
        }),
      );
    } catch (cause) {
      setResult(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.broadcastFailed", { defaultValue: "Could not send that broadcast." }),
      );
    }
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-[var(--slurp-surface)]/55 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-white/[0.055]",
        open ? "w-full" : "self-end",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-xs font-semibold text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Megaphone size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
        {localizeUi("ui.slurp.messages.broadcast", { defaultValue: "Broadcast to subscribers" })}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-broadcast-draft">
            {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast message" })}
          </label>
          <textarea
            id="slurp-broadcast-draft"
            value={draft}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.broadcastPlaceholder", {
              defaultValue: "Something for everyone who subscribes…",
            })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center justify-between gap-2">
            <p aria-live="polite" className="min-w-0 truncate text-xs text-[var(--muted-foreground)]">
              {result}
            </p>
            <button
              type="button"
              disabled={!draft.trim() || broadcast.isPending}
              onClick={() => void submit()}
              className="min-h-11 shrink-0 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.broadcastSend", { defaultValue: "Send broadcast" })}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Creator-side composer for one locked message, priced per send. */
export function CreatorMessageTools({
  creatorAccountId,
  viewerAccountId,
  personaId,
  defaultPpvPrice,
  threadId,
  onPreparingImage,
  mode,
}: {
  creatorAccountId: string;
  viewerAccountId: string;
  personaId: string;
  /** The creator's configured PPV price, used as the opening offer rather than a fixed one. */
  defaultPpvPrice: number;
  threadId: string;
  onPreparingImage: (preparing: boolean) => void;
  mode: "locked" | "generate";
}) {
  const { t: localizeUi } = useUiTranslation();
  const sendPpv = useSendSlurpCreatorPpv();
  const sendImage = useSendSlurpCreatorImage();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [price, setPrice] = useState(defaultPpvPrice > 0 ? defaultPpvPrice : 10);
  const [error, setError] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageIntent, setImageIntent] = useState<"friendly" | "hostile" | "premium">("friendly");

  const submit = async () => {
    const body = content.trim();
    if (!body || price <= 0 || sendPpv.isPending) return;
    setError(null);
    try {
      await sendPpv.mutateAsync({
        creatorAccountId,
        personaId,
        viewerAccountId,
        content: body,
        price,
      });
      setContent("");
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.ppvFailed", { defaultValue: "Could not send that locked message." }),
      );
    }
  };

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      {mode === "locked" && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-bold transition-colors hover:bg-[var(--noodle-accent)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          <Lock size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.sendPpv", { defaultValue: "Send locked content" })}
        </button>
      )}
      {mode === "locked" && open && (
        <div className="flex flex-col gap-2 border-t border-[var(--noodle-divider)] p-3">
          <label className="sr-only" htmlFor="slurp-ppv-draft">
            {localizeUi("ui.slurp.messages.ppvLabel", { defaultValue: "Locked message" })}
          </label>
          <textarea
            id="slurp-ppv-draft"
            value={content}
            rows={2}
            maxLength={2000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.ppvPlaceholder", { defaultValue: "What they pay to see…" })}
            className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="slurp-ppv-price" className="text-xs font-bold text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.ppvPrice", { defaultValue: "Price" })}
            </label>
            <input
              id="slurp-ppv-price"
              type="number"
              min={1}
              max={9999}
              value={price}
              onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
              className="h-9 w-24 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
            />
            <button
              type="button"
              disabled={!content.trim() || price <= 0 || sendPpv.isPending}
              onClick={() => void submit()}
              className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              {localizeUi("ui.slurp.messages.ppvSend", { defaultValue: "Send locked" })}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
      {mode === "generate" && (
        <div className="p-3">
          <label className="text-xs font-bold" htmlFor="slurp-creator-image-prompt">
            Generate a picture
          </label>
          <textarea
            id="slurp-creator-image-prompt"
            value={imagePrompt}
            rows={2}
            maxLength={1000}
            onChange={(event) => setImagePrompt(event.target.value)}
            className="mt-2 w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
            placeholder="What do you want to show them?"
          />
          <select
            value={imageIntent}
            onChange={(event) => setImageIntent(event.target.value as typeof imageIntent)}
            className="mt-2 h-9 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm"
          >
            <option value="friendly">Friendly</option>
            <option value="hostile">Hostile</option>
            <option value="premium">Premium</option>
          </select>
          <button
            type="button"
            disabled={!imagePrompt.trim() || sendImage.isPending}
            onClick={() => {
              onPreparingImage(true);
              void sendImage
                .mutateAsync({
                  threadId,
                  creatorAccountId,
                  personaId,
                  prompt: imagePrompt.trim(),
                  content: "",
                  intent: imageIntent,
                })
                .then(
                  () => {
                    setImagePrompt("");
                    onPreparingImage(false);
                  },
                  (cause) => {
                    onPreparingImage(false);
                    setError(cause instanceof Error ? cause.message : "Could not send that picture.");
                  },
                );
            }}
            className="mt-2 min-h-10 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
          >
            {sendImage.isPending ? "Making…" : "Generate and send"}
          </button>
        </div>
      )}
    </div>
  );
}

export function FanImageTool({
  threadId,
  creatorAccountId,
  personaId,
  mode,
}: {
  threadId: string;
  creatorAccountId: string;
  personaId: string;
  mode: "choose" | "upload" | "generate";
}) {
  const { t: localizeUi } = useUiTranslation();
  const send = useSendSlurpViewerImage();
  const generate = useGenerateSlurpViewerImage();
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"upload" | "generate">("upload");
  const activeMode = mode === "choose" ? selectedMode : mode;
  const viewerPrompt = prompt.trim() ? `A photo taken by the viewer persona: ${prompt.trim()}` : "";
  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <div className="flex flex-col gap-2 p-3">
        {error && (
          <p role="alert" className="text-xs leading-5 text-[var(--destructive)]">
            {error}
          </p>
        )}
        {mode === "choose" && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Photo source">
            {(["upload", "generate"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={activeMode === option}
                onClick={() => setSelectedMode(option)}
                className={cn(
                  "min-h-10 flex-1 rounded-lg px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)]",
                  activeMode === option && "bg-[var(--noodle-accent)] text-zinc-950",
                )}
              >
                {option === "upload" ? "Upload" : "Generate"}
              </button>
            ))}
          </div>
        )}
        {!reviewing ? (
          <>
            {activeMode === "generate" && (
              <textarea
                value={prompt}
                rows={2}
                maxLength={1000}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the photo the viewer persona took"
                className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
              />
            )}
            {activeMode === "upload" && (
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-xs"
              />
            )}
            <input
              value={content}
              maxLength={1000}
              onChange={(event) => setContent(event.target.value)}
              placeholder={localizeUi("ui.slurp.messages.imageCaption", {
                defaultValue: "Say something with it (optional)",
              })}
              className="h-10 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
            />
            <button
              type="button"
              disabled={activeMode === "upload" ? !file : !prompt.trim()}
              onClick={() => setReviewing(true)}
              className="min-h-10 self-end rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
            >
              Review photo
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {file && <FanImagePreview file={file} />}
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {activeMode === "generate" ? viewerPrompt : "Review this photo before sending it."}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                className="min-h-10 rounded-lg px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)]"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={activeMode === "upload" ? !file || send.isPending : !prompt.trim() || generate.isPending}
                onClick={() => {
                  setError(null);
                  const request =
                    activeMode === "upload"
                      ? file && send.mutateAsync({ threadId, creatorAccountId, personaId, file, content })
                      : generate.mutateAsync({ threadId, creatorAccountId, personaId, prompt: viewerPrompt, content });
                  if (!request) return;
                  void request
                    .then(() => {
                      setFile(null);
                      setPrompt("");
                      setContent("");
                      setReviewing(false);
                    })
                    .catch((cause: unknown) => {
                      setError(cause instanceof Error ? cause.message : "Could not send that picture.");
                    });
                }}
                className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
              >
                {send.isPending || generate.isPending ? "Sending…" : "Send photo"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FanImagePreview({ file }: { file: File | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setFailed(false);
    if (typeof createImageBitmap !== "function") {
      setFailed(true);
      return;
    }
    void createImageBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          bitmap.close();
          setFailed(true);
          return;
        }
        const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (failed) {
    return (
      <p role="img" aria-label="Photo preview unavailable" className="text-xs text-[var(--muted-foreground)]">
        Photo preview unavailable. The file can still be sent.
      </p>
    );
  }
  return <canvas ref={canvasRef} role="img" aria-label="Photo preview" className="max-h-48 max-w-full rounded-lg" />;
}

