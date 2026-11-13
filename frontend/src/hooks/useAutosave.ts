import { useEffect, useRef, useState } from 'react';
import { drafts } from '../lib/offline';

/**
 * Autoguarda un borrador en IndexedDB con debounce de 800 ms.
 * Devuelve el borrador previo (si existe) para que el usuario pueda retomarlo.
 */
export function useAutosave<T>(key: string, value: T, delayMs = 800) {
  const [restored, setRestored] = useState<T | undefined>(undefined);
  const firstRun = useRef(true);

  useEffect(() => {
    void drafts.load<T>(key).then((saved) => setRestored(saved));
  }, [key]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void drafts.save(key, value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [key, value, delayMs]);

  const discard = () => drafts.clear(key);
  return { restored, discard };
}
