import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { tipProps } from './ui/TooltipLayer';
import styles from './BackToDashboard.module.css';

/** "Back to dashboard", above everything on a page, so leaving it never means hunting for the logo. */
export function BackToDashboard({ tip = 'Go back to the dashboard', className }: { tip?: string; className?: string }) {
  return (
    <nav className={[styles.back, className].filter(Boolean).join(' ')} aria-label="Back">
      <Link to="/lobby" className={styles.link} {...tipProps(tip, 'bottom', 'start')}>
        <Icon name="chevronLeft" size={18} />
        Back to dashboard
      </Link>
    </nav>
  );
}
