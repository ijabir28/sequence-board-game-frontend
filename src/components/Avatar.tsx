import styles from './Avatar.module.css';

// One of the three team colours, picked from the handle, so a player's initials always sit on the same colour.
export function avatarTeam(handle: string): number {
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 3;
}

/** Up to two letters for a display name: "Jabir ibne kamal" → "JI", "sakib" → "S". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? '')
    .join('');
}

/** A player's picture, or their initials on a colour when they have none. Decorative: the name is always beside it. */
export function Avatar({ name, handle, image, size = 32 }: { name: string; handle: string; image: string | null; size?: number }) {
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `var(--team-${avatarTeam(handle)})`,
        color: `var(--team-${avatarTeam(handle)}-ink)`,
      }}
      aria-hidden="true"
    >
      {image ? <img src={image} alt="" width={size} height={size} draggable={false} /> : initials(name)}
    </span>
  );
}
