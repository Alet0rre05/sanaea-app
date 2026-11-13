/** Fondo animado global: bandas de aurora en la paleta de Sanae. Queda detrás de toda la app. */
export function AuroraBackground() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__band aurora__band--a" />
      <span className="aurora__band aurora__band--b" />
      <span className="aurora__band aurora__band--c" />
    </div>
  );
}
