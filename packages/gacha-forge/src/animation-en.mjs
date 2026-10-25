// Canonical English interface copy; animation prompts remain provider instructions.
export const forgeAnimationEnglish = {
  sources: "Animations",
  release: "Choose an Animations connection in Sources for looping banner clips. Portraits stay still.",
  connection: "Animations",
  off: "Off, use still banners",
  hint: "Animate banners with an Engine video connection. Clips are saved and reused; generating or retrying uses provider credits. Portraits stay still.",
  unavailable: "Selected video connection unavailable, choose a replacement",
  connectionsFailed: "Could not read video connections. Open Engine Settings to check them.",
  generating: "Animating banner…",
  retrying: "Retrying animation…",
  failed: "Banner animation unavailable. The illustration is still shown.",
  seedanceSetup:
    'Seedance needs a public HTTPS banner image. In Engine Settings → Connections, edit this video connection and enable "Upload Seedance reference frames temporarily", then retry.',
  retry: "Retry animation",
  retryCost: "Retrying may use provider credits.",
  playbackFailed: "This animation could not play. The illustration is still shown.",
  pause: "Pause animation",
  play: "Play animation",
};

export function forgeAnimationFields() {
  return [
    {
      id: "animationConnectionId",
      step: "look",
      settings: "sources",
      group: "animations",
      type: "select",
      optionsFrom: "forgeVideoConnections",
      label: forgeAnimationEnglish.connection,
      emptyOption: forgeAnimationEnglish.off,
      hint: forgeAnimationEnglish.hint,
      default: "",
    },
  ];
}
