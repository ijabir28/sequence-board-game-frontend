import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { devToolsEnabled } from '../components/game/DevAdapterToggle';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import styles from './Forms.module.css';
import { JoinTableDialog } from './JoinTableDialog';
import own from './Lobby.module.css';
import { NewGameDialog } from './NewGameDialog';
import { CurrentGame, YourTablesDialog } from './YourTables';

/** The dashboard: start or join a game. Each flow opens in its own dialog, so the page stays uncluttered. */
export function Lobby() {
  const { profile } = useAuth();
  const [dialog, setDialog] = useState<'new' | 'join' | 'tables' | null>(null);

  return (
    <>
      <AppHeader />
      <div className={styles.page}>
        <div className={own.grid}>
          <CurrentGame />

          <section className={[styles.card, own.hero].join(' ')} aria-labelledby="lobby-title">
            <header className={styles.header}>
              <h1 id="lobby-title">{profile ? `Ready to play, ${profile.name}?` : 'Ready to play?'}</h1>
              <p>Start a new game and invite friends with its code, or join a table someone shared with you.</p>
            </header>
            <div className={own.primaryActions}>
              <Button variant="primary" onClick={() => setDialog('new')}>
                <Icon name="plus" size={18} />
                New Game
              </Button>
              <Button onClick={() => setDialog('join')}>
                <Icon name="users" size={18} />
                Join a table
              </Button>
            </div>
            <div className={own.secondaryActions}>
              <Button variant="ghost" onClick={() => setDialog('tables')}>
                <Icon name="log" size={18} />
                Your tables
              </Button>
              <p className={own.local}>
                No server, one screen? <Link to="/local">Play on this device</Link>
              </p>
            </div>
          </section>

          {devToolsEnabled() && (
            <section className={[styles.card, own.dev].join(' ')}>
              <header className={styles.header}>
                <h2>Server test game</h2>
                <p>Developer tool. Opens the server's built-in test game: one shared board with four fixed players.</p>
              </header>
              <Link to="/server-game" className={own.linkButton}>
                Open server game
              </Link>
            </section>
          )}
        </div>
      </div>

      <NewGameDialog open={dialog === 'new'} onClose={() => setDialog(null)} />
      <JoinTableDialog open={dialog === 'join'} onClose={() => setDialog(null)} />
      <YourTablesDialog open={dialog === 'tables'} onClose={() => setDialog(null)} />
    </>
  );
}
