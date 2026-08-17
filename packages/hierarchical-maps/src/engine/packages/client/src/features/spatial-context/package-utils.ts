import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const WORLD_MAPS_GUIDE_URL =
  "https://github.com/Pasta-Devs/Marinara-Engine/blob/main/docs/agents/hierarchical-maps.md";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
