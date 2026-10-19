import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { formatTableCode, getRoom, parseTableCode } from '../api/rooms';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/toast/Toaster';
import styles from './Forms.module.css';

/** "Join a table": enter the code or link a friend shared, and go to that table. */
export function JoinTableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const formId = useId();
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  // Where the caret goes after a re-format, so typing in the middle of a code doesn't throw it to the end.
  const caret = useRef<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setFormError] = useState<string | null>(null);
  const toast = useToast();
  // The message floats as a toast; the field stays marked until the next try.
  const setError = (text: string | null) => {
    setFormError(text);
    if (text) toast.error(text, { id: 'join-table' });
    else toast.dismiss('join-table');
  };

  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    input.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [code]);

  const update = (next: string, at: number) => {
    caret.current = at;
    setCode(next);
    if (error) setError(null);
  };

  // Spaces and other separators become single hyphens, and letters lower-case, as the player types.
  const type = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = event.target;
    const before = value.slice(0, selectionStart ?? value.length);
    update(formatTableCode(value), formatTableCode(before).length);
  };

  // A whole code or link pasted in is read the way "Find table" reads it (a link becomes its code, an older
  // numeric code keeps its digits together); anything else is formatted like typing.
  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const whole = field.value.slice(0, field.selectionStart ?? 0) + event.clipboardData.getData('text') + field.value.slice(field.selectionEnd ?? field.value.length);
    const parsed = parseTableCode(whole);
    if (!parsed) return;
    event.preventDefault();
    update(parsed, parsed.length);
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const id = parseTableCode(code);
    if (!id) {
      setError('Table codes are lower-case words and numbers joined by hyphens, like friday-night-k3m9. You can also paste a table link.');
      return;
    }
    if (id !== code) setCode(id);
    setJoining(true);
    setError(null);
    try {
      const room = await getRoom(id);
      if (!room) setError(`There is no table with code ${id}. Check the code, or start a new game.`);
      else navigate(`/table/${id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setJoining(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Join a table"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} tip="Close without joining">
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" busy={joining} tip="Look up the table and take you to it, to pick a seat">
            Find table
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} onSubmit={join} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Table code or link</span>
          <input
            ref={input}
            className={`${styles.input} ${styles.code}`}
            value={code}
            onChange={type}
            onPaste={paste}
            onBlur={() => setCode((typed) => formatTableCode(typed, true))}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={200}
            data-autofocus
            placeholder="friday-night-k3m9"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${formId}-help`}
          />
          <span className={styles.help} id={`${formId}-help`}>
            Enter the code or paste the link a friend shared with you. Spaces turn into hyphens as you type.
          </span>
        </label>
      </form>
    </Dialog>
  );
}
