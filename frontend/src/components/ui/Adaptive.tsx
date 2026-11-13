import type { ReactNode } from 'react';
import { usePreferences } from '../../context/PreferencesContext';

interface AdaptiveProps {
  /** Texto breve que se muestra en Vista simple. */
  simple: ReactNode;
  /** Texto ampliado que se muestra en Vista detallada. */
  detailed: ReactNode;
  as?: 'p' | 'span' | 'div';
  className?: string;
}

/** Cambia el texto según la Vista simple o detallada del usuario. */
export function Adaptive({ simple, detailed, as: Tag = 'span', className }: AdaptiveProps) {
  const { viewMode } = usePreferences();
  return (
    <Tag className={className} data-mode={viewMode}>
      {viewMode === 'detailed' ? detailed : simple}
    </Tag>
  );
}

/** Contenido que solo aparece en Vista detallada. */
export function DetailOnly({ children }: { children: ReactNode }) {
  const { viewMode } = usePreferences();
  if (viewMode !== 'detailed') return null;
  return <div className="detail-reveal">{children}</div>;
}
