// Package-owned adapters: provider logic and I/O stay on the live Engine host.
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { packageIntegrations } from "../package-host.js";

export const generateVideo = (...args: Parameters<CapabilityIntegrationHost["videos"]["generate"]>) =>
  packageIntegrations().videos.generate(...args);

export const saveVideoToDisk = (...args: Parameters<CapabilityIntegrationHost["videos"]["save"]>) =>
  packageIntegrations().videos.save(...args);

export const removeSavedVideoFromDisk = (...args: Parameters<CapabilityIntegrationHost["videos"]["remove"]>) =>
  packageIntegrations().videos.remove(...args);

export const resolveVideoRequestDuration = (
  ...args: Parameters<CapabilityIntegrationHost["videos"]["resolveDuration"]>
) => packageIntegrations().videos.resolveDuration(...args);

export const resolveVideoReferencePublicUploadOptions = (
  ...args: Parameters<CapabilityIntegrationHost["videos"]["resolveReferenceUpload"]>
) => packageIntegrations().videos.resolveReferenceUpload(...args);

export type {
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoReferenceImage,
  VideoReferencePublicUploadOptions,
  VideoReferencePublicUploadExpiry,
  LtxDirectorPromptInput,
} from "@marinara-engine/shared";
