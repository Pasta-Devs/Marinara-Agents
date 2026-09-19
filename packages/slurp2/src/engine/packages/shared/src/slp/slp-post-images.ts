import { slpPostImageCropSchema } from "./slp-social.schema.js";
import type { SlpPostImageCrop } from "./slp-social.types.js";

export function readSlpPostImageCrop(metadata: Record<string, unknown> | null | undefined): SlpPostImageCrop | null {
  const parsed = slpPostImageCropSchema.safeParse(metadata?.imageCrop);
  return parsed.success ? parsed.data : null;
}
