import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { PoweredBy } from '../components/PoweredBy';
import { devToolsEnabled } from '../components/game/DevAdapterToggle';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { tipProps } from '../components/ui/TooltipLayer';
import styles from './Forms.module.css';
import { JoinTableDialog } from './JoinTableDialog';
import own from './Lobby.module.css';
import { NewGameDialog } from './NewGameDialog';
import { CurrentGame, YourTablesDialog } from './YourTables';

/** The dashboard: start or join a game. Each flow opens in its own dialog, so the page stays uncluttered. */
export function Lobby() {
  const { profile } = useAuth();
  const navigate = useNavigate();
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
              <p>Find an opponent with Quick Match, start a new game and invite friends with its code, or join a table someone shared with you.</p>
            </header>
            <div className={own.primaryActions}>
              <Button variant="primary" onClick={() => navigate('/quick-match')} tip="Play someone new now: no code to share, and a bot steps in if nobody else is looking">
                <Icon name="bolt" size={18} />
                Quick Match
              </Button>
              <Button onClick={() => setDialog('new')} tip="Open a new table, pick its teams and settings, then share its code">
                <Icon name="plus" size={18} />
                New Game
              </Button>
              <Button onClick={() => setDialog('join')} tip="Enter the code or link a friend shared to take a seat at their table">
                <Icon name="users" size={18} />
                Join a table
              </Button>
            </div>
            <div className={own.secondaryActions}>
              <div className={own.secondaryButtons}>
                <Button variant="ghost" onClick={() => setDialog('tables')} tip="Tables you opened or sat at, to go back to any game">
                  <Icon name="log" size={18} />
                  Your tables
                </Button>
                <Link to="/leaderboard" className={own.leaderboardLink} {...tipProps('See where you rank: ratings, wins and win rates')}>
                  <Icon name="trophy" size={18} />
                  Leaderboard
                </Link>
              </div>
              <p className={own.local}>
                No server, one screen? <Link to="/local" {...tipProps('Hot-seat game: everyone shares this screen and passes it round')}>
                  Play on this device
                </Link>
              </p>
            </div>
          </section>

          {devToolsEnabled() && (
            <section className={[styles.card, own.dev].join(' ')}>
              <header className={styles.header}>
                <h2>Server test game</h2>
                <p>Developer tool. Opens the server's built-in test game: one shared board with four fixed players.</p>
              </header>
              <Link to="/server-game" className={own.linkButton} {...tipProps("Developer tool: open the server's built-in test game")}>
                Open server game
              </Link>
            </section>
          )}
        </div>
        <PoweredBy />
      </div>

      <NewGameDialog open={dialog === 'new'} onClose={() => setDialog(null)} />
      <JoinTableDialog open={dialog === 'join'} onClose={() => setDialog(null)} />
      <YourTablesDialog open={dialog === 'tables'} onClose={() => setDialog(null)} />
    </>
  );
}
