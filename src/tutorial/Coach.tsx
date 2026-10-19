import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import { useGame } from '../game/useGame';
import { useMediaQuery } from '../game/useMediaQuery';
import type { TutorialAdapter } from './TutorialAdapter';
import styles from './Training.module.css';

interface CoachProps {
  adapter: TutorialAdapter;
  number: number;
  total: number;
  onDone: () => void;
  onNext: () => void;
  onRestart: () => void;
  onLessons: () => void;
}

/** The lesson's task over the turn panel, then what it taught and the way on. */
export function Coach({ adapter, number, total, onDone, onNext, onRestart, onLessons }: CoachProps) {
  // Re-renders with every move, which is when the task may get done.
  const view = useGame(adapter);
  const { lesson, done } = adapter;
  const phone = useMediaQuery('(max-width: 600px)');
  const [ruleOpen, setRuleOpen] = useState(!phone);

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  return (
    <section className={styles.coach} data-done={done || undefined} aria-label="Lesson" aria-live="polite">
      <div className={styles.coachHead}>
        <span className={styles.coachStep}>
          {done ? <Icon name="check" size={14} /> : null}
          {number}/{total}
        </span>
        <strong className={styles.coachTitle}>{lesson.title}</strong>
        <button type="button" className={styles.coachIcon} onClick={onRestart} aria-label="Restart lesson" {...tipProps('Set the lesson up again from the start', 'bottom', 'end')}>
          <Icon name="refresh" size={16} />
        </button>
        <button type="button" className={styles.coachIcon} onClick={onLessons} aria-label="All lessons" {...tipProps('Leave the lesson for the list of lessons', 'bottom', 'end')}>
          <Icon name="book" size={16} />
        </button>
      </div>
      <p className={styles.coachGoal}>{done ? lesson.success : lesson.goal}</p>
      {done && view.winner === null && <p className={styles.coachRule}>Keep playing this position against the Bot if you like, or go on.</p>}
      {!done && (
        <>
          <button type="button" className={styles.coachToggle} aria-expanded={ruleOpen} onClick={() => setRuleOpen((open) => !open)}>
            <Icon name="bulb" size={14} />
            {ruleOpen ? 'Hide the rule' : 'The rule'}
          </button>
          {ruleOpen && <p className={styles.coachRule}>{lesson.rule}</p>}
        </>
      )}
      {done && (
        <div className={styles.coachActions}>
          <Button size="sm" variant="ghost" onClick={onRestart}>
            Play it again
          </Button>
          <Button size="sm" variant="primary" onClick={onNext}>
            {number === total ? 'Finish training' : 'Next lesson'}
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      )}
    </section>
  );
}
