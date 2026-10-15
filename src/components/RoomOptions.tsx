import { useEffect, useId, useState } from 'react';
import {
  EXCHANGES_PER_TURN_MAX,
  EXCHANGES_PER_TURN_MIN,
  isValidExchangesPerTurn,
  isValidTurnSeconds,
  TURN_SECONDS_MAX,
  TURN_SECONDS_MIN,
  TURN_TIMER_PRESETS,
  type DeadCardMode,
  type GameMode,
  type RoomSettings,
} from '../api/rooms';
import { tipProps } from './ui/TooltipLayer';
import styles from './RoomOptions.module.css';

const MODES: { mode: GameMode; label: string; description: string }[] = [
  { mode: 'standard', label: 'Standard', description: 'The real game: no hints.' },
  { mode: 'training', label: 'Training', description: 'On your turn, get a suggested move and why.' },
];

type Flag = Exclude<keyof RoomSettings, 'mode' | 'turnSeconds' | 'deadCards' | 'exchangesPerTurn'>;

const DEAD_CARD_MODES: { mode: DeadCardMode; label: string; description: string }[] = [
  {
    mode: 'manual',
    label: 'Players spot them',
    description: 'Nothing marks dead cards. A player who finds one asks to exchange it, and the table checks it.',
  },
  { mode: 'indicator', label: 'Mark them', description: 'Dead cards are marked in the hand, so nobody misses one.' },
];

/** "1 dead card", "3 dead cards", "Any number of dead cards". */
export function describeExchanges(count: number | null): string {
  if (count === null) return 'Any number of dead cards';
  return count === 1 ? '1 dead card' : `${count} dead cards`;
}

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
    on: 'Marked dead cards are swapped for new ones when their owner’s turn starts.',
    off: 'Players swap marked dead cards themselves.',
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
            <label key={mode} className={styles.mode} {...tipProps(`${label} mode: ${description}`, 'top')}>
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
      <DeadCards id={id} value={value} onChange={onChange} disabled={disabled} />
      <ul className={styles.options}>
      {OPTIONS.filter(({ key }) => key !== 'autoDrawDead' || value.deadCards === 'indicator').map(({ key, label, on, off }) => (
        <li key={key}>
          <label className={styles.row} {...(onChange ? tipProps(`Turn ${value[key] ? 'off' : 'on'}: ${value[key] ? off : on}`, 'top', 'end') : {})}>
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

/** How dead cards are found, and how many a player may exchange per turn: 1, Unlimited, or Custom. */
function DeadCards({ id, value, onChange, disabled }: { id: string; value: RoomSettings; onChange?: (next: RoomSettings) => void; disabled?: boolean }) {
  const limit = value.exchangesPerTurn;
  const [custom, setCustom] = useState(limit !== null && limit !== 1);
  const [draft, setDraft] = useState(String(limit ?? 2));
  useEffect(() => {
    // Follow changes made elsewhere (for example another device saving the host's settings).
    if (limit !== null) setDraft(String(limit));
    if (limit !== null && limit !== 1) setCustom(true);
  }, [limit]);

  const mode = DEAD_CARD_MODES.find((m) => m.mode === value.deadCards) ?? DEAD_CARD_MODES[0];
  if (!onChange) {
    return (
      <>
        <p className={styles.row}>
          <span className={styles.text}>
            <span className={styles.label}>Dead cards</span>
            <span className={styles.description}>{mode.description}</span>
          </span>
          <span className={[styles.state, styles.stateOn].join(' ')}>{value.deadCards === 'manual' ? 'Spot' : 'Marked'}</span>
        </p>
        <p className={styles.row}>
          <span className={styles.text}>
            <span className={styles.label}>Dead card exchanges</span>
            <span className={styles.description}>{describeExchanges(limit)} per turn can be swapped for new ones.</span>
          </span>
          <span className={[styles.state, styles.stateOn].join(' ')}>{limit === null ? 'Unlimited' : `${limit} per turn`}</span>
        </p>
      </>
    );
  }

  const count = Number(draft);
  const invalid = custom && !isValidExchangesPerTurn(count);
  return (
    <>
      <fieldset className={styles.timer} disabled={disabled}>
        <legend className={styles.label}>Dead cards</legend>
        <div className={styles.pills}>
          {DEAD_CARD_MODES.map((m) => (
            <label key={m.mode} className={styles.pill} {...tipProps(m.description, 'top')}>
              <input type="radio" name={`${id}-dead`} checked={value.deadCards === m.mode} onChange={() => onChange({ ...value, deadCards: m.mode })} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <span className={styles.description}>{mode.description}</span>
      </fieldset>
      <fieldset className={styles.timer} disabled={disabled}>
        <legend className={styles.label}>Dead card exchanges per turn</legend>
        <div className={styles.pills}>
          <label className={styles.pill} {...tipProps('Each player may exchange one dead card per turn', 'top')}>
            <input
              type="radio"
              name={`${id}-exchanges`}
              checked={!custom && limit === 1}
              onChange={() => {
                setCustom(false);
                onChange({ ...value, exchangesPerTurn: 1 });
              }}
            />
            <span>1</span>
          </label>
          <label className={styles.pill} {...tipProps('Players may exchange every dead card they hold, each turn', 'top')}>
            <input
              type="radio"
              name={`${id}-exchanges`}
              checked={!custom && limit === null}
              onChange={() => {
                setCustom(false);
                onChange({ ...value, exchangesPerTurn: null });
              }}
            />
            <span>Unlimited</span>
          </label>
          <label className={styles.pill} {...tipProps(`Set your own limit, from ${EXCHANGES_PER_TURN_MIN} to ${EXCHANGES_PER_TURN_MAX} per turn`, 'top')}>
            <input
              type="radio"
              name={`${id}-exchanges`}
              checked={custom}
              onChange={() => {
                setCustom(true);
                if (isValidExchangesPerTurn(count)) onChange({ ...value, exchangesPerTurn: count });
              }}
            />
            <span>Custom</span>
          </label>
        </div>
        {custom && (
          <label className={styles.custom}>
            <input
              className={styles.seconds}
              type="number"
              inputMode="numeric"
              min={EXCHANGES_PER_TURN_MIN}
              max={EXCHANGES_PER_TURN_MAX}
              step={1}
              value={draft}
              aria-invalid={invalid || undefined}
              aria-describedby={`${id}-exchanges-help`}
              onChange={(e) => {
                setDraft(e.target.value);
                const next = Number(e.target.value);
                if (isValidExchangesPerTurn(next)) onChange({ ...value, exchangesPerTurn: next });
              }}
            />
            <span>dead cards per turn</span>
          </label>
        )}
        <span id={`${id}-exchanges-help`} className={[styles.description, invalid && styles.invalid].filter(Boolean).join(' ')}>
          {invalid
            ? `Enter a whole number from ${EXCHANGES_PER_TURN_MIN} to ${EXCHANGES_PER_TURN_MAX}.`
            : `${describeExchanges(limit)} per turn can be swapped for new ones, before playing.`}
        </span>
      </fieldset>
    </>
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
          <span className={styles.description}>
            Each player has {describeTurnSeconds(value)} per turn; then a random card is played for them.
          </span>
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
          <label key={preset} className={styles.pill} {...tipProps(`${describeTurnSeconds(preset)} per turn`, 'top')}>
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
        <label className={styles.pill} {...tipProps(`Set your own length, from ${describeTurnSeconds(TURN_SECONDS_MIN)} to ${describeTurnSeconds(TURN_SECONDS_MAX)}`, 'top')}>
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
          : `Each player has ${describeTurnSeconds(value)} per turn. When it runs out, a random card from their hand is played for them.`}
      </span>
    </fieldset>
  );
}
