import { ImagePlus, Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpAutoGrowTextarea } from "../../base/ui/SlpAutoGrowTextarea";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { ApiError } from "../../../lib/api-client.js";
import { formatUpcomingClock } from "../../base/ui/slp-date-time";
import { SlurpCoinAmount, SlpCoinText } from "../../modules/coin/SlpCoin";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { useSlurpWallet } from "../economy/slp-economy-contract";
import { TIP_PRESETS } from "./SlpMessages";
import {
  useBroadcastSlurpMessage,
  useGenerateSlurpViewerImage,
  useSendSlurpCreatorImage,
  useSendSlurpCreatorPpv,
  useSendSlurpViewerImage,
  type SlurpPhotoSendResult,
} from "../../features/messages/slp-message-action-hooks";

// Creator-side tools: broadcast, the message toolbar and the fan image picker.

/**
 * Broadcast to subscribers (design step 7): a quiet "Broadcast" pill that opens a sheet titled with
 * who receives it ("To 37 subscribers"), a text field, and a preview of the bubble each subscriber
 * gets in their chat. Send stays off until there is text and someone to send it to.
 */
export function BroadcastPanel({
  creatorAccountId,
  personaId,
  subscriberCount,
  creator,
}: {
  creatorAccountId: string;
  personaId: string;
  subscriberCount: number;
  creator: { displayName: string; avatarUrl: string | null };
}) {
  const { t: localizeUi } = useUiTranslation();
  const broadcast = useBroadcastSlurpMessage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const content = draft.trim();

  const submit = async () => {
    if (!content || broadcast.isPending) return;
    setError(null);
    try {
      const sent = await broadcast.mutateAsync({ creatorAccountId, personaId, content });
      setDraft("");
      setOpen(false);
      toast.success(
        localizeUi("ui.slurp.messages.broadcastSent", {
          defaultValue: "Sent to {{count}} subscribers.",
          count: sent.sent,
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.broadcastFailed", { defaultValue: "Could not send that broadcast." }),
      );
    }
  };

  return (
    <>
      <SlpButton variant="quiet" onClick={() => setOpen(true)} className="min-h-10 shrink-0 px-4 text-[13px]">
        <Megaphone size={16} aria-hidden="true" />
        {localizeUi("ui.slurp.messages.broadcastShort", { defaultValue: "Broadcast" })}
      </SlpButton>
      <SlpSheet
        open={open}
        onClose={() => setOpen(false)}
        closeDisabled={broadcast.isPending}
        title={
          subscriberCount > 0
            ? localizeUi("ui.slurp.messages.broadcastTo", {
                defaultValue: "To {{count}} subscribers",
                count: subscriberCount,
              })
            : localizeUi("ui.slurp.messages.broadcastNobody", { defaultValue: "No subscribers yet" })
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <SlpButton variant="tertiary" onClick={() => setOpen(false)} disabled={broadcast.isPending}>
              {localizeUi("chat.delete.dialog.cancel")}
            </SlpButton>
            <SlpPrimaryButton
              disabled={!content || subscriberCount === 0 || broadcast.isPending}
              aria-busy={broadcast.isPending}
              onClick={() => void submit()}
              className="px-6"
            >
              {broadcast.isPending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {localizeUi("ui.slurp.messages.broadcastSend", { defaultValue: "Send broadcast" })}
            </SlpPrimaryButton>
          </div>
        }
      >
        <div className="space-y-4 px-2 pb-2">
          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
            {subscriberCount > 0
              ? localizeUi("ui.slurp.messages.broadcastDetail", {
                  defaultValue: "Lands in each subscriber's chat with you, like a message you sent them.",
                })
              : localizeUi("ui.slurp.messages.broadcastNobodyDetail", {
                  defaultValue: "Once someone subscribes, you can message all of them at once from here.",
                })}
          </p>
          <label className="sr-only" htmlFor={`slurp-broadcast-draft-${creatorAccountId}`}>
            {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast message" })}
          </label>
          <SlpAutoGrowTextarea
            id={`slurp-broadcast-draft-${creatorAccountId}`}
            value={draft}
            maxLength={2000}
            disabled={broadcast.isPending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.broadcastPlaceholder", {
              defaultValue: "Something for everyone who subscribes…",
            })}
            className="min-h-24 w-full resize-none rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3 text-base leading-6 shadow-[var(--slurp-highlight)] outline-none placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[15px]"
          />
          {/* What a subscriber sees: your bubble, incoming, in their chat. */}
          <div aria-hidden={!content} className="space-y-2">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {localizeUi("ui.slurp.messages.broadcastPreview", { defaultValue: "Preview" })}
            </p>
            <div className="flex items-end gap-2 rounded-2xl bg-[var(--slurp-canvas)] p-3">
              <Avatar account={creator} size="sm" />
              <p
                className={cn(
                  SLP_TYPE.body,
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] rounded-bl-md bg-[var(--slurp-surface-raised)] px-3.5 py-2 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
                  !content && "text-[var(--slurp-muted)]",
                )}
              >
                {content ||
                  localizeUi("ui.slurp.messages.broadcastPreviewEmpty", {
                    defaultValue: "Your message shows up here.",
                  })}
              </p>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-[var(--slurp-danger)]">
              {error}
            </p>
          )}
        </div>
      </SlpSheet>
    </>
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
          <SlpLockGlyph size={14} className="text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
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
              className="ml-auto min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
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
            className="mt-2 min-h-10 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
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
  onSent,
  asSupport = false,
}: {
  threadId: string;
  creatorAccountId: string;
  personaId: string;
  mode: "choose" | "upload" | "generate";
  /** Slurp Support sends it, in Support's thread; a created picture shows only what is described. */
  asSupport?: boolean;
  /** The photo landed: the thread shows the answer (typing first) and closes the sheet (R1-019). */
  onSent?: (result: SlurpPhotoSendResult) => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const send = useSendSlurpViewerImage();
  const generate = useGenerateSlurpViewerImage();
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"upload" | "generate">("upload");
  const activeMode = mode === "choose" ? selectedMode : mode;
  // The server frames it as the player's own photo (R1-054); the review shows the player's words (R1-019).
  const viewerPrompt = prompt.trim();
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
                  activeMode === option && "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)]",
                )}
              >
                {option === "upload"
                  ? localizeUi("ui.slurp.messages.photoUpload", { defaultValue: "Upload" })
                  : localizeUi("ui.slurp.messages.photoGenerate", { defaultValue: "Draw it" })}
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
                placeholder={localizeUi("ui.slurp.messages.photoDescribe", {
                  defaultValue: "Describe the photo you took",
                })}
                className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm ring-1 ring-inset ring-[var(--noodle-divider)]"
              />
            )}
            {activeMode === "upload" && (
              // The whole button opens the picker; a bare file input only reacted on its "Choose file" text.
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
                <ImagePlus size={18} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 truncate">
                  {file?.name ?? localizeUi("ui.slurp.messages.photoChoose", { defaultValue: "Choose a photo" })}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
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
              className="min-h-10 self-end rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
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
                      ? file && send.mutateAsync({ threadId, creatorAccountId, personaId, file, content, asSupport })
                      : generate.mutateAsync({
                          threadId,
                          creatorAccountId,
                          personaId,
                          prompt: viewerPrompt,
                          content,
                          asSupport,
                        });
                  if (!request) return;
                  void request
                    .then((result) => {
                      setFile(null);
                      setPrompt("");
                      setContent("");
                      setReviewing(false);
                      onSent?.(result);
                    })
                    .catch((cause: unknown) => {
                      // The picture wait answers with the time it ends, so say when, not "later".
                      const retryAt =
                        cause instanceof ApiError && cause.status === 429
                          ? (cause.payload as { retryAt?: unknown } | undefined)?.retryAt
                          : undefined;
                      setError(
                        typeof retryAt === "string" && formatUpcomingClock(retryAt, i18n.language)
                          ? localizeUi("ui.slurp.messages.pictureWait", {
                              defaultValue: "Draw again at {{time}}",
                              time: formatUpcomingClock(retryAt, i18n.language),
                            })
                          : cause instanceof Error
                            ? cause.message
                            : "Could not send that picture.",
                      );
                    });
                }}
                className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] disabled:opacity-50"
              >
                {send.isPending || generate.isPending
                  ? localizeUi("ui.slurp.messages.photoSending", { defaultValue: "Sending…" })
                  : localizeUi("ui.slurp.messages.photoSend", { defaultValue: "Send photo" })}
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

const TIP_MAX = 9999;

/**
 * One tip, chosen once. Presets and a custom amount pick the same number, an optional note rides
 * along, and one button either sends it now or attaches it to the next message. The old panel had
 * two near-identical rows of amounts and every preset sent at a tap.
 */
export function SlurpTipPanel({
  personaId,
  busy,
  allowAttach,
  onSendNow,
  onAttach,
}: {
  personaId: string | null;
  busy: boolean;
  /** A Creator tipping from their own side has no "next message" to carry it. */
  allowAttach: boolean;
  /** `origin`: where the spend moment starts (the Send button, measured at the tap). */
  onSendNow: (amount: number, note: string, origin: DOMRect) => void;
  onAttach: (amount: number, note: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const wallet = useSlurpWallet(personaId);
  const [amount, setAmount] = useState<number>(TIP_PRESETS[1]);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [attach, setAttach] = useState(false);
  const balance = wallet.data?.coins;
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= TIP_MAX;
  const short = balance !== undefined && amount > balance;
  const withAttach = allowAttach && attach;
  const pick = (next: number) => {
    setAmount(Math.max(1, Math.min(TIP_MAX, Math.round(next))));
    setCustom("");
  };

  return (
    <div className="flex flex-col gap-3 px-1">
      {/* One way to pick the amount: the chips or Other. The old ± stepper and big number said it twice. */}
      {balance !== undefined && (
        <p
          aria-live="polite"
          className={cn("text-xs text-[var(--slurp-muted)]", short && "text-[var(--slurp-danger)]")}
        >
          {localizeUi("ui.slurp.messages.tipBalance", { defaultValue: "Balance" })} <SlurpCoinAmount amount={balance} />
        </p>
      )}

      <div
        role="group"
        aria-label={localizeUi("ui.slurp.messages.tipAmountLabel", { defaultValue: "Tip amount" })}
        className="flex flex-wrap items-center gap-1.5"
      >
        {TIP_PRESETS.map((preset) => (
          <SlpChip key={preset} selected={!custom && amount === preset} onClick={() => pick(preset)}>
            <SlurpCoinAmount amount={preset} />
          </SlpChip>
        ))}
        <label className="sr-only" htmlFor="slurp-tip-custom">
          {localizeUi("ui.slurp.messages.customTipAmount", { defaultValue: "Custom tip amount" })}
        </label>
        <input
          id="slurp-tip-custom"
          type="number"
          inputMode="numeric"
          min={1}
          max={TIP_MAX}
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            setAmount(Math.floor(Number(event.target.value)));
          }}
          placeholder={localizeUi("ui.slurp.messages.customTipPlaceholder", { defaultValue: "Other" })}
          className="h-11 w-24 rounded-full bg-[var(--slurp-surface)] px-4 text-base tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-[13px]"
        />
      </div>

      <label className="sr-only" htmlFor="slurp-tip-note">
        {localizeUi("ui.slurp.messages.customTipNote", { defaultValue: "Tip note" })}
      </label>
      <input
        id="slurp-tip-note"
        value={note}
        maxLength={280}
        onChange={(event) => setNote(event.target.value)}
        placeholder={localizeUi("ui.slurp.messages.tipNoteOptional", { defaultValue: "Add a note (optional)" })}
        className="h-11 rounded-full bg-[var(--slurp-surface)] px-4 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
      />

      {allowAttach && (
        <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 px-1 text-xs font-semibold">
          <span>
            {localizeUi("ui.slurp.messages.tipWithMessage", { defaultValue: "With my next message" })}
            <span className="block text-xs font-normal text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.messages.tipWithMessageHint", {
                defaultValue: "The tip goes with the next message you send.",
              })}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={attach}
            onChange={(event) => setAttach(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--noodle-divider)] transition-colors peer-checked:bg-[var(--noodle-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--slurp-focus)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5 motion-reduce:after:transition-none"
          />
        </label>
      )}

      <SlpPrimaryButton
        disabled={busy || !personaId || !valid || (short && !withAttach)}
        onClick={(event) =>
          withAttach
            ? onAttach(amount, note.trim())
            : onSendNow(amount, note.trim(), event.currentTarget.getBoundingClientRect())
        }
        className="w-full"
      >
        {short && !withAttach ? (
          localizeUi("ui.slurp.messages.tipNotEnough", { defaultValue: "Not enough coins" })
        ) : withAttach ? (
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.tipAttach", { defaultValue: "Attach {{amount}} <coin/>", amount })}
          </SlpCoinText>
        ) : (
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.tipSendNow", { defaultValue: "Send {{amount}} <coin/>", amount })}
          </SlpCoinText>
        )}
      </SlpPrimaryButton>
      <p className="text-center text-xs text-[var(--slurp-muted)]">
        {localizeUi("ui.slurp.messages.sendTipDetail", {
          defaultValue: "A gift, no strings. They reply if they feel like it.",
        })}
      </p>
    </div>
  );
}
