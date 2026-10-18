// Turns a picture the player chose into a small square avatar, in the browser, before it is uploaded. The server
// stores avatars in the database and caps them at 256 KB, so they are shrunk here rather than sent as photos.

/** A picture this browser can't turn into an avatar; `message` is written for players. */
export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

/** Avatars are stored at this size, which covers every place they are shown, on high-density screens too. */
export const AVATAR_SIZE = 256;

/** What the file picker offers. HEIC and others decode in some browsers only; anything that decodes is accepted. */
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

/** The largest centred square of a w×h picture: [x, y, side]. */
export function centerSquare(width: number, height: number): [number, number, number] {
  const side = Math.min(width, height);
  return [Math.floor((width - side) / 2), Math.floor((height - side) / 2), side];
}

/** Furthest the crop can zoom in: a square a quarter as wide as the picture's shorter side. */
export const MAX_ZOOM = 4;

/**
 * Which square of a w×h picture becomes the avatar: its centre (cx, cy) in the picture's pixels, and a zoom where 1
 * is the largest square that fits and MAX_ZOOM the smallest.
 */
export type Crop = { cx: number; cy: number; zoom: number };

/** The largest centred square: what an untouched picture is cropped to. */
export function initialCrop(width: number, height: number): Crop {
  return { cx: width / 2, cy: height / 2, zoom: 1 };
}

/** The crop with its zoom kept in range and its square moved back inside the picture. */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
  const half = Math.min(width, height) / zoom / 2;
  const clamp = (value: number, size: number) => Math.min(size - half, Math.max(half, value));
  return { cx: clamp(crop.cx, width), cy: clamp(crop.cy, height), zoom };
}

/** The crop's square in the picture's pixels: [x, y, side]. */
export function cropSquare(crop: Crop, width: number, height: number): [number, number, number] {
  const { cx, cy, zoom } = clampCrop(crop, width, height);
  const side = Math.min(width, height) / zoom;
  return [cx - side / 2, cy - side / 2, side];
}

/** The crop moved by (dx, dy) screen pixels of a frame `frame` pixels wide: the picture follows the pointer. */
export function panCrop(crop: Crop, dx: number, dy: number, frame: number, width: number, height: number): Crop {
  const perPixel = Math.min(width, height) / crop.zoom / frame;
  return clampCrop({ ...crop, cx: crop.cx - dx * perPixel, cy: crop.cy - dy * perPixel }, width, height);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The cropped square of the picture (its centre when no crop is given), as a AVATAR_SIZE square WebP (or PNG where
 * the browser can't encode WebP).
 */
export async function makeAvatar(file: Blob, crop?: Crop): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("That file isn't a picture this browser can open. Try a PNG or JPEG.");
  }
  const [x, y, side] = crop ? cropSquare(crop, bitmap.width, bitmap.height) : centerSquare(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, Math.round(side));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new AvatarError("This browser can't prepare pictures. Try another browser.");
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
  bitmap.close();
  // Browsers that can't encode WebP hand back a PNG instead; both are accepted.
  const blob = (await toBlob(canvas, 'image/webp', 0.85)) ?? (await toBlob(canvas, 'image/png'));
  if (!blob) throw new AvatarError("This browser can't prepare pictures. Try another browser.");
  return blob;
}
