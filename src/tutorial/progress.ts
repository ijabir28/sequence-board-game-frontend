import { useCallback, useState } from 'react';

const KEY = 'sequence:training-done';

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage: the progress still holds for this visit.
  }
}

/** The training lessons finished on this device. */
export function useTrainingProgress() {
  const [done, setDone] = useState<string[]>(read);
  const markDone = useCallback((id: string) => {
    setDone((ids) => {
      if (ids.includes(id)) return ids;
      const next = [...ids, id];
      write(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    write([]);
    setDone([]);
  }, []);
  return { done, markDone, reset };
}
