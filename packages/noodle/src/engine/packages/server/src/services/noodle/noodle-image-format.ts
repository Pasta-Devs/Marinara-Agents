const IMAGE_EXTENSIONS = new Set(["png", "jpg", "webp", "gif", "avif", "bmp"]);

export function noodleImageExtension(base64: string, fallback: string): string {
  const bytes = Buffer.from(base64.slice(0, 64), "base64");
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const majorBrand = bytes.subarray(8, 12).toString("ascii").toLowerCase();
    if (majorBrand === "avif" || majorBrand === "avis") return "avif";
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      const compatibleBrand = bytes
        .subarray(offset, offset + 4)
        .toString("ascii")
        .toLowerCase();
      if (compatibleBrand === "avif" || compatibleBrand === "avis") return "avif";
    }
  }

  const normalizedFallback = fallback.toLowerCase().replace(/^\./, "").replace("jpeg", "jpg");
  return IMAGE_EXTENSIONS.has(normalizedFallback) ? normalizedFallback : "png";
}
