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

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** The picture's centre, as a AVATAR_SIZE square WebP (or PNG where the browser can't encode WebP). */
export async function makeAvatar(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("That file isn't a picture this browser can open. Try a PNG or JPEG.");
  }
  const [x, y, side] = centerSquare(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, side);
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
