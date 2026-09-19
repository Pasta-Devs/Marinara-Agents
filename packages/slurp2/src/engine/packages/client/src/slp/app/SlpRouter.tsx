import type { SlurpNavigationState } from "../base/navigation/slp-navigation.types";
import { SlurpHome } from "../../components/slurp/SlurpHome";

export function SlpRouter({
  navigation,
  onNavigate,
  onLeave,
}: {
  navigation: SlurpNavigationState;
  onNavigate: (destination: SlurpNavigationState) => void;
  onLeave?: () => void;
}) {
  if (navigation.mode !== "creator") return null;
  return <SlurpHome navigation={navigation} onNavigate={onNavigate} onLeave={onLeave} />;
}
