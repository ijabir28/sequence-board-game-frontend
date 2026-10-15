import { useEffect, useId, useState } from 'react';
import { isValidTurnSeconds, TURN_SECONDS_MAX, TURN_SECONDS_MIN, TURN_TIMER_PRESETS, type GameMode, type RoomSettings } from '../api/rooms';
import styles from './RoomOptions.module.css';

const MODES: { mode: GameMode; label: string; description: string }[] = [
  { mode: 'standard', label: 'Standard', description: 'The real game: no hints.' },
  { mode: 'training', label: 'Training', description: 'On your turn, get a suggested move and why.' },
];

type Flag = Exclude<keyof RoomSettings, 'mode' | 'turnSeconds'>;

/** "30 s", "1 min", "1 min 30 s". */
export function describeTurnSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

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
      <TurnTimer id={id} value={value.turnSeconds} onChange={onChange && ((turnSeconds) => onChange({ ...value, turnSeconds }))} disabled={disabled} />
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

/** The turn timer: preset lengths, or Custom with a number of seconds. */
function TurnTimer({ id, value, onChange, disabled }: { id: string; value: number; onChange?: (seconds: number) => void; disabled?: boolean }) {
  const isPreset = (TURN_TIMER_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    // Follow changes made elsewhere (for example another device saving the host's settings).
    setDraft(String(value));
    if (!isPreset) setCustom(true);
  }, [value, isPreset]);

  if (!onChange) {
    return (
      <p className={styles.row}>
        <span className={styles.text}>
          <span className={styles.label}>Turn timer</span>
          <span className={styles.description}>Each player has {describeTurnSeconds(value)} per turn.</span>
        </span>
        <span className={[styles.state, styles.stateOn].join(' ')}>{describeTurnSeconds(value)}</span>
      </p>
    );
  }

  const seconds = Number(draft);
  const invalid = custom && !isValidTurnSeconds(seconds);
  return (
    <fieldset className={styles.timer} disabled={disabled}>
      <legend className={styles.label}>Turn timer</legend>
      <div className={styles.pills}>
        {TURN_TIMER_PRESETS.map((preset) => (
          <label key={preset} className={styles.pill}>
            <input
              type="radio"
              name={`${id}-timer`}
              checked={!custom && value === preset}
              onChange={() => {
                setCustom(false);
                onChange(preset);
              }}
            />
            <span>{describeTurnSeconds(preset)}</span>
          </label>
        ))}
        <label className={styles.pill}>
          <input type="radio" name={`${id}-timer`} checked={custom} onChange={() => setCustom(true)} />
          <span>Custom</span>
        </label>
      </div>
      {custom && (
        <label className={styles.custom}>
          <input
            className={styles.seconds}
            type="number"
            inputMode="numeric"
            min={TURN_SECONDS_MIN}
            max={TURN_SECONDS_MAX}
            step={1}
            value={draft}
            aria-invalid={invalid || undefined}
            aria-describedby={`${id}-timer-help`}
            onChange={(e) => {
              setDraft(e.target.value);
              const next = Number(e.target.value);
              if (isValidTurnSeconds(next)) onChange(next);
            }}
          />
          <span>seconds per turn</span>
        </label>
      )}
      <span id={`${id}-timer-help`} className={[styles.description, invalid && styles.invalid].filter(Boolean).join(' ')}>
        {invalid
          ? `Enter a whole number of seconds from ${TURN_SECONDS_MIN} to ${TURN_SECONDS_MAX}.`
          : `Each player has ${describeTurnSeconds(value)} per turn.`}
      </span>
    </fieldset>
  );
}
