import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LtmNote } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "../api";
import { useLtmTranslation } from "../localization";
import { Button, lockedActionProps } from "../shared-controls";
import { describeStoryJump } from "../story-dates";

/**
 * The time jumps Find story dates stored for a chat piece. Each can be removed: the jump is dropped from the piece and
 * the days it counted go with it. Nothing shows for a piece without jumps. Recall counts them only while the piece's
 * text is unchanged since the check.
 */
export function StoryJumps({
  noteId,
  disabled,
  lockReasonId,
}: {
  noteId: string;
  disabled: boolean;
  lockReasonId?: string;
}) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  // Under `notes`, so a Find story dates apply or a re-extraction refreshes the list.
  const queryKey = [...queryKeys.notes, "story-jumps", noteId] as const;
  const note = useQuery({
    queryKey,
    queryFn: () => request<LtmNote>(`/notes/${encodeURIComponent(noteId)}`),
    retry: false,
  });
  const jumps = note.data?.storyTimeScan?.jumps ?? [];
  if (!jumps.length) return null;
  const locked = disabled || removing;
  const remove = async (index: number, quote: string) => {
    if (locked) return;
    setRemoving(true);
    try {
      await request<unknown, { removeStoryTimeJump: { index: number; quote: string } }>(
        `/notes/${encodeURIComponent(noteId)}`,
        "PATCH",
        { removeStoryTimeJump: { index, quote } },
      );
      toast.success(localizeUi("ui.longTermMemory.sourcesworkspace.storyJumpRemoved"));
    } catch (error) {
      // The jumps changed since they were shown: the reload below shows the current list.
      toast.error(
        (error as { status?: number }).status === 409
          ? localizeUi("ui.longTermMemory.sourcesworkspace.storyJumpChanged")
          : errorMessage(error, localizeUi("ui.longTermMemory.sourcesworkspace.storyJumpFailed")),
      );
    } finally {
      // The jump is already gone when this fails, so a failed reload must not turn that into an error.
      await invalidateLtmQueries(queryClient, [queryKeys.notes, queryKeys.status]).catch(() => undefined);
      setRemoving(false);
    }
  };
  return (
    <div className="space-y-2" data-ltm-story-jumps>
      <p className="text-xs font-semibold text-[var(--marinara-editor-accent)]">
        {localizeUi("ui.longTermMemory.sourcesworkspace.storyJumps")}
      </p>
      <ul className="space-y-2">
        {jumps.map((jump, index) => (
          <li key={`${index}:${jump.quote}`} data-ltm-story-jump className="flex items-start gap-2">
            <span className="min-w-0 flex-1 break-words text-xs text-[var(--muted-foreground)]">
              {describeStoryJump(jump, null, locale, localizeUi)}
            </span>
            <Button
              data-ltm-story-jump-remove
              aria-label={`${localizeUi("ui.longTermMemory.sourcesworkspace.storyJumpRemove")}: ${jump.quote}`}
              {...lockedActionProps(locked, lockReasonId)}
              onClick={() => void remove(index, jump.quote)}
            >
              {localizeUi("ui.longTermMemory.sourcesworkspace.storyJumpRemove")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
