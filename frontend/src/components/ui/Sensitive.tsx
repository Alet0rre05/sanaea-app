import type { ReactNode } from 'react';
import { usePreferences } from '../../context/PreferencesContext';

/** Envuelve datos personales o montos: se difuminan cuando el modo privacidad está activo. */
export function Sensitive({ children }: { children: ReactNode }) {
  const { blurPrivate } = usePreferences();
  return <span className={blurPrivate ? 'sensitive-blur' : undefined}>{children}</span>;
}
