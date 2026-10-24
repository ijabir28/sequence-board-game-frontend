import { useEffect, useState } from 'react';

/** Whether a CSS media query matches, kept up to date as the window changes (false where matchMedia is missing). */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Phones and touch screens: no Escape key to mention in a close button's tip. */
export const NO_ESC_KEY = '(pointer: coarse), (max-width: 600px)';
