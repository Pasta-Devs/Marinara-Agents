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
  // with no transition at all. This is the cheap version: one wrapper, opacity and a
  // 6px rise on the surface that arrives, no exit animation. An exit would mean
  // holding both trees mounted through the swap, which is exactly the cost not worth
  // paying for a fifth of a second.
  return (
    <motion.div
      key={noodler ? "noodler" : "noodle"}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
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
