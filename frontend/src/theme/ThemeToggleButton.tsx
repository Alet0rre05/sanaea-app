import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { themeController, type Theme } from './ThemeController';

/** Botón Sol/Luna con animación vectorial. No se puede presionar durante la transición. */
export function ThemeToggleButton() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(themeController.current());
  const [busy, setBusy] = useState(false);

  useEffect(() => themeController.subscribe(setTheme), []);

  const handleClick = () => {
    if (busy) return;
    if (themeController.toggle()) {
      setBusy(true);
      window.setTimeout(() => setBusy(false), 260);
    }
  };

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isDark}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface transition hover:scale-105 disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform duration-300" aria-hidden="true"
        style={{ transform: isDark ? 'rotate(360deg)' : 'rotate(0deg)' }}>
        {isDark ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line key={deg} x1="12" y1="2" x2="12" y2="4.5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" transform={`rotate(${deg} 12 12)`} />
            ))}
          </>
        )}
      </svg>
    </button>
  );
}
