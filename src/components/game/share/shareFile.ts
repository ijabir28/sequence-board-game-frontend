/*
 * The ways the share dialog hands the result image over. Only the device's own share sheet (the Web Share API) can
 * attach an image to WhatsApp, Instagram and the rest; a web link to those apps carries text and a link only. So the
 * app buttons copy the image to the clipboard first, for the player to paste into the chat or post, and open the app
 * with the message filled in.
 */

type ShareNavigator = Pick<Navigator, 'share' | 'canShare'> & { clipboard?: Pick<Clipboard, 'write'> };

function defaultNavigator(): ShareNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator;
}

/** The device's share sheet can take the image (most phones, Safari, Chrome and Edge on Windows and ChromeOS). */
export function canShareFile(file: File, nav: ShareNavigator | undefined = defaultNavigator()): boolean {
  try {
    return !!nav?.share && !!nav.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Opens the share sheet with the image. 'cancelled' when the player closes it, which isn't an error; throws when the
 * browser refuses.
 */
export async function shareNatively(
  file: File,
  details: { title: string; text: string },
  nav: ShareNavigator | undefined = defaultNavigator(),
): Promise<'shared' | 'cancelled'> {
  if (!nav?.share) throw new Error('This browser has no share sheet.');
  try {
    await nav.share({ files: [file], title: details.title, text: details.text });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}

/** The clipboard can hold an image here. */
export function canCopyImage(nav: ShareNavigator | undefined = defaultNavigator()): boolean {
  return !!nav?.clipboard?.write && typeof ClipboardItem !== 'undefined';
}

/**
 * Copies the image to the clipboard, for pasting into a chat or a post. Resolves to whether it worked: some browsers
 * refuse without saying why.
 */
export async function copyImage(blob: Blob, nav: ShareNavigator | undefined = defaultNavigator()): Promise<boolean> {
  if (!canCopyImage(nav)) return false;
  try {
    await nav!.clipboard!.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Saves `file` to the device through a temporary download link. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the download after the click returns, so the link's address lives a little longer.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type SocialApp = 'whatsapp' | 'x' | 'facebook' | 'telegram';

/**
 * Where each app's own share page is, with the message and the game's address filled in (Facebook takes the address
 * only). On a phone these open the app itself.
 */
export function socialShareUrl(app: SocialApp, { message, url }: { message: string; url: string }): string {
  const q = encodeURIComponent;
  const text = `${message} Play at ${url}`;
  switch (app) {
    case 'whatsapp':
      return `https://wa.me/?text=${q(text)}`;
    case 'x':
      return `https://x.com/intent/post?text=${q(text)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${q(url)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${q(url)}&text=${q(message)}`;
  }
}
