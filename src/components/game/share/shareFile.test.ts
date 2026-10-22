import { describe, expect, it, vi } from 'vitest';
import { canShareFile, copyImage, shareNatively, socialShareUrl } from './shareFile';

const file = new File(['png'], 'result.png', { type: 'image/png' });
const details = { title: 'Sequence', text: 'I just won a Sequence match!' };

function domError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('canShareFile', () => {
  it('needs a share sheet that takes files', () => {
    expect(canShareFile(file, { share: vi.fn(), canShare: () => true })).toBe(true);
    expect(canShareFile(file, { share: vi.fn(), canShare: () => false })).toBe(false);
    expect(canShareFile(file, {} as Navigator)).toBe(false);
    expect(canShareFile(file, undefined)).toBe(false);
  });
});

describe('shareNatively', () => {
  it('opens the share sheet with the image and the message', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareNatively(file, details, { share, canShare: () => true })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Sequence', text: 'I just won a Sequence match!' });
  });

  it('treats a closed share sheet as cancelled', async () => {
    const share = vi.fn().mockRejectedValue(domError('AbortError'));
    expect(await shareNatively(file, details, { share, canShare: () => true })).toBe('cancelled');
  });

  it('passes on a refusal, so the dialog can say so', async () => {
    const share = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    await expect(shareNatively(file, details, { share, canShare: () => true })).rejects.toThrow('NotAllowedError');
  });
});

describe('copyImage', () => {
  it('reports whether the clipboard took the image', async () => {
    vi.stubGlobal('ClipboardItem', class {
      constructor(readonly items: Record<string, Blob>) {}
    });
    const write = vi.fn().mockResolvedValue(undefined);
    expect(await copyImage(file, { clipboard: { write } } as never)).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(await copyImage(file, { clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) } } as never)).toBe(false);
    vi.unstubAllGlobals();
    expect(await copyImage(file, { clipboard: { write } } as never)).toBe(false);
  });
});

describe('socialShareUrl', () => {
  const message = { message: 'I just won a Sequence match! 🏆', url: 'https://sequence.fifteens.app' };
  const text = 'I just won a Sequence match! 🏆 Play at https://sequence.fifteens.app';

  it('fills in the message and where to play for each app', () => {
    expect(socialShareUrl('whatsapp', message)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(socialShareUrl('x', message)).toBe(`https://x.com/intent/post?text=${encodeURIComponent(text)}`);
    expect(socialShareUrl('facebook', message)).toBe('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsequence.fifteens.app');
  });

  it('gives Telegram the link apart from the message, so it is not doubled', () => {
    const url = new URL(socialShareUrl('telegram', message));
    expect(url.searchParams.get('url')).toBe('https://sequence.fifteens.app');
    expect(url.searchParams.get('text')).toBe('I just won a Sequence match! 🏆');
  });
});
