import { useState } from 'react';

/**
 * Hook tracking the most recently opened project. The id and a
 * timestamp are stored in localStorage to survive page reloads.
 */
export function useLastOpened() {
  const idKey = 'stoneTrail:lastOpened';
  const tsKey = 'stoneTrail:lastOpenedAt';
  const [last, setLast] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = localStorage.getItem(idKey);
    return stored || undefined;
  });

  const update = (id: string) => {
    try {
      localStorage.setItem(idKey, id);
      localStorage.setItem(tsKey, new Date().toISOString());
      setLast(id);
    } catch {
      // ignore storage errors
    }
  };
  return { last, update };
}