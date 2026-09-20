// Package-owned adapters: provider logic and I/O stay on the live Engine host.
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { packageIntegrations } from "../package-host.js";

export const generateImage = (...args: Parameters<CapabilityIntegrationHost["images"]["generate"]>) =>
  packageIntegrations().images.generate(...args);

export const saveImageToDisk = (...args: Parameters<CapabilityIntegrationHost["images"]["save"]>) =>
  packageIntegrations().images.save(...args);

export const removeSavedImageFromDisk = (...args: Parameters<CapabilityIntegrationHost["images"]["remove"]>) =>
  packageIntegrations().images.remove(...args);

export const stageImageToDisk = (...args: Parameters<CapabilityIntegrationHost["images"]["stage"]>) =>
  packageIntegrations().images.stage(...args);

export const sweepStagedImages = (...args: Parameters<CapabilityIntegrationHost["images"]["sweepStaged"]>) =>
  packageIntegrations().images.sweepStaged(...args);

export const resolveNovelAiRequestSize = (
  ...args: Parameters<CapabilityIntegrationHost["images"]["resolveNovelAiRequestSize"]>
) => packageIntegrations().images.resolveNovelAiRequestSize(...args);

export type {
  ImageGenRequest,
  ImageGenResult,
  StagedGalleryImage,
  SaveImageToDiskOptions,
} from "@marinara-engine/shared";
