import { useEffect, useRef } from 'react';

/**
 * Fondo animado global, en la paleta de Sanae.
 * - Las bandas se desplazan suavemente siguiendo el cursor (parallax).
 * - Bajo el puntero se forma una niebla que se difumina con el movimiento.
 * - Al hacer clic se genera una onda pequeña que se expande y se disipa.
 * - Las tarjetas (.card) reciben un brillo que sigue al cursor.
 * Con "reducir movimiento" activo, solo queda el fondo animado sin interacción.
 */
export function AuroraBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
      root.style.setProperty('--fog-x', `${event.clientX}px`);
      root.style.setProperty('--fog-y', `${event.clientY}px`);
      root.classList.add('is-hovering');

      const card = (event.target as Element | null)?.closest?.('.card') as HTMLElement | null;
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
      }
    };

    const onLeaveWindow = (event: MouseEvent) => {
      if (!event.relatedTarget) root.classList.remove('is-hovering');
    };

    const onDown = (event: PointerEvent) => {
      const ripple = document.createElement('span');
      ripple.className = 'aurora__ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      ripple.addEventListener('animationend', () => ripple.remove());
      root.appendChild(ripple);
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      root.style.setProperty('--px', currentX.toFixed(4));
      root.style.setProperty('--py', currentY.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseout', onLeaveWindow);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mouseout', onLeaveWindow);
    };
  }, []);

  return (
    <div ref={rootRef} className="aurora" aria-hidden="true">
      <span className="aurora__band aurora__band--a" />
      <span className="aurora__band aurora__band--b" />
      <span className="aurora__band aurora__band--c" />
      <span className="aurora__band aurora__band--d" />
      <span className="aurora__fog" />
    </div>
  );
}
