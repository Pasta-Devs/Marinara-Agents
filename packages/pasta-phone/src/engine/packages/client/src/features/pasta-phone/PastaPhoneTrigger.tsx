import { Smartphone } from "lucide-react";

interface PastaPhoneTriggerProps {
  onOpen: () => void;
}

export function PastaPhoneTrigger({ onOpen }: PastaPhoneTriggerProps) {
  return (
    <button
      type="button"
      className="mari-chrome-control flex h-9 w-9 items-center justify-center p-0"
      title="Open Pasta Phone (preview)"
      onClick={onOpen}
    >
      <Smartphone size="0.875rem" />
    </button>
  );
}
