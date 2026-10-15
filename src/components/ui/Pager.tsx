import { Button } from './Button';
import { Icon } from './Icon';
import styles from './Pager.module.css';

interface PagerProps {
  page: number;
  pages: number;
  /** What is being paged, for screen readers, e.g. "tables". */
  label: string;
  busy?: boolean;
  onPage: (page: number) => void;
}

/** Previous / next with "Page 2 of 5". Hidden when everything fits on one page. */
export function Pager({ page, pages, label, busy, onPage }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label={`Pages of ${label}`}>
      <Button size="sm" variant="ghost" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <Icon name="chevronLeft" size={16} />
        Previous
      </Button>
      <span className={styles.position} aria-live="polite">
        Page {page} of {pages}
      </span>
      <Button size="sm" variant="ghost" disabled={page >= pages || busy} onClick={() => onPage(page + 1)} aria-label="Next page">
        Next
        <Icon name="chevronRight" size={16} />
      </Button>
    </nav>
  );
}
