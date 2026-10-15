import { useId } from 'react';
import type { GameMode, RoomSettings } from '../api/rooms';
import styles from './RoomOptions.module.css';

const MODES: { mode: GameMode; label: string; description: string }[] = [
  { mode: 'standard', label: 'Standard', description: 'The real game: no hints.' },
  { mode: 'training', label: 'Training', description: 'On your turn, get a suggested move and why.' },
];

type Flag = Exclude<keyof RoomSettings, 'mode'>;

const OPTIONS: { key: Flag; label: string; on: string; off: string }[] = [
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
    <div className={styles.group}>
      <div className={styles.modes} role="radiogroup" aria-label="Game mode">
        {MODES.map(({ mode, label, description }) => {
          const active = value.mode === mode;
          return onChange ? (
            <label key={mode} className={styles.mode}>
              <input
                type="radio"
                name={`${id}-mode`}
                checked={active}
                disabled={disabled}
                onChange={() => onChange({ ...value, mode })}
              />
              <span className={styles.modeCard}>
                <span className={styles.label}>{label}</span>
                <span className={styles.description}>{description}</span>
              </span>
            </label>
          ) : (
            active && (
              <p key={mode} className={styles.modeCard} data-active="true">
                <span className={styles.label}>{label} mode</span>
                <span className={styles.description}>{description}</span>
              </p>
            )
          );
        })}
      </div>
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
    </div>
  );
}
