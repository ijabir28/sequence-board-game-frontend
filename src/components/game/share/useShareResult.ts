import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardStyle, Deck } from '../../../decks/decks';
import { useToast } from '../../toast/Toaster';
import { drawShareImage } from './drawShareImage';
import { shareOrDownload } from './shareFile';
import { shareFileName, shareText, type ShareSummary } from './shareSummary';

/**
 * Sharing a finished game's result as an image. The image is painted shortly after the game ends, before anyone
 * asks, so a tap on Share opens the share sheet at once: browsers only allow it straight after a tap, and painting
 * first could take long enough on a slow phone for the share to be refused.
 */
export function useShareResult(summary: ShareSummary | null, look: { deck: Deck; boardStyle: BoardStyle }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const image = useRef<Promise<File> | null>(null);
  const { deck, boardStyle } = look;

  const paint = useCallback(() => {
    if (!summary) return null;
    const name = shareFileName(summary);
    return drawShareImage(summary, { deck, boardStyle, host: window.location.host }).then((blob) => new File([blob], name, { type: 'image/png' }));
  }, [summary, deck, boardStyle]);

  useEffect(() => {
    image.current = null;
    if (!summary) return;
    const timer = setTimeout(() => {
      const next = paint();
      // A failure here is reported when the player actually asks to share.
      next?.catch(() => {});
      image.current = next;
    }, 400);
    return () => clearTimeout(timer);
  }, [summary, paint]);

  const share = useCallback(async () => {
    if (!summary) return;
    setBusy(true);
    try {
      const pending = image.current ?? paint();
      image.current = pending;
      const file = await pending!;
      const outcome = await shareOrDownload(file, { title: 'Sequence', text: shareText(summary, window.location.origin) });
      if (outcome === 'downloaded') toast.success(`Saved the result image: ${file.name}`);
    } catch (error) {
      // Painting failed, so the next tap tries again from scratch.
      image.current = null;
      toast.error(error instanceof Error ? error.message : 'The result image could not be shared.');
    } finally {
      setBusy(false);
    }
  }, [summary, paint, toast]);

  return { share, busy, available: summary !== null };
}
