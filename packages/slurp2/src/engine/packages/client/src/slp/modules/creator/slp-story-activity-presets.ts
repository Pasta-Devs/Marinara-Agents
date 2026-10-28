/**
 * One choice for how much happens by itself: events, storylines, and shared ideas together.
 *
 * Three start switches that answer the same question sat in three places with different defaults.
 * A preset writes existing keys only; a stored mix that matches none shows as Custom rather than
 * being rounded to the nearest preset.
 */
export type SlurpStoryActivityPreset = "calm" | "lively" | "handsOff";

/** The four settings a preset writes, typed here because modules do not import features. */
type StoryActivityKeys = {
  storyAutomation: "manual" | "suggest" | "auto";
  arcAutoMode: "off" | "suggest" | "auto";
  sharedPreseed: boolean;
  sharedWorldEvents: boolean;
};

export const SLURP_STORY_ACTIVITY_PRESETS: Record<SlurpStoryActivityPreset, StoryActivityKeys> = {
  // Nothing starts without you; events are still suggested so holidays are not missed.
  calm: { storyAutomation: "suggest", arcAutoMode: "off", sharedPreseed: false, sharedWorldEvents: false },
  // Slurp suggests storylines and events and adds shared seasonal ideas.
  lively: { storyAutomation: "suggest", arcAutoMode: "suggest", sharedPreseed: true, sharedWorldEvents: false },
  // Everything runs by itself, including short platform-wide events.
  handsOff: { storyAutomation: "auto", arcAutoMode: "auto", sharedPreseed: true, sharedWorldEvents: true },
};

export const SLURP_STORY_ACTIVITY_PRESET_ORDER: readonly SlurpStoryActivityPreset[] = ["calm", "lively", "handsOff"];

/** The preset these settings match exactly, or null (Custom). */
export function slurpStoryActivityPresetFor(settings: StoryActivityKeys): SlurpStoryActivityPreset | null {
  return (
    SLURP_STORY_ACTIVITY_PRESET_ORDER.find((preset) =>
      (Object.keys(SLURP_STORY_ACTIVITY_PRESETS[preset]) as (keyof StoryActivityKeys)[]).every(
        (key) => SLURP_STORY_ACTIVITY_PRESETS[preset][key] === settings[key],
      ),
    ) ?? null
  );
}
