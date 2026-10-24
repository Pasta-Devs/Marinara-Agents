import { useTranslation } from "react-i18next";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useSlpCurrentLiveShow } from "./slp-live-hooks";
import { SLP_LIVE_STYLES } from "../../modules/live/slp-live-styles";

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
      className="relative mx-3 mt-3 flex min-h-16 w-[calc(100%-1.5rem)] items-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--noodle-accent)_22%,var(--card)),color-mix(in_srgb,var(--slurp-violet)_18%,var(--card)))] px-3 text-start ring-1 ring-[color-mix(in_srgb,var(--noodle-accent)_45%,transparent)] transition-transform active:scale-[0.98]"
    >
      <style>{SLP_LIVE_STYLES}</style>
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
      <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white shadow-[0_0_16px_rgb(220_38_38/0.55)]">
        <span className="slp-live-dot h-2 w-2 rounded-full bg-white" />
        {t("ui.slurp.live.badge")}
      </span>
    </button>
  );
}
