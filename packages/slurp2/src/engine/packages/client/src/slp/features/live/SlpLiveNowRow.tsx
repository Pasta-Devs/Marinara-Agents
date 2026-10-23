import { useTranslation } from "react-i18next";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlpCurrentLiveShow } from "./slp-live-hooks";

export function SlpLiveNowRow({
  creators,
  onOpen,
}: {
  creators?: Array<{ profile: { id: string; displayName: string; avatarUrl?: string | null } }>;
  onOpen?: (showId: string) => void;
}) {
  const { t } = useTranslation();
  const query = useSlpCurrentLiveShow(true);
  const show = query.data;
  if (!show || show.endedAt) return null;
  const host = creators?.find((creator) => creator.profile.id === show.hostId)?.profile;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(show.id)}
      className="mx-3 mt-3 flex min-h-16 items-center gap-3 rounded-lg border border-[var(--border)] px-3 text-start"
    >
      <Avatar
        account={{ displayName: host?.displayName ?? t("ui.slurp.live.creator"), avatarUrl: host?.avatarUrl ?? null }}
        size="md"
      />
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{t("ui.slurp.live.liveNow")}</b>
        <span className="block truncate text-xs text-[var(--muted-foreground)]">
          {host?.displayName ??
            (show.hostKind === "player" ? t("ui.slurp.live.playerHost") : t("ui.slurp.live.creator"))}
        </span>
      </span>
      <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">{t("ui.slurp.live.badge")}</span>
    </button>
  );
}
