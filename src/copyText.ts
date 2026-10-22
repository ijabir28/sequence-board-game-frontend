/**
 * Puts `text` on the clipboard; resolves to whether it worked. Call it straight from a click or tap.
 *
 * The Clipboard API only exists on secure pages (HTTPS or localhost), so a phone opening the dev server by its LAN
 * address has none; there, and wherever it refuses, the text goes through a `copy` command instead. Its copy event is
 * answered here with the text itself, before the copy guard (copyGuard.ts) cancels copies of the page, so neither the
 * guard nor where the focus is (an open modal dialog makes the rest of the page inert) gets in the way. A hidden
 * field holds the text selected too, for browsers that only copy when something is selected.
 */
export async function copyText(text: string, doc: Document = document): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (no permission, or the page isn't focused): try the old way.
  }
  return copyWithCommand(text, doc);
}

function copyWithCommand(text: string, doc: Document): boolean {
  let written = false;
  let fired = false;
  const answer = (event: ClipboardEvent) => {
    fired = true;
    if (!event.clipboardData) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    written = true;
  };
  const view = doc.defaultView ?? window;
  // The window's capture listener runs before the guard's, which listens on the document.
  view.addEventListener('copy', answer, true);
  const field = doc.createElement('textarea');
  field.value = text;
  field.setAttribute('aria-hidden', 'true');
  // Out of sight, and 16px so iOS doesn't zoom in on it.
  Object.assign(field.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0', fontSize: '16px' });
  const focused = doc.activeElement as HTMLElement | null;
  // Inside an open modal dialog, the only part of the page that can take focus.
  const container = doc.querySelector('dialog[open]') ?? doc.body;
  container.appendChild(field);
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, text.length);
    const copied = doc.execCommand('copy');
    // The command says it copied even when the guard cancelled it, so trust what the copy event saw when it fired.
    return fired ? written : copied;
  } catch {
    return written;
  } finally {
    view.removeEventListener('copy', answer, true);
    field.remove();
    focused?.focus?.();
  }
}
