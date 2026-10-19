import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import forms from '../screens/Forms.module.css';
import type { QuizLesson } from './lessons';
import styles from './Training.module.css';

interface QuizProps {
  lesson: QuizLesson;
  number: number;
  total: number;
  onDone: () => void;
  onNext: () => void;
  onLessons: () => void;
}

/** The rules that can't be staged on the board, as questions. A wrong pick explains itself; pick again. */
export function Quiz({ lesson, number, total, onDone, onNext, onLessons }: QuizProps) {
  // Every pick per question, in order; the question is answered once the right one is among them.
  const [picks, setPicks] = useState<number[][]>(() => lesson.questions.map(() => []));
  const answered = lesson.questions.map((q, i) => picks[i].includes(q.answer));
  const allAnswered = answered.every(Boolean);
  const firstTime = lesson.questions.filter((q, i) => picks[i][0] === q.answer).length;

  const pick = (question: number, option: number) => {
    if (answered[question]) return;
    const next = picks.map((p, i) => (i === question ? [...p, option] : p));
    setPicks(next);
    if (lesson.questions.every((q, i) => next[i].includes(q.answer))) onDone();
  };

  return (
    <div className={forms.page}>
      <div className={[forms.card, styles.quiz].join(' ')}>
        <header className={forms.header}>
          <span className={styles.coachStep}>
            {number}/{total}
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.goal}</p>
        </header>
        <ol className={styles.questions}>
          {lesson.questions.map((q, i) => (
            <li key={q.question} className={styles.question}>
              <fieldset className={forms.fieldset}>
                <legend className={styles.questionText}>{q.question}</legend>
                <div className={styles.options}>
                  {q.options.map((option, o) => {
                    const picked = picks[i].includes(o);
                    const state = picked ? (o === q.answer ? 'right' : 'wrong') : undefined;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={styles.option}
                        data-state={state}
                        aria-pressed={picked}
                        disabled={answered[i] && !picked}
                        onClick={() => pick(i, o)}
                      >
                        {state === 'right' && <Icon name="check" size={16} />}
                        {state === 'wrong' && <Icon name="close" size={16} />}
                        {option}
                      </button>
                    );
                  })}
                </div>
                {picks[i].length > 0 && (
                  <p className={styles.why} data-right={answered[i] || undefined} role="status">
                    {answered[i] ? q.why : 'Not quite. Try another answer.'}
                  </p>
                )}
              </fieldset>
            </li>
          ))}
        </ol>
        <div className={styles.quizActions}>
          <Button variant="ghost" onClick={onLessons}>
            All lessons
          </Button>
          {allAnswered && <span className={styles.score}>{firstTime} of {lesson.questions.length} right first time</span>}
          <Button variant="primary" onClick={onNext} disabled={!allAnswered} tip={allAnswered ? undefined : 'Answer every question to go on'}>
            {number === total ? 'Finish training' : 'Next lesson'}
            <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
