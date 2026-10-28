// The Basic screen's data: what it reads to fill its questions, and the write when the player leaves it.
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import { useSlurpSpice, useSlurpSpiceMutations } from "../creators/slp-creators-contract";
import { useSlurpImageConnections, useUpdateSlurpImageConnections } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import { useSlurpPostGuidance, useUpdateSlurpPostGuidance } from "../settings/slp-post-guidance-contract";
import { slpSpiceStepOf } from "../../../../../shared/src/slp/slp-spice.js";
import type { SlpBasicContext, SlpBasicStamp } from "./slp-basic-setup";

const yes = (value: unknown) => value === true || value === "true";

/** The Basic screen's context, or null while it loads. */
export function useSlpBasicContext(firstRun: boolean, enabled = true): SlpBasicContext | null {
  const settings = useSlurpSettings();
  const connections = useSlurpConnections(enabled);
  const images = useSlurpImageConnections(enabled);
  const spice = useSlurpSpice();
  const guidance = useSlurpPostGuidance(enabled);
  if (!settings.data || !connections.data || images.isPending || spice.isPending || guidance.isPending) return null;
  const all = connections.data;
  const imageDefault = images.data?.defaultConnectionId ?? null;
  const named = (connection: (typeof all)[number]) => connection.name || connection.model || connection.id;
  return {
    firstRun,
    settings: settings.data,
    textConnections: all
      .filter((connection) => connection.provider !== "image_generation")
      .map((connection) => ({
        id: connection.id,
        name: named(connection),
        isDefault: yes(connection.defaultForAgents),
      })),
    imageConnections: all
      .filter((connection) => connection.provider === "image_generation")
      .map((connection) => ({
        id: connection.id,
        name: named(connection),
        // Slurp's own image default first, else the Engine's default.
        isDefault: imageDefault ? connection.id === imageDefault : yes(connection.isDefault),
      })),
    // The Slurp-wide default level; unset falls back to the shipped level, then to the limit.
    heat:
      slpSpiceStepOf(guidance.data?.defaults.level || guidance.data?.builtInLevel) ??
      spice.data?.spice.max ??
      "suggestive",
  };
}

/**
 * Leaving the Basic screen: the heat (limit, words, default level), then the settings, then the image
 * default. Before the Creator step, because a sign-up already uses the heat limit and the connection.
 * Never `onboarding`: the caller writes `completed` last.
 */
export function useSlpBasicWrite() {
  const update = useUpdateSlurpSettings();
  const spice = useSlurpSpiceMutations();
  const guidance = useUpdateSlurpPostGuidance();
  const images = useUpdateSlurpImageConnections();
  return {
    pending: update.isPending || spice.patch.isPending || guidance.isPending || images.isPending,
    write: async (stamp: SlpBasicStamp) => {
      if (stamp.heat) {
        await spice.patch.mutateAsync({ max: stamp.heat.max, language: stamp.heat.language });
        await guidance.mutateAsync({ level: stamp.heat.level });
      }
      if (Object.keys(stamp.settings).length > 0) await update.mutateAsync(stamp.settings);
      if (stamp.imageConnectionId) await images.mutateAsync({ defaultConnectionId: stamp.imageConnectionId });
    },
  };
}
