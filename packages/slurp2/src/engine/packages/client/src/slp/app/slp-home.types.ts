import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types.js";

export interface SlurpHomeProps {
  navigation: SlurpNavigationState;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}
