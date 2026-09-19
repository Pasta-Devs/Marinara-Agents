import type { SlurpNavigationState } from "../../components/slurp/slurp-navigation.types";
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
  return <SlpRouter navigation={navigation} onNavigate={onNavigate} onLeave={onLeave} />;
}
