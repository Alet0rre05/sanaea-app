/**
 * ThemeController (singleton).
 *
 * - Aplica la clase `dark` en <html>.
 * - Durante 260 ms aplica `.theme-transitioning` para que inputs, cards y bordes
 *   cambien al mismo instante.
 * - Bloquea cambios concurrentes: mientras dura la transición, `set()` devuelve false.
 */
export type Theme = 'light' | 'dark';

const LOCK_MS = 260;
const STORAGE_KEY = 'ajr-theme';

type Listener = (theme: Theme) => void;

class ThemeController {
  private static instance: ThemeController | null = null;
  private busy = false;
  private readonly listeners = new Set<Listener>();

  private constructor() {}

  static get(): ThemeController {
    if (!ThemeController.instance) ThemeController.instance = new ThemeController();
    return ThemeController.instance;
  }

  current(): Theme {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  isBusy(): boolean {
    return this.busy;
  }

  set(theme: Theme): boolean {
    if (this.busy) return false;
    if (theme === this.current()) return true;

    this.busy = true;
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* almacenamiento no disponible: el tema igual se aplica */
    }
    this.listeners.forEach((listener) => listener(theme));

    window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
      this.busy = false;
    }, LOCK_MS);
    return true;
  }

  toggle(): boolean {
    return this.set(this.current() === 'dark' ? 'light' : 'dark');
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Aplica el tema guardado o el del sistema, sin transición. */
  init(): void {
    let saved: Theme | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    } catch {
      saved = null;
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme: Theme = saved ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

export const themeController = ThemeController.get();
