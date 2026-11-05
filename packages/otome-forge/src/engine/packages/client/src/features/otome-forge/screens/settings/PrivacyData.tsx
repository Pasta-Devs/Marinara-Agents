// ──────────────────────────────────────────────
// Otome Forge Settings → Privacy & data: where everything lives, in plain words (plan §1.9), and clearing what this
// device keeps: the setup draft, and every bit of the period tracker (Delete all cycle data, as on the Tracker tab)
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  Eraser,
  Flower2,
  Globe,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { LOOK_STORAGE_KEY } from "../../hooks/use-look";
import { CARE_NOTE_STORAGE_KEY, CYCLE_STORAGE_KEY, PROFILE_STORAGE_KEY } from "../../lib/cycle-storage";
import { clearDraft, hasDraft, SETUP_DRAFT_KEY } from "../setup/draft";
import { Section } from "../setup/parts";
import { DeleteCycleData } from "./Tracker";

const STATEMENTS: readonly { key: string; Icon: LucideIcon }[] = [
  { key: "ui.otomeForge.settings.privacyDocuments", Icon: Database },
  { key: "ui.otomeForge.settings.privacyBackups", Icon: Database },
  { key: "ui.otomeForge.settings.privacyShared", Icon: ShieldCheck },
  { key: "ui.otomeForge.settings.privacyProviders", Icon: Globe },
  { key: "ui.otomeForge.settings.privacyBrowser", Icon: MonitorSmartphone },
  { key: "ui.otomeForge.settings.privacyTracker", Icon: Flower2 },
  { key: "ui.otomeForge.settings.privacySafari", Icon: MonitorSmartphone },
  { key: "ui.otomeForge.settings.privacyAdminSecret", Icon: KeyRound },
  { key: "ui.otomeForge.settings.privacyGate", Icon: ShieldCheck },
];

export function PrivacyData() {
  const { t } = useTranslation();
  const [draftKept, setDraftKept] = useState(hasDraft);
  return (
    <div className="of-step-body">
      <Section title={t("ui.otomeForge.settings.privacyWhere")}>
        <ul className="of-statements">
          {STATEMENTS.map(({ key, Icon }) => (
            <li key={key}>
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t("ui.otomeForge.settings.privacyDevice")}>
        <p className="of-body">
          {t("ui.otomeForge.settings.privacyDeviceKeys", {
            look: LOOK_STORAGE_KEY,
            draft: SETUP_DRAFT_KEY,
            cycle: CYCLE_STORAGE_KEY,
            care: CARE_NOTE_STORAGE_KEY,
            profile: PROFILE_STORAGE_KEY,
          })}
        </p>
        <button
          type="button"
          className="of-button of-button--quiet of-glass of-button--small"
          aria-disabled={!draftKept}
          onClick={() => {
            if (!draftKept) return;
            clearDraft();
            setDraftKept(false);
          }}
        >
          <Eraser size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.settings.clearDraft")}
        </button>
        <p className="of-hint" role="status" aria-live="polite">
          {draftKept ? t("ui.otomeForge.settings.draftKept") : t("ui.otomeForge.settings.noDraft")}
        </p>
        <DeleteCycleData />
      </Section>
      <p className="of-hint">{t("ui.otomeForge.settings.privacyDelete")}</p>
    </div>
  );
}
