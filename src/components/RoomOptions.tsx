import { useId } from 'react';
import type { RoomSettings } from '../api/rooms';
import styles from './RoomOptions.module.css';

const OPTIONS: { key: keyof RoomSettings; label: string; on: string; off: string }[] = [
  {
    key: 'highlights',
    label: 'Highlight legal cells',
    on: 'Picking a card lights up every cell it can go on.',
    off: 'Players find the cells for their cards themselves.',
  },
  {
    key: 'history',
    label: 'Move history',
    on: 'Everyone can read back every move in the move log.',
    off: 'Only the latest move is shown; there is no move log.',
  },
  {
    key: 'autoDrawDead',
    label: 'Auto-draw dead cards',
    on: 'A dead card is swapped for a new one when its owner’s turn starts.',
    off: 'Players swap dead cards themselves, one per turn.',
  },
];

interface RoomOptionsProps {
  value: RoomSettings;
  /** Without it the options are shown read-only. */
  onChange?: (next: RoomSettings) => void;
  disabled?: boolean;
}

/** The table's options as switches, each saying what it does in its current state. */
export function RoomOptions({ value, onChange, disabled }: RoomOptionsProps) {
  const id = useId();
  return (
    <ul className={styles.options}>
      {OPTIONS.map(({ key, label, on, off }) => (
        <li key={key}>
          <label className={styles.row}>
            <span className={styles.text}>
              <span className={styles.label} id={`${id}-${key}-label`}>
                {label}
              </span>
              <span className={styles.description} id={`${id}-${key}-description`}>
                {value[key] ? on : off}
              </span>
            </span>
            {onChange ? (
              <input
                type="checkbox"
                role="switch"
                aria-labelledby={`${id}-${key}-label`}
                aria-describedby={`${id}-${key}-description`}
                className={styles.switch}
                checked={value[key]}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
              />
            ) : (
              <span className={[styles.state, value[key] && styles.stateOn].filter(Boolean).join(' ')}>{value[key] ? 'On' : 'Off'}</span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}
