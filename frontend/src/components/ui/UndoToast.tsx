import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const UNDO_MS = 5000;

interface Pending {
  undo: () => void;
  commit: () => Promise<void> | void;
}

/**
 * Acciones destructivas con "Deshacer" en lugar de modales.
 * `schedule` oculta el elemento de inmediato y confirma la acción a los 5 s,
 * salvo que el usuario la deshaga antes.
 */
export function useUndoableAction() {
  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const schedule = useCallback((undo: () => void, commit: () => Promise<void> | void) => {
    clearTimer();
    pendingRef.current = { undo, commit };
    setVisible(true);
    timerRef.current = window.setTimeout(() => {
      const current = pendingRef.current;
      pendingRef.current = null;
      timerRef.current = null;
      setVisible(false);
      if (current) void current.commit();
    }, UNDO_MS);
  }, []);

  const undo = useCallback(() => {
    const current = pendingRef.current;
    pendingRef.current = null;
    clearTimer();
    setVisible(false);
    current?.undo();
  }, []);

  useEffect(() => clearTimer, []);

  return { schedule, undo, visible };
}

export function UndoToast({ visible, onUndo }: { visible: boolean; onUndo: () => void }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg md:bottom-6">
      <span className="text-sm">{t('undo.message')}</span>
      <button type="button" onClick={onUndo} className="text-sm font-semibold text-primary">
        {t('undo.action')}
      </button>
    </div>
  );
}
