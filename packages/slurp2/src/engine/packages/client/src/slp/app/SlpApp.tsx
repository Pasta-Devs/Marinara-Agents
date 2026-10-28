import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { useSlpSceneFocus } from "../features/messages/scenes/slp-roleplay-scene-hooks";
import { SlpRouter } from "./SlpRouter";

export function SlpApp({
  navigation,
  onNavigate,
  onLeave,
}: {
  navigation: SlurpNavigationState;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}) {
  // Back from a roleplay scene, the Engine names the DM thread it started in (docs/SCENES.md).
  useSlpSceneFocus();
  return <SlpRouter navigation={navigation} onNavigate={onNavigate} onLeave={onLeave} />;
}
