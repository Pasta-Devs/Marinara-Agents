import { motion, useReducedMotion } from "framer-motion";
import { useUIStore } from "../../stores/noodle-package.store";
import { NoodleHome } from "./NoodleHome";
import { NoodlerHome } from "./NoodlerHome";

export function NoodleView() {
  const navigation = useUIStore((state) => state.noodleNavigation);
  const setNavigation = useUIStore((state) => state.setNoodleNavigation);
  const reduceMotion = useReducedMotion();
  const noodler = navigation.mode === "noodler";

  // Switching apps is a jump between two differently coloured worlds, and it landed
  // with no transition at all. The arriving surface rises 6px into place — and only
  // that. Fading it up from transparent read as a black screen, because the outgoing
  // surface is already gone by then and there is nothing behind it but the background.
  // No exit animation either: that would mean holding both trees mounted through the
  // swap, which is far more than a fifth of a second is worth.
  return (
    <motion.div
      key={noodler ? "noodler" : "noodle"}
      initial={reduceMotion ? false : { y: 6 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="h-full min-h-0"
    >
      {noodler ? (
        <NoodlerHome navigation={navigation} onNavigate={setNavigation} />
      ) : (
        <NoodleHome navigation={navigation} onNavigate={setNavigation} />
      )}
    </motion.div>
  );
}
