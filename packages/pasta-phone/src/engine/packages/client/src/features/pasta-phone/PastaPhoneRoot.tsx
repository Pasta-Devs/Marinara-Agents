import { useState } from "react";
import { PastaPhoneTrigger } from "./PastaPhoneTrigger";
import { PastaPhoneSheet } from "./PastaPhoneSheet";

interface PastaPhoneRootProps {
  view: string | null;
}

export function PastaPhoneRoot({ view }: PastaPhoneRootProps) {
  const [open, setOpen] = useState(false);

  if (view !== "toolbar") return null;

  return (
    <>
      <PastaPhoneTrigger onOpen={() => setOpen(true)} />
      <PastaPhoneSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
