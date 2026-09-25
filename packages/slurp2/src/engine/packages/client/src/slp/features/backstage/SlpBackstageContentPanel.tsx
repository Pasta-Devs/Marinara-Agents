import { BookOpen, CalendarDays, PackageOpen, Sparkles, Workflow } from "lucide-react";

import { BackstagePageHeader, SummaryRow } from "../../modules/settings/SlpSettingsKit";
import type { SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import type { SlpBackstagePageProps } from "./slp-backstage-contract";

export function SlpBackstageContentPanel(page: SlpBackstagePageProps) {
  const { t, settings } = page;
  const go = (target: SlpBackstageTarget) => page.onNavigate({ ...page.navigation, section: "content", target });
  const rows: Array<{ target: SlpBackstageTarget; icon: React.ReactNode; title: string; detail: string }> = [
    {
      target: "storylines",
      icon: <Workflow size={19} aria-hidden="true" />,
      title: "Storylines",
      detail: "Whether events and storylines start by themselves, how storylines behave, and shared ideas.",
    },
    {
      target: "calendar",
      icon: <CalendarDays size={19} aria-hidden="true" />,
      title: "Calendar",
      detail: "View events, active storylines, and recent activity.",
    },
    {
      target: "events",
      icon: <Sparkles size={19} aria-hidden="true" />,
      title: "Events",
      detail: "Manage holidays, special dates, and platform events.",
    },
    {
      target: "arcs",
      icon: <BookOpen size={19} aria-hidden="true" />,
      title: "Storyline types",
      detail: "Edit reusable storyline types. Running storylines keep their own copy.",
    },
    {
      target: "packs",
      icon: <PackageOpen size={19} aria-hidden="true" />,
      title: "Packs",
      detail: "Import and export optional collections of Events and Storyline types.",
    },
  ];

  return (
    <div className="space-y-4">
      <BackstagePageHeader
        title={t("ui.slurp.settings.backstage.sections.content", { defaultValue: "Content" })}
        detail="Manage reusable content separately from the rules that control how Slurp runs it."
        scope="all-slurp"
      />
      {rows.map((row) => (
        <SummaryRow
          key={row.target}
          icon={row.icon}
          title={row.title}
          status={
            row.target === "arcs"
              ? String(settings.arcLibrary.length)
              : row.target === "events"
                ? String(settings.platformEvents.length)
                : "Open"
          }
          tone="info"
          value={row.detail}
          onOpen={() => go(row.target)}
        />
      ))}
    </div>
  );
}
