import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LtmNote, LtmStoryTime } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, queryKeys, request } from "../api";
import { useLtmTranslation } from "../localization";
import { Button, inputClass, lockedActionProps } from "../shared-controls";
import { STORY_DATE_SOURCE_KEYS } from "../story-dates";

/** GET /notes/:id/story-date: the date text, where it came from, and the date the user typed on this memory, if any. */
type StoryDateResponse = {
  text?: string;
  end?: string;
  source: string;
  evidence?: string;
  asOf?: true;
  typed?: LtmStoryTime;
};
type StoryDateChange = { note: LtmNote; rebuild?: { status: "complete" | "deferred"; error?: string } };

const STORY_DATE_MAX_LENGTH = 120;
// The server refuses a date that starts or ends with spaces or spans lines.
const normalizeStoryDate = (value: string) => value.replace(/\s+/g, " ").trim();

/**
 * The story date a memory shows in the Vault, with where it came from, and the way to type one of your own. A typed
 * date is saved at once, separately from the rest of the editor; `onSaved` gets the saved memory so the editor can
 * keep its unsaved edits.
 */
export function StoryDateLine({
  noteId,
  vaultBusy,
  onSaved,
}: {
  noteId: string;
  vaultBusy: boolean;
  onSaved: (note: LtmNote) => Promise<void> | void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<"save" | "clear" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const story = useQuery({
    queryKey: queryKeys.storyDate(noteId),
    queryFn: () => request<StoryDateResponse>(`/notes/${encodeURIComponent(noteId)}/story-date`),
    retry: false,
  });
  const data = story.data;
  const locked = vaultBusy || pending !== null;
  const lock = lockedActionProps(locked);
  const next = normalizeStoryDate(value);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  const stopEditing = () => {
    returnFocus.current = true;
    setEditing(false);
  };
  const change = async (storyTime: LtmStoryTime | null) => {
    if (locked) return;
    setPending(storyTime ? "save" : "clear");
    try {
      const response = await request<StoryDateChange, { storyTime: typeof storyTime }>(
        `/notes/${encodeURIComponent(noteId)}`,
        "PATCH",
        { storyTime },
      );
      // Clear can run outside the editor; its button then goes, so focus moves to Edit.
      if (editing) stopEditing();
      else editRef.current?.focus();
      // The date is saved, so a failed reload must not turn that into an error.
      await Promise.resolve(onSaved(response.note)).catch(() => undefined);
      if (response.rebuild?.status === "deferred") {
        const error = response.rebuild.error;
        toast.warning(
          error
            ? localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStale", { error })
            : localizeUi("ui.longTermMemory.memoryvault.savedButRecallIsStaleNoError"),
          { duration: 12_000 },
        );
      } else {
        toast.success(
          storyTime
            ? localizeUi("ui.longTermMemory.memoryvault.storyDateSaved")
            : localizeUi("ui.longTermMemory.memoryvault.storyDateCleared"),
        );
      }
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.memoryvault.storyDateFailed")));
    } finally {
      setPending(null);
    }
  };
  const save = () => {
    // Only the date text is edited, so a typed time and end are kept.
    const typed = data?.typed;
    if (next)
      void change({
        start: { ...typed?.start, date: next },
        ...(typed?.end ? { end: typed.end } : {}),
        origin: "manual",
      });
  };

  if (story.isError)
    return (
      <p data-ltm-story-date-error className="break-words">
        {localizeUi("ui.longTermMemory.memoryvault.storyDateLoadFailed")}
      </p>
    );
  if (!data) return null;

  const dateText = data.text
    ? data.end
      ? localizeUi("ui.longTermMemory.storyDates.range", { start: data.text, end: data.end })
      : data.text
    : "";
  const sourceText =
    data.source === "stated" && data.evidence
      ? localizeUi("ui.longTermMemory.memoryvault.storyDateFound", { quote: data.evidence })
      : localizeUi(STORY_DATE_SOURCE_KEYS[data.source] ?? STORY_DATE_SOURCE_KEYS.unknown!);

  return (
    <div data-ltm-story-date className="space-y-2">
      {dateText ? (
        <p data-ltm-story-date-text className="break-words">
          {data.asOf ? localizeUi("ui.longTermMemory.memoryvault.storyDateAsOf", { date: dateText }) : dateText}
          {" · "}
          <span data-ltm-story-date-source={data.source}>{sourceText}</span>
        </p>
      ) : (
        <p data-ltm-story-date-text data-ltm-story-date-source="unknown" className="break-words">
          {localizeUi(STORY_DATE_SOURCE_KEYS.unknown!)}
        </p>
      )}
      {editing ? (
        <div data-ltm-story-date-editor className="space-y-2">
          <label className="block space-y-1">
            <span className="font-medium text-[var(--foreground)]">
              {localizeUi("ui.longTermMemory.memoryvault.storyDateField")}
            </span>
            <input
              ref={inputRef}
              data-ltm-story-date-input
              className={inputClass}
              value={value}
              maxLength={STORY_DATE_MAX_LENGTH}
              placeholder={localizeUi("ui.longTermMemory.memoryvault.storyDatePlaceholder")}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                } else if (event.key === "Escape" && !locked) {
                  event.preventDefault();
                  event.stopPropagation();
                  stopEditing();
                }
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button primary data-ltm-story-date-save disabled={!next} onClick={save} {...lock}>
              {localizeUi("ui.longTermMemory.memoryvault.save")}
            </Button>
            <Button
              data-ltm-story-date-cancel
              onClick={() => {
                if (!locked) stopEditing();
              }}
              {...lock}
            >
              {localizeUi("ui.longTermMemory.memoryvault.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            ref={editRef}
            data-ltm-story-date-edit
            onClick={() => {
              if (locked) return;
              setValue(data.typed?.start.date ?? "");
              setEditing(true);
            }}
            {...lock}
          >
            {localizeUi("ui.longTermMemory.memoryvault.storyDateEdit")}
          </Button>
          {data.typed ? (
            <Button data-ltm-story-date-clear onClick={() => void change(null)} {...lock}>
              {localizeUi("ui.longTermMemory.memoryvault.storyDateClear")}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
