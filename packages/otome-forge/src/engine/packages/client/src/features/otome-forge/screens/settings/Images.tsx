// ──────────────────────────────────────────────
// Otome Forge Settings → Images: the story's image connection (or none: the game is fully playable without one), its
// rating (above SFW needs the 18+ confirmation), its image style and image prompt style (the Engine profile), "Ask
// before painting", expressions and (0.20.0) side character sprites, off by default, with what they cost.
// ──────────────────────────────────────────────
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgeGate } from "../../components/AgeGateDialog";
import { CostHint } from "../../components/CostHint";
import { RetryNotice } from "../../components/RetryNotice";
import { useConnections } from "../../hooks/use-engine-resources";
import { useSaveSettings, type SaveSettings } from "../../hooks/use-run";
import type { ImageSettings, RunView } from "../../shared/api-types";
import { ImageControls } from "../setup/ConnectionsStep";
import { ImageRatingControl } from "../setup/ContentStep";
import { Section, Switch } from "../setup/parts";
import { NoStory, SaveBar, storedKey } from "./ContentSettings";

type ImageForm = Pick<ImageSettings, "connectionId" | "rating" | "ask" | "expressions"> & {
  style: string;
  styleProfileId: string;
  sideSprites: boolean;
};

const toForm = ({
  connectionId,
  rating,
  ask,
  expressions,
  style,
  styleProfileId,
  sideSprites,
}: ImageSettings): ImageForm => ({
  connectionId,
  rating,
  ask,
  expressions,
  style: style ?? "",
  styleProfileId: styleProfileId ?? "",
  sideSprites: sideSprites === true,
});

function StoryImages({ run, settings }: { run: RunView; settings: SaveSettings }) {
  const { t } = useTranslation();
  const gate = useAgeGate();
  const connections = useConnections();
  const [form, setForm] = useState(() => toForm(run.world.images));
  const changed = JSON.stringify(form) !== JSON.stringify(toForm(run.world.images));
  return (
    <>
      <Section title={t("ui.otomeForge.setup.imageConnections")}>
        {connections.isLoading ? (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.setup.loadingConnections")}
          </p>
        ) : connections.isError && connections.image.length === 0 ? (
          <RetryNotice
            message={t("ui.otomeForge.setup.connectionsFailed")}
            onRetry={() => void connections.refetch()}
            retrying={connections.retrying}
          />
        ) : (
          <ImageControls
            value={form}
            connections={connections.image}
            lis={run.lis.length}
            onChange={(value) => setForm((current) => ({ ...current, ...value }))}
          />
        )}
        {form.connectionId ? (
          <Switch
            label={t("ui.otomeForge.settings.sideSprites")}
            hint={
              <>
                {t("ui.otomeForge.settings.sideSpritesHint")}
                <CostHint images={1} note={t("ui.otomeForge.settings.sideSpritesCostNote")} />
              </>
            }
            checked={form.sideSprites}
            onChange={(sideSprites) => setForm((current) => ({ ...current, sideSprites }))}
          />
        ) : null}
      </Section>
      <ImageRatingControl
        rating={form.rating}
        gate={gate}
        onChange={(rating) => setForm((current) => ({ ...current, rating }))}
      />
      <p className="of-hint">{t("ui.otomeForge.settings.imagesGallery")}</p>
      <p className="of-hint">{t("ui.otomeForge.images.paintLater")}</p>
      <SaveBar
        changed={changed}
        busy={settings.busy}
        status={settings.status}
        onSave={() => void settings.save({ images: form }, t("ui.otomeForge.settings.saved"))}
      />
      {gate.dialog}
    </>
  );
}

export function ImagesSettings({ run }: { run: RunView | null }) {
  const settings = useSaveSettings(run?.runKey ?? null);
  return (
    <div className="of-step-body">
      {run ? <StoryImages key={storedKey(run.runKey, run.world.images)} run={run} settings={settings} /> : <NoStory />}
    </div>
  );
}
