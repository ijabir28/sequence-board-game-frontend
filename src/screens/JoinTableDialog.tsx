import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { getRoom, parseTableCode } from '../api/rooms';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import styles from './Forms.module.css';

/** "Join a table": enter the code or link a friend shared, and go to that table. */
export function JoinTableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const formId = useId();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const id = parseTableCode(code);
    if (!id) {
      setError('Table codes are lower-case words and numbers joined by hyphens, like friday-night-k3m9. You can also paste a table link.');
      return;
    }
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
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" busy={joining}>
            Find table
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} onSubmit={join} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Table code or link</span>
          <input
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            data-autofocus
            placeholder="friday-night-k3m9"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${formId}-error` : `${formId}-help`}
          />
          <span className={styles.help} id={`${formId}-help`}>
            Enter the code or paste the link a friend shared with you.
          </span>
        </label>
        {error && (
          <p className={styles.error} role="alert" id={`${formId}-error`}>
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </p>
        )}
      </form>
    </Dialog>
  );
}
