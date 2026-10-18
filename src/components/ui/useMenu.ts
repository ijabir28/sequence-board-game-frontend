import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/**
 * A button that opens a small menu of role="menuitem" entries: opening focuses the first entry, the arrow keys,
 * Home and End move between them, Escape closes and returns focus to the button, and a press outside closes it.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const entries = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    entries()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const list = entries();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  };

  return {
    open,
    close: () => setOpen(false),
    rootRef: root,
    triggerProps: {
      ref: trigger,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
      onClick: () => setOpen((was) => !was),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' && !open) {
          event.preventDefault();
          setOpen(true);
        }
      },
    },
    menuProps: { ref: menu, id: menuId, role: 'menu', onKeyDown: onMenuKeyDown },
  };
}
