import { useEffect, useState, type ReactNode } from 'react';
import { useBoardStyle, useDeck } from '../../../decks/decks';
import { useToast } from '../../toast/Toaster';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { drawShareImage, SHARE_IMAGE_SIZE } from './drawShareImage';
import { canCopyImage, canShareFile, copyImage, downloadFile, shareNatively, socialShareUrl, type SocialApp } from './shareFile';
import { shareFileName, shareMessage, type ShareSummary } from './shareSummary';
import styles from './ShareDialog.module.css';

type Image = { status: 'painting' } | { status: 'ready'; file: File; url: string } | { status: 'error'; message: string };

const APPS: { id: SocialApp; name: string; color: string; glyph: ReactNode }[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '#25d366',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z" />
        <path d="M9 9.2c0 3 2.6 5.6 5.6 5.6l1-1.4-1.8-.9-.8.8a4.4 4.4 0 0 1-2.4-2.4l.8-.8-.9-1.8z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  { id: 'x', name: 'X', color: '#000000', glyph: <span className={styles.letter}>X</span> },
  { id: 'facebook', name: 'Facebook', color: '#1877f2', glyph: <span className={styles.letter}>f</span> },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#229ed9',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M21 4L3 11l6.5 2.5L17 8l-5.5 6.5L18 20z" />
      </svg>
    ),
  },
];

interface ShareDialogProps {
  /** The result to share; null keeps the dialog closed. */
  summary: ShareSummary | null;
  onClose: () => void;
}

/**
 * The result as an image, with every way to pass it on: the device's share sheet (which attaches the image to any
 * app), WhatsApp, X, Facebook and Telegram (whose links take text only, so the image is copied first, to paste into
 * the chat or post), copying it, or saving it.
 */
export function ShareDialog({ summary, onClose }: ShareDialogProps) {
  const [deck] = useDeck();
  const [boardStyle] = useBoardStyle();
  const toast = useToast();
  const [image, setImage] = useState<Image>({ status: 'painting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!summary) return;
    let current = true;
    let url: string | null = null;
    setImage({ status: 'painting' });
    drawShareImage(summary, { deck, boardStyle, host: window.location.host }).then(
      (blob) => {
        if (!current) return;
        const file = new File([blob], shareFileName(summary), { type: 'image/png' });
        url = URL.createObjectURL(file);
        setImage({ status: 'ready', file, url });
      },
      (error: unknown) => current && setImage({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [summary, deck, boardStyle, attempt]);

  const file = image.status === 'ready' ? image.file : null;
  const message = summary ? shareMessage(summary) : '';
  const site = window.location.origin;

  const onNative = async () => {
    if (!file) return;
    try {
      if ((await shareNatively(file, { title: 'Sequence', text: `${message} Play at ${site}` })) === 'shared') onClose();
    } catch {
      toast.error('Your browser blocked the share sheet. Save the image or copy it instead.');
    }
  };

  // The copy starts before the app opens, while the tap still counts: browsers only allow the clipboard then.
  const onApp = (app: (typeof APPS)[number]) => {
    if (!file) return;
    const copied = copyImage(file);
    window.open(socialShareUrl(app.id, { message, url: site }), '_blank', 'noopener,noreferrer');
    void copied.then((ok) =>
      ok
        ? toast.success(`Image copied: paste it into ${app.name} to add it to your ${app.id === 'facebook' || app.id === 'x' ? 'post' : 'message'}.`)
        : toast.info(`${app.name} only takes text from a link. Save the image to attach it yourself.`),
    );
  };

  const onCopy = async () => {
    if (!file) return;
    if (await copyImage(file)) toast.success('Image copied: paste it anywhere.');
    else toast.error("This browser wouldn't copy the image. Save it instead.");
  };

  const onSave = () => {
    if (!file) return;
    downloadFile(file);
    toast.success(`Saved the result image: ${file.name}`);
  };

  return (
    <Dialog open={summary !== null} title="Share result" size="wide" onClose={onClose}>
      <div className={styles.layout}>
        <div
          className={styles.preview}
          style={{ aspectRatio: `${SHARE_IMAGE_SIZE.width} / ${SHARE_IMAGE_SIZE.height}` }}
          aria-busy={image.status === 'painting'}
        >
          {image.status === 'ready' && <img src={image.url} alt={`The result: ${summary?.headline ?? ''}`} />}
          {image.status === 'painting' && (
            <p className={styles.status} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              Drawing the result…
            </p>
          )}
          {image.status === 'error' && (
            <div className={styles.status} role="alert">
              <p>{image.message}</p>
              <button type="button" className={styles.retry} onClick={() => setAttempt((n) => n + 1)}>
                <Icon name="refresh" size={16} />
                Try again
              </button>
            </div>
          )}
        </div>

        <div className={styles.options}>
          <p className={styles.message}>{message}</p>
          {file && canShareFile(file) && (
            <button type="button" className={[styles.option, styles.primary].join(' ')} onClick={onNative} disabled={!file}>
              <span className={styles.badge} style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
                <Icon name="share" size={20} />
              </span>
              <span>
                <strong>Share image</strong>
                <small>Instagram, WhatsApp, Messages and every app on this device</small>
              </span>
            </button>
          )}
          <div className={styles.apps} role="group" aria-label="Share to an app">
            {APPS.map((app) => (
              <button key={app.id} type="button" className={styles.app} onClick={() => onApp(app)} disabled={!file}>
                <span className={styles.badge} style={{ background: app.color }} aria-hidden="true">
                  {app.glyph}
                </span>
                {app.name}
              </button>
            ))}
          </div>
          <div className={styles.apps} role="group" aria-label="Keep the image">
            {canCopyImage() && (
              <button type="button" className={styles.app} onClick={onCopy} disabled={!file}>
                <span className={[styles.badge, styles.plain].join(' ')}>
                  <Icon name="copy" size={20} />
                </span>
                Copy image
              </button>
            )}
            <button type="button" className={styles.app} onClick={onSave} disabled={!file}>
              <span className={[styles.badge, styles.plain].join(' ')}>
                <Icon name="download" size={20} />
              </span>
              Save image
            </button>
          </div>
          <p className={styles.note}>
            WhatsApp, X, Facebook and Telegram links carry text only, so the image is copied for you to paste in.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
