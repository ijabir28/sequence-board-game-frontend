import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { tipProps } from './ui/TooltipLayer';
import styles from './BackToDashboard.module.css';

/**
 * "Back to dashboard", above everything on a page, so leaving it never means hunting for the logo. `to` and `label`
 * point it elsewhere for signed-out players, who have no dashboard.
 */
export function BackToDashboard({
  tip = 'Go back to the dashboard',
  className,
  to = '/lobby',
  label = 'Back to dashboard',
}: {
  tip?: string;
  className?: string;
  to?: string;
  label?: string;
}) {
  return (
    <nav className={[styles.back, className].filter(Boolean).join(' ')} aria-label="Back">
      <Link to={to} className={styles.link} {...tipProps(tip, 'bottom', 'start')}>
        <Icon name="chevronLeft" size={18} />
        {label}
      </Link>
    </nav>
  );
}
