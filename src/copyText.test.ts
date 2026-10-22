import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

function fakeDocument(copied: boolean) {
  const field = { value: '', style: {}, setAttribute: vi.fn(), focus: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn(), remove: vi.fn() };
  const doc = {
    activeElement: null,
    defaultView: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    querySelector: () => null,
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => field),
    execCommand: vi.fn(() => copied),
  };
  return { doc: doc as unknown as Document, field, execCommand: doc.execCommand };
}

afterEach(() => vi.unstubAllGlobals());

describe('copyText', () => {
  it('uses the Clipboard API where there is one', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { doc, execCommand } = fakeDocument(true);
    expect(await copyText('https://x.test/watch/a', doc)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://x.test/watch/a');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('copies from a hidden field on pages without the Clipboard API (a phone on the LAN over http)', async () => {
    vi.stubGlobal('navigator', {});
    const { doc, field, execCommand } = fakeDocument(true);
    expect(await copyText('http://192.168.1.5:5173/watch/a', doc)).toBe(true);
    expect(field.value).toBe('http://192.168.1.5:5173/watch/a');
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(field.remove).toHaveBeenCalled();
  });

  it("writes the text from the copy event, so the copy guard can't cancel it, and says when the event couldn't", async () => {
    vi.stubGlobal('navigator', {});
    for (const clipboardData of [{ setData: vi.fn() }, null]) {
      const { doc } = fakeDocument(true);
      let listener: (event: unknown) => void = () => {};
      Object.assign(doc.defaultView!, { addEventListener: (_: string, fn: typeof listener) => (listener = fn) });
      // The browser fires the copy event during the command, and says it copied whatever listeners did.
      (doc as unknown as { execCommand: () => boolean }).execCommand = () => {
        listener({ clipboardData, preventDefault: vi.fn() });
        return true;
      };
      expect(await copyText('http://192.168.1.5:5173/watch/a', doc)).toBe(clipboardData !== null);
      if (clipboardData) expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'http://192.168.1.5:5173/watch/a');
    }
  });

  it('falls back when the Clipboard API refuses, and says when nothing worked', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    expect(await copyText('a', fakeDocument(false).doc)).toBe(false);
  });
});
