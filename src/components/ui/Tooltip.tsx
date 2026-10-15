import { cloneElement, useId, type ReactElement } from 'react';
import { tipProps, type TipAlign, type TipSide } from './TooltipLayer';

interface TooltipProps {
  /** What the control does, in a few words. */
  text: string;
  /** One element, usually a button. It gets the tip, and aria-describedby pointing at the same text. */
  children: ReactElement;
  /** The preferred side; the tip flips if there is no room. */
  side?: TipSide;
  /** Where the tip lines up with the control. Use `end` near the right edge, `start` near the left. */
  align?: TipAlign;
}

/**
 * A small tip for a control, shown on mouse hover (after a short delay) and right away on keyboard focus,
 * unlike `title`, which keyboard and touch users never see. TooltipLayer draws it; this only tags the control
 * and gives screen readers the same text as a description.
 */
export function Tooltip({ text, children, side = 'bottom', align = 'center' }: TooltipProps) {
  const id = useId();
  const describedBy = [(children.props as { 'aria-describedby'?: string })['aria-describedby'], id].filter(Boolean).join(' ');
  return (
    <>
      {cloneElement(children, { ...tipProps(text, side, align), 'aria-describedby': describedBy })}
      <span id={id} hidden>
        {text}
      </span>
    </>
  );
}
