/**
 * Text in the app can't be selected or copied: global.css turns selection off, and this blocks what CSS can't
 * (keyboard and menu copy or cut, selection started from script, dragging text, links or images out of the page).
 * What you type is exempt, so fields can still be edited. The Copy code and Copy link buttons write to the
 * clipboard directly (or, without the Clipboard API, from an editable hidden field: see copyText.ts), so they still work.
 */
export function isEditable(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  if (node instanceof HTMLTextAreaElement) return !node.readOnly;
  if (node instanceof HTMLInputElement) return !node.readOnly && node.type !== 'checkbox' && node.type !== 'radio';
  return node.closest('[contenteditable="true"]') !== null;
}

export function installCopyGuard(doc: Document = document): () => void {
  const block = (event: Event) => {
    // Copy and cut are aimed at the focused element; selectstart and dragstart at what is under the pointer.
    const target = event.type === 'copy' || event.type === 'cut' ? doc.activeElement : event.target;
    if (!isEditable(target)) event.preventDefault();
  };
  const types = ['copy', 'cut', 'selectstart', 'dragstart'] as const;
  types.forEach((type) => doc.addEventListener(type, block, true));
  return () => types.forEach((type) => doc.removeEventListener(type, block, true));
}
