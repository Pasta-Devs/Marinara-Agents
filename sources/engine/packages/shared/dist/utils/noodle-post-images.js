import { noodlePostImageCropSchema } from "../schemas/noodle.schema.js";
export function readNoodlePostImageCrop(metadata) {
    const parsed = noodlePostImageCropSchema.safeParse(metadata?.imageCrop);
    return parsed.success ? parsed.data : null;
}
//# sourceMappingURL=noodle-post-images.js.map