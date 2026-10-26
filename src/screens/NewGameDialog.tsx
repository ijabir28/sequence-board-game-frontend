import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { createRoom } from '../api/rooms';
import { useToast } from '../components/toast/Toaster';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Icon } from '../components/ui/Icon';
import styles from './Forms.module.css';

/** A new table starts as 2 teams of 1; the host changes its size and settings at the table, until the game starts. */
const NEW_TABLE = { teamCount: 2, playersPerTeam: 1 };

/**
 * "Open a new table": only the name, since the table's code is made from it and never changes. Everything else is set
 * at the table, so opening one is quick.
 */
export function NewGameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const formId = useId();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    toast.dismiss('new-game');
    try {
      const id = await createRoom(NEW_TABLE.teamCount, NEW_TABLE.playersPerTeam, { name });
      navigate(`/table/${id}`);
    } catch (e) {
      toast.error(errorMessage(e), { id: 'new-game' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Open a new table"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} tip="Close without opening a table">
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" busy={creating} tip="Open the table and take you to it, ready to share its code">
            <Icon name="plus" size={18} />
            Create table
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.dialogForm} onSubmit={create}>
        <p className={styles.help}>Pick the teams and settings at the table, any time before the game starts.</p>
        <label className={styles.field}>
          <span className={styles.label}>Table name</span>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="off"
            data-autofocus
            placeholder="Friday night"
            aria-describedby={`${formId}-name-help`}
          />
          <span className={styles.help} id={`${formId}-name-help`}>
            Optional. The table's code is made from its name. Leave it blank for a random one.
          </span>
        </label>
      </form>
    </Dialog>
  );
}
