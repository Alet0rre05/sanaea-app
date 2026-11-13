import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ViewMode = 'simple' | 'detailed';

interface Preferences {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  blurPrivate: boolean;
  setBlurPrivate: (value: boolean) => void;
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Vista Simple / Detallada y modo Blur Privacidad. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [blurPrivate, setBlurPrivate] = useState(false);

  const value = useMemo(
    () => ({ viewMode, setViewMode, blurPrivate, setBlurPrivate }),
    [viewMode, blurPrivate],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences debe usarse dentro de PreferencesProvider');
  return ctx;
}
