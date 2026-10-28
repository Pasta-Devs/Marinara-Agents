import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { SlurpHome } from "./SlpHomeHost";

export function SlpRouter({
  navigation,
  onNavigate,
  onLeave,
}: {
  navigation: SlurpNavigationState;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}) {
  return <SlurpHome navigation={navigation} onNavigate={onNavigate} onLeave={onLeave} />;
}
