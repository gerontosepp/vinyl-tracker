import { InjectionToken } from '@angular/core';

/** Longest edge of an uploaded label photo; matches the backend limit. */
export const LABEL_PHOTO_MAX_EDGE = 1568;

/** Target size that fits into `maxEdge` while keeping the aspect ratio (never upscales). */
export const fitWithin = (
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * Downscales a photo and re-encodes it as JPEG in the browser. Browsers apply the EXIF
 * orientation when decoding, so the result is upright, small and free of metadata; this also
 * turns HEIC photos from iOS into JPEG.
 */
export const downscaleImage = async (
  file: Blob,
  maxEdge = LABEL_PHOTO_MAX_EDGE,
  quality = 0.85
): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode photo'))),
        'image/jpeg',
        quality
      )
    );
  } finally {
    bitmap.close();
  }
};

/** Photo downscaler used by components; replaceable in tests. */
export const IMAGE_DOWNSCALER = new InjectionToken<(file: Blob) => Promise<Blob>>(
  'IMAGE_DOWNSCALER',
  { providedIn: 'root', factory: () => (file: Blob) => downscaleImage(file) }
);
