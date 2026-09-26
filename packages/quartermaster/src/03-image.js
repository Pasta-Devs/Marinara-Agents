// Quartermaster — client-side image resize/compression before upload, so a
// phone photo doesn't get shipped to (and stored on) the server at full
// resolution. Runs entirely in the browser via a canvas; the server only
// validates size/type on receipt, it never resizes anything itself.
const QM_PORTRAIT_MAX_DIMENSION = 640;
const QM_PORTRAIT_JPEG_QUALITY = 0.85;

QM.compressImageFile = function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the selected file as an image."));
      img.onload = () => {
        const scale = Math.min(1, QM_PORTRAIT_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        // PNG only when the source already was (preserves transparency);
        // everything else — jpeg, webp, or anything else the browser can
        // decode through the <input accept> filter — re-encodes as JPEG,
        // smaller and universally supported by the canvas encoder.
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, outputType === "image/jpeg" ? QM_PORTRAIT_JPEG_QUALITY : undefined));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};
