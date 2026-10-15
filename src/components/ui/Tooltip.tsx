import { cloneElement, useEffect, useId, useRef, useState, type FocusEvent, type ReactElement } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  /** What the control does, in a few words. */
  text: string;
  /** One focusable element, usually a button. It gets aria-describedby pointing at the tip. */
  children: ReactElement;
  side?: 'top' | 'bottom';
  /** Where the tip lines up with the control. Use `end` near the right edge, `start` near the left. */
  align?: 'start' | 'center' | 'end';
}

const HOVER_DELAY_MS = 350;

/**
 * A small tip for a control, shown on mouse hover (after a short delay) and right away on keyboard focus,
 * unlike `title`, which keyboard and touch users never see. It stays while the pointer is over it, and Escape
 * hides it (WCAG 1.4.13).
 */
export function Tooltip({ text, children, side = 'bottom', align = 'center' }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = (delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onFocus = (event: FocusEvent<HTMLSpanElement>) => {
    // Only keyboard focus: a mouse click already showed (or skipped) the hover tip.
    if ((event.target as HTMLElement).matches(':focus-visible')) show(0);
  };

  const describedBy = [(children.props as { 'aria-describedby'?: string })['aria-describedby'], id].filter(Boolean).join(' ');

  return (
    <span
      className={styles.host}
      onPointerEnter={(event) => event.pointerType !== 'touch' && show(HOVER_DELAY_MS)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span role="tooltip" id={id} className={[styles.tip, styles[side], styles[align]].join(' ')} data-open={open}>
        {text}
      </span>
    </span>
  );
}
