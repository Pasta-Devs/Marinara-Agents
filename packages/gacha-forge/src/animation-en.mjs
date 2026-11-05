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
  hostUnavailable: "Update Marinara Engine to animate banners, then try again.",
  sourceImageMissing:
    "Engine cannot find or read this banner's saved source image. Regenerate the illustration, then retry.",
  connectionFailed:
    "Check the selected video connection and API key in Engine Settings → Connections, and that Engine can reach the provider, then retry.",
  providerFailed:
    "Video generation failed (HTTP {status}). Check this video connection and provider account, then retry.",
  providerRejected:
    "The video provider rejected or failed the clip. Check this video connection and provider account, then retry.",
  responseFailed:
    "The video request or response could not be read. Update Engine and check the video connection, then retry.",
  storageFailed: "Engine could not save the animation. Check available disk space and data-folder access, then retry.",
  timeoutFailed: "Video generation timed out or Engine's media queue was full. Try again later.",
  interruptedFailed:
    "The last animation attempt was interrupted when Engine restarted or the package updated. The illustration is still shown.",
  unknownFailed:
    'Banner animation failed. The Engine server log line "[gacha-forge] Banner animation failed" has the details.',
  connectionLost:
    "Lost contact with Engine while animating. The clip may still be finishing: reopen this banner in a moment before retrying.",
  seedanceSetup:
    'Seedance needs a public HTTPS banner image. In Engine Settings → Connections, edit this video connection and enable "Upload Seedance reference frames temporarily", then retry. If it was already on, the temporary upload failed.',
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
