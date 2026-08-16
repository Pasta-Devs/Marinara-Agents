import { useUIStore } from "../../stores/noodle-package.store";
import { NoodleHome } from "./NoodleHome";

export function NoodleView() {
  const navigation = useUIStore((state) => state.noodleNavigation);
  const setNavigation = useUIStore((state) => state.setNoodleNavigation);

  return <NoodleHome navigation={navigation} onNavigate={setNavigation} />;
}
