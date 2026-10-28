// ──────────────────────────────────────────────
// The Engine's gallery store, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// Pinning an image from a package lightbox pins it in the Engine. The copy packages used to bundle kept its own pins
// in "marinara-pinned-gallery-images" and wrote them over the Engine's; this file is stacked over that module, so
// `useGalleryStore` is `__MARINARA_HOST__.stores.gallery`. On an Engine without it, pinning does nothing.
import { create } from "zustand";
import { hostStore, readOnlyStore, type BoundStore } from "../lib/marinara-host-bridge";

/** What package code reads from the Engine's gallery store. */
export type GalleryState = {
  pinImage: (image: never) => void;
  pinVideo: (video: never) => void;
};

export const useGalleryStore: BoundStore<GalleryState> =
  hostStore<GalleryState>("gallery") ??
  readOnlyStore<GalleryState>(create, { pinImage: () => undefined, pinVideo: () => undefined });
