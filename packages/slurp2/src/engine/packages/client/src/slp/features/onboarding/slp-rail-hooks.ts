// The Support rail's data: what it reads to fill its questions, and the one write at "Stamp it".
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { SLURP_GUIDANCE_PRESETS } from "../../modules/settings/slp-backstage-format";
import { useCreatorAccounts, useSlurpSpice, useSlurpSpiceMutations } from "../creators/slp-creators-contract";
import { useSlurpImageConnections, useUpdateSlurpImageConnections } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import type { SlpRailContext, SlpRailStamp } from "./slp-site-welcome";

const yes = (value: unknown) => value === true || value === "true";

/** The rail's context, or null while it loads. Spice falls back to the shipped limit if it fails. */
export function useSlpRailContext(opening: SlpRailContext["opening"], enabled = true): SlpRailContext | null {
  const settings = useSlurpSettings();
  const connections = useSlurpConnections(enabled);
  const images = useSlurpImageConnections(enabled);
  const spice = useSlurpSpice();
  const creators = useCreatorAccounts();
  if (!settings.data || !connections.data || images.isPending || spice.isPending) return null;
  const all = connections.data;
  const imageDefault = images.data?.defaultConnectionId ?? null;
  return {
    opening,
    textConnections: all
      .filter((connection) => connection.provider !== "image_generation")
      .map((connection) => ({
        id: connection.id,
        name: connection.name || connection.model || connection.id,
        isDefault: yes(connection.defaultForAgents),
      })),
    imageConnections: all
      .filter((connection) => connection.provider === "image_generation")
      .map((connection) => ({
        id: connection.id,
        name: connection.name || connection.model || connection.id,
        // Slurp's own image default first, else the Engine's default.
        isDefault: imageDefault ? connection.id === imageDefault : yes(connection.isDefault),
      })),
    runsCreators: (creators.data?.length ?? 0) > 0,
    settings: settings.data,
    spice: spice.data?.spice.max ?? "explicit",
  };
}

/** "Stamp it": the spice limit, then the settings patch with the guidance preset, then the image default. */
export function useSlpRailWrite() {
  const update = useUpdateSlurpSettings();
  const spice = useSlurpSpiceMutations();
  const images = useUpdateSlurpImageConnections();
  return {
    pending: update.isPending || spice.patch.isPending || images.isPending,
    write: async (stamp: SlpRailStamp, imageConnectionAnswered: boolean) => {
      // Spice first and "completed" last: a failed write leaves the ticket open, never a stamped
      // ticket whose spice limit is still the old one.
      if (stamp.spice) await spice.patch.mutateAsync({ max: stamp.spice.max });
      await update.mutateAsync({
        ...stamp.settings,
        ...(stamp.spice ? { generationGuidance: SLURP_GUIDANCE_PRESETS[stamp.spice.guidance] } : {}),
        onboarding: "completed",
      });
      // The pictures of every Creator signed up next, whichever way they sign up.
      if (imageConnectionAnswered && stamp.signUp.imageConnectionId) {
        await images.mutateAsync({ defaultConnectionId: stamp.signUp.imageConnectionId });
      }
    },
  };
}
