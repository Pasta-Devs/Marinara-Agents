// ──────────────────────────────────────────────
// Story Writer sidebar: the quick replies, shared by every story
// ──────────────────────────────────────────────
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import type { PreferencesUpdate } from "../../../hooks/use-story-writer";
import { LIMITS, type QuickReply, type StoryWriterPreferences } from "../../../lib/story-writer/model";
import { createClientId } from "../../../lib/story-writer/prompt";
import { EntryText, Toggle } from "./fields";

export function QuickRepliesSection(props: { preferences: StoryWriterPreferences; onChange: PreferencesUpdate }) {
  const { t } = useTranslation();
  const id = useId();
  const { preferences, onChange } = props;
  const replies = preferences.quickReplies;
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const replace = (next: QuickReply[], debounce = false) => onChange({ quickReplies: next }, { debounce });
  const edit = (replyId: string, patch: Partial<QuickReply>) =>
    replace(
      replies.map((reply) => (reply.id === replyId ? { ...reply, ...patch } : reply)),
      true,
    );
  const full = replies.length >= LIMITS.quickReplies;
  const add = () => {
    if (!text.trim()) return;
    replace([...replies, { id: createClientId("reply"), label: label.trim(), text: text.trim() }]);
    setLabel("");
    setText("");
  };
  return (
    <>
      <Toggle
        label={t("quickReplies.show")}
        hint={t("quickReplies.showHint")}
        checked={preferences.showQuickReplies}
        onChange={(showQuickReplies) => onChange({ showQuickReplies })}
      />
      {replies.length === 0 ? (
        <p className="sw-empty">{t("quickReplies.empty")}</p>
      ) : (
        <ol className="sw-quick-list">
          {replies.map((reply, index) => (
            <li key={reply.id} className="sw-quick-item">
              <EntryText
                value={reply.label}
                label={t("quickReplies.replyLabel", { number: index + 1 })}
                placeholder={t("quickReplies.labelPlaceholder")}
                maxLength={LIMITS.quickReplyLabel}
                optional
                onChange={(next) => edit(reply.id, { label: next })}
              />
              <button
                type="button"
                className="sw-icon-button"
                data-variant="danger"
                aria-label={t("quickReplies.delete", { number: index + 1 })}
                title={t("quickReplies.delete", { number: index + 1 })}
                onClick={() => replace(replies.filter((item) => item.id !== reply.id))}
              >
                <X size={15} aria-hidden="true" />
              </button>
              <EntryText
                value={reply.text}
                label={t("quickReplies.replyText", { number: index + 1 })}
                maxLength={LIMITS.shortText}
                multiline
                onChange={(next) => edit(reply.id, { text: next })}
              />
            </li>
          ))}
        </ol>
      )}
      {full ? null : (
        <form
          className="sw-quick-add"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label className="sw-label" htmlFor={`${id}-label`}>
            {t("quickReplies.labelField")}
          </label>
          <input
            id={`${id}-label`}
            type="text"
            className="sw-input"
            value={label}
            maxLength={LIMITS.quickReplyLabel}
            placeholder={t("quickReplies.labelPlaceholder")}
            onChange={(event) => setLabel(event.target.value)}
          />
          <label className="sw-label" htmlFor={`${id}-text`}>
            {t("quickReplies.text")}
          </label>
          <textarea
            id={`${id}-text`}
            className="sw-textarea"
            rows={2}
            value={text}
            maxLength={LIMITS.shortText}
            placeholder={t("quickReplies.textPlaceholder")}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="sw-button-row">
            <button type="submit" className="sw-button" disabled={!text.trim()}>
              <Plus size={15} aria-hidden="true" />
              {t("quickReplies.add")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
