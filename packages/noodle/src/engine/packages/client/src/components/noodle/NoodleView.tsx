import { useUIStore } from "../../stores/noodle-package.store";
import { NoodleHome } from "./NoodleHome";

export function NoodleView({
  focusPostId,
  onFocusPostHandled,
}: {
  focusPostId?: string | null;
  onFocusPostHandled?: () => void;
}) {
  const navigation = useUIStore((state) => state.noodleNavigation);
  const setNavigation = useUIStore((state) => state.setNoodleNavigation);

  return (
    <NoodleHome
      navigation={navigation}
      onNavigate={setNavigation}
      focusPostId={focusPostId}
      onFocusPostHandled={onFocusPostHandled}
    />
  );
}
