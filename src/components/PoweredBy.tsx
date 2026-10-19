import styles from './PoweredBy.module.css';

/** The ownership line, with the year it is read in, so it never needs a yearly edit. */
export function creditLine(now: Date = new Date()): string {
  return `Powered by Fifteen’s Inc. © ${now.getFullYear()}`;
}

/** A quiet credit at the foot of a page or menu. */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <footer className={[styles.credit, className].filter(Boolean).join(' ')}>
      <small>{creditLine()}</small>
    </footer>
  );
}
