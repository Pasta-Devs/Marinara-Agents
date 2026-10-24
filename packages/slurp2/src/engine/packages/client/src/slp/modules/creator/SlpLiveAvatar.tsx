import type { ReactNode } from "react";

export function SlpLiveAvatar({ children, live }: { children: ReactNode; live: boolean }) {
  return (
    <span className="relative block">
      {children}
      {live && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
          LIVE
        </span>
      )}
    </span>
  );
}
