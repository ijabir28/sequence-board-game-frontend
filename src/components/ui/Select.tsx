import { useLayoutEffect, useState } from 'react';
import { Icon } from './Icon';
import menuStyles from './Menu.module.css';
import styles from './Select.module.css';
import { useMenu } from './useMenu';

export interface SelectOption {
  value: string;
  label: string;
}

/** Room the list wants below its button before it opens upward instead. */
const LIST_ROOM_PX = 240;

/**
 * A dropdown list in the app's own look, in place of a native <select> (whose list each browser draws its own way):
 * a button showing the chosen option, and the same glass menu the account menu uses, with the menu's keyboard.
 * Long labels are cut with an ellipsis, so a list never grows wider than the screen.
 */
export function Select({
  value,
  options,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label': string;
}) {
  const { open, close, rootRef, triggerProps, menuProps } = useMenu('listbox');
  const chosen = options.find((option) => option.value === value) ?? options[0];
  // Near the bottom of the screen the list opens upward, so it isn't cut off.
  const [up, setUp] = useState(false);
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const box = rootRef.current.getBoundingClientRect();
    setUp(window.innerHeight - box.bottom < LIST_ROOM_PX && box.top > window.innerHeight - box.bottom);
  }, [open, rootRef]);

  // Picking hands focus back to the button (the list it was in is gone), without scrolling: it is where you are looking.
  const pick = (option: SelectOption) => {
    close();
    (rootRef.current?.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    if (option.value !== value) onChange(option.value);
  };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')}>
      {/* aria-disabled rather than disabled, which would drop focus to the page while the pick before saves. */}
      <button
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        {...triggerProps}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : triggerProps.onClick}
        onKeyDown={disabled ? undefined : triggerProps.onKeyDown}
      >
        <span className={styles.value}>{chosen?.label}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className={styles.caret} />
      </button>
      {open && (
        <div {...menuProps} aria-label={ariaLabel} className={[menuStyles.menu, styles.list, up && styles.up].filter(Boolean).join(' ')}>
          {options.map((option) => (
            <div
              key={option.value}
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              className={[menuStyles.item, styles.option].join(' ')}
              onClick={() => pick(option)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                pick(option);
              }}
            >
              <span className={styles.value}>{option.label}</span>
              {option.value === value && <Icon name="check" size={16} className={styles.check} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
