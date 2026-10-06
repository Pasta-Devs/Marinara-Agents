// Opening day's data: what it reads to fill its questions, and the one write at "Open the doors".
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useCreatorAccounts, useSlurpSpice, useSlurpSpiceMutations } from "../creators/slp-creators-contract";
import { useSlurpImageConnections, useUpdateSlurpImageConnections } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import { useSlurpPostGuidance, useUpdateSlurpPostGuidance } from "../settings/slp-post-guidance-contract";
import { slpSpiceStepOf } from "../../../../../shared/src/slp/slp-spice.js";
import type { SlpRailContext, SlpRailStamp } from "./slp-site-welcome";

const yes = (value: unknown) => value === true || value === "true";

/** The rail's context, or null while it loads. Spice falls back to the shipped limit if it fails. */
export function useSlpRailContext(opening: SlpRailContext["opening"], enabled = true): SlpRailContext | null {
  const settings = useSlurpSettings();
  const connections = useSlurpConnections(enabled);
  const images = useSlurpImageConnections(enabled);
  const spice = useSlurpSpice();
  const guidance = useSlurpPostGuidance(enabled);
  const creators = useCreatorAccounts();
  if (!settings.data || !connections.data || images.isPending || spice.isPending || guidance.isPending) return null;
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
    // The Slurp-wide default level; unset falls back to the shipped level, then to the limit.
    spice:
      slpSpiceStepOf(guidance.data?.defaults.level || guidance.data?.builtInLevel) ??
      spice.data?.spice.max ??
      "suggestive",
  };
}

/** "Open the doors": the spice (limit, language, default level), then the settings patch, then the image default. */
export function useSlpRailWrite() {
  const update = useUpdateSlurpSettings();
  const spice = useSlurpSpiceMutations();
  const guidance = useUpdateSlurpPostGuidance();
  const images = useUpdateSlurpImageConnections();
  return {
    pending: update.isPending || spice.patch.isPending || guidance.isPending || images.isPending,
    write: async (stamp: SlpRailStamp, imageConnectionAnswered: boolean) => {
      // Spice first and "completed" last: a failed write leaves the doors shut, never an opened
      // Slurp whose spice is still the old one.
      if (stamp.spice) {
        await spice.patch.mutateAsync({ max: stamp.spice.max, language: stamp.spice.language });
        await guidance.mutateAsync({ level: stamp.spice.level });
      }
      await update.mutateAsync({ ...stamp.settings, onboarding: "completed" });
      // The pictures of every Creator signed up next, whichever way they sign up.
      if (imageConnectionAnswered && stamp.signUp.imageConnectionId) {
        await images.mutateAsync({ defaultConnectionId: stamp.signUp.imageConnectionId });
      }
    },
  };
}
