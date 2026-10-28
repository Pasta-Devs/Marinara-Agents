import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client";
import type { SlpMessageDeepDetailsResponse } from "../../../../../shared/src/slp/slp-deep-details.js";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpTimestamp } from "../../base/ui/SlpTimestamp";
import { SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { PromptMessage, SlpDeepDetailsFrame } from "../../modules/post/SlpDeepDetailsModal";
import { Block, CopyButton, Rows, Section } from "../../modules/post/SlpDeepDetailsParts";
import { messageKeys } from "./slp-message-keys";

/**
 * Deep details for one Creator reply, in the window a post's Deep details use: the chat facts the
 * reply was built from, the model, the literal prompt and the raw answer. Everything shown was
 * recorded when the reply was written; nothing is filled in from today's chat.
 */
export function SlpMessageDeepDetails({
  messageId,
  personaId,
  onClose,
}: {
  messageId: string;
  personaId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [...messageKeys.root(), "deep-details", messageId, personaId],
    queryFn: () =>
      api.get<SlpMessageDeepDetailsResponse>(
        `/slurp2/slurp/messages/${encodeURIComponent(messageId)}/deep-details?personaId=${encodeURIComponent(personaId)}`,
      ),
  });
  const data = query.data;
  const details = data?.details ?? null;
  const chat = details?.chat;
  return (
    <SlpDeepDetailsFrame open onClose={onClose}>
      {query.isPending ? (
        <SlpSkeleton
          shape="rows"
          count={5}
          waitText={
            query.failureCount > 0 ? t("ui.slurp.deepDetails.retrying", { defaultValue: "Retrying…" }) : undefined
          }
        />
      ) : query.isError || !data ? (
        <SlpErrorState
          title={t("ui.slurp.deepDetails.messageLoadError", {
            defaultValue: "Could not load this message's details.",
          })}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <div className="space-y-4 text-sm">
          <header className="space-y-1">
            <p className={`${SLP_TYPE.meta} text-[var(--slurp-muted)]`}>
              {data.creator.displayName} · @{data.creator.handle} ·{" "}
              <SlpTimestamp value={data.message.createdAt} tappable />
            </p>
            <h3 className={`${SLP_TYPE.title} line-clamp-3 text-balance`}>{data.message.content}</h3>
            {details && <p className={`${SLP_TYPE.meta} text-[var(--slurp-muted)]`}>{details.model.model}</p>}
          </header>

          {!details || !chat ? (
            <p className={`${SLP_TYPE.meta} text-[var(--slurp-muted)]`}>
              {t("ui.slurp.deepDetails.messageNotRecorded", {
                defaultValue:
                  "Slurp no longer keeps the details of this message. It keeps them for the newest replies.",
              })}
            </p>
          ) : (
            <>
              <div className="flex justify-end">
                <CopyButton
                  value={JSON.stringify(data, null, 2)}
                  label={t("ui.slurp.deepDetails.copyAll", { defaultValue: "Copy all as JSON" })}
                />
              </div>

              <Section title="Why this reply" step={1}>
                <Rows
                  rows={[
                    ["Relationship", `${chat.rapport.tier} (${chat.rapport.score})`],
                    ["Subscribed", chat.subscribed ? "yes" : "no"],
                    ["Message request", chat.request ? "yes" : null],
                    ["Direction", chat.direction],
                    ["Stance", chat.stance ? `${chat.stance.warmth} · ${chat.stance.latitude}` : null],
                    ["Pictures", chat.stance ? chat.stance.imageMode : null],
                    ["Posture", chat.relationship?.posture ?? null],
                    ["Heat", chat.relationship?.adultLevel ?? null],
                    ["Feeling", chat.creator?.emotion ?? null],
                    ["Intent", chat.creator?.intent ?? null],
                  ]}
                />
                {chat.stance && chat.stance.evidence.length > 0 && (
                  <div className="mt-3">
                    <Rows
                      rows={chat.stance.evidence.map((entry) => [
                        entry.layer.charAt(0).toUpperCase() + entry.layer.slice(1),
                        `${entry.value}: ${entry.effect}`,
                      ])}
                    />
                  </div>
                )}
              </Section>

              <Section title="Memories" step={2}>
                {chat.memories.length > 0 ? (
                  <Rows rows={chat.memories.map((memory, index) => [`${index + 1} · ${memory.tier}`, memory.text])} />
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)]">None yet when this reply was written.</p>
                )}
              </Section>

              {chat.lore && (
                <Section title="Lore" step={3}>
                  {!chat.lore.enabled ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Lorebook context is off in Settings, so no lorebook was read.
                    </p>
                  ) : chat.lore.included.length + chat.lore.skipped.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No entry matched. Entries need the Slurp generation trigger, and a book bound to this Creator's
                      character or persona, or a global one.
                    </p>
                  ) : (
                    <Rows
                      rows={[
                        ...chat.lore.included.map((entry, index): [string, string] => [
                          `${index + 1} · used`,
                          entry.book ? `${entry.name} · ${entry.book}` : entry.name,
                        ]),
                        ...chat.lore.skipped.map((entry, index): [string, string] => [
                          `${index + 1} · no room`,
                          entry.book ? `${entry.name} · ${entry.book}` : entry.name,
                        ]),
                      ]}
                    />
                  )}
                </Section>
              )}

              <Section title="Writing model" step={chat.lore ? 4 : 3}>
                <Rows
                  rows={[
                    ["Provider", details.model.provider],
                    ["Model", details.model.model],
                    ["Connection", details.model.connectionName ?? null],
                    ["Temperature", details.model.temperature?.toString() ?? null],
                    ["Top P", details.model.topP?.toString() ?? null],
                    ["Max tokens", details.model.maxTokens?.toString() ?? null],
                  ]}
                />
              </Section>

              <Section
                title="Writing prompt"
                step={chat.lore ? 5 : 4}
                action={
                  <CopyButton
                    value={details.messages.map((m) => `# ${m.role}\n${m.content}`).join("\n\n")}
                    label="Copy prompt"
                  />
                }
              >
                <div className="space-y-3">
                  {details.messages.map((message, index) => (
                    <PromptMessage key={index} role={message.role} content={message.content} />
                  ))}
                </div>
              </Section>

              <Section title="The answer" step={chat.lore ? 6 : 5}>
                <Block label="Raw response" text={details.rawResponse} />
              </Section>
            </>
          )}
        </div>
      )}
    </SlpDeepDetailsFrame>
  );
}
