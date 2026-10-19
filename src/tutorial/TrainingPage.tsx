import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import backStyles from '../components/BackToDashboard.module.css';
import { GameScreen } from '../components/game/GameScreen';
import { PoweredBy } from '../components/PoweredBy';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import forms from '../screens/Forms.module.css';
import { Coach } from './Coach';
import { LESSONS } from './lessons';
import { useTrainingProgress } from './progress';
import { Quiz } from './Quiz';
import { TutorialAdapter } from './TutorialAdapter';
import styles from './Training.module.css';

const FINISHED = LESSONS.length;

/** /how-to-play/training: the lessons, one at a time, against the Bot on this device. */
export function TrainingPage() {
  // null: the list of lessons; FINISHED: the end of the training.
  const [index, setIndex] = useState<number | null>(null);
  // A new attempt sets the lesson up again.
  const [attempt, setAttempt] = useState(0);
  const { done, markDone, reset } = useTrainingProgress();
  const { profile } = useAuth();
  const playerName = profile?.name || 'Player';
  const lesson = index !== null ? LESSONS[index] : undefined;

  const adapter = useMemo(() => (lesson?.kind === 'board' ? new TutorialAdapter(lesson, { playerName }) : null), [lesson, attempt]);
  useEffect(() => () => adapter?.dispose(), [adapter]);

  const open = (next: number | null) => {
    setIndex(next);
    setAttempt((a) => a + 1);
    window.scrollTo(0, 0);
  };
  const lessonId = lesson?.id;
  const onDone = useCallback(() => lessonId && markDone(lessonId), [lessonId, markDone]);

  if (lesson && index !== null) {
    const shared = { number: index + 1, total: LESSONS.length, onDone, onNext: () => open(index + 1), onLessons: () => open(null) };
    if (lesson.kind === 'quiz') return <Quiz key={attempt} lesson={lesson} {...shared} />;
    if (adapter) {
      return (
        <GameScreen
          key={attempt}
          adapter={adapter}
          modeLabel="Training"
          onExit={() => open(null)}
          onNewGame={() => open(index)}
          handOrderKey="training"
          coach={<Coach adapter={adapter} {...shared} onRestart={() => open(index)} />}
        />
      );
    }
  }

  const next = LESSONS.findIndex((l) => !done.includes(l.id));
  return (
    <>
      <AppHeader />
      <div className={forms.page}>
        <nav className={[backStyles.back, styles.back].join(' ')} aria-label="Back">
          <Link to="/how-to-play" className={backStyles.link} {...tipProps('Go back to the rules, step by step', 'bottom', 'start')}>
            <Icon name="chevronLeft" size={18} />
            How to play
          </Link>
        </nav>
        <div className={[forms.card, styles.overview].join(' ')}>
          {index === FINISHED ? (
            <header className={forms.header}>
              <h1>Training complete</h1>
              <p>You have played every rule that decides games: half-taken cards, corners, both kinds of jack, locked chips, dead cards and the winning second sequence. You are ready for a live table.</p>
            </header>
          ) : (
            <header className={forms.header}>
              <h1>Training</h1>
              <p>
                Learn by playing: {LESSONS.length} short lessons against the Bot, on the real board with the real rules. Each one sets a rule
                that catches new players out; a move that misses it is turned down with the reason. Nothing is saved to your account.
              </p>
            </header>
          )}
          <ol className={styles.lessons}>
            {LESSONS.map((l, i) => {
              const finished = done.includes(l.id);
              return (
                <li key={l.id}>
                  <button type="button" className={styles.lesson} data-done={finished || undefined} onClick={() => open(i)} {...tipProps(l.goal, 'top')}>
                    <span className={styles.lessonNumber} aria-hidden="true">
                      {finished ? <Icon name="check" size={14} /> : i + 1}
                    </span>
                    <span className={styles.lessonText}>
                      <strong>{l.title}</strong>
                      <small>{l.kind === 'quiz' ? `${l.questions.length} questions` : l.id === 'match' ? 'A full game against the Bot' : l.goal}</small>
                    </span>
                    <span className="visually-hidden">{finished ? '(done)' : ''}</span>
                    <Icon name="chevronRight" size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={styles.overviewActions}>
            {done.length > 0 && (
              <Button variant="ghost" onClick={reset} tip="Forget which lessons are done on this device">
                Reset progress
              </Button>
            )}
            {index === FINISHED || next === -1 ? (
              <Link to="/lobby" className={styles.cta}>
                Play a live game
                <Icon name="chevronRight" size={16} />
              </Link>
            ) : (
              <Button variant="primary" onClick={() => open(next)}>
                {done.length === 0 ? 'Start training' : `Continue: ${LESSONS[next].title}`}
                <Icon name="chevronRight" size={16} />
              </Button>
            )}
          </div>
        </div>
        <PoweredBy />
      </div>
    </>
  );
}
