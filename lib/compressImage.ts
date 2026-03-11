/**
 * Compresses an image file using the Canvas API.
 * Resizes to max 1200 px on the longest side and exports as JPEG at 75% quality.
 * Typical output: 150–350 KB for a full-resolution mobile photo.
 */
export async function compressImage(file: File): Promise<File> {
  const MAX_PX = 1200;
  const QUALITY = 0.75;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down to MAX_PX on the longest side
      if (width > height && width > MAX_PX) {
        height = Math.round((height * MAX_PX) / width);
        width = MAX_PX;
      } else if (height > MAX_PX) {
        width = Math.round((width * MAX_PX) / height);
        height = MAX_PX;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          // Use .jpg extension for the compressed file
          const outName =
            file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], outName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = objectUrl;
  });
}
