/** How handing the image over went. */
export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

interface ShareEnv {
  navigator?: Pick<Navigator, 'share' | 'canShare'>;
  /** Saves the file; by default through a download link. */
  download?: (file: File) => void;
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

/**
 * Opens the device's share sheet with the image (to send it to a chat, post it, or save it), or where the browser
 * can't share files (most desktop browsers, Firefox), downloads it instead. Closing the share sheet is 'cancelled',
 * not an error; a share the browser refuses (for example because too long passed since the tap) falls back to the
 * download, so the player always gets the image.
 */
export async function shareOrDownload(file: File, details: { title: string; text: string }, env: ShareEnv = {}): Promise<ShareOutcome> {
  const nav = env.navigator ?? (typeof navigator === 'undefined' ? undefined : navigator);
  const download = env.download ?? downloadFile;
  const data: ShareData = { files: [file], title: details.title, text: details.text };
  if (nav?.share && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  download(file);
  return 'downloaded';
}
