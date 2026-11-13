import { useTranslation } from 'react-i18next';

export type CoverageCalendar = Record<string, { completed: number; missed: number; scheduled: number }>;

/** Mapa de calor de cobertura: verde = completadas, rosa = faltantes, ámbar = programadas. */
export function CoverageHeatmap({ calendar, year, month }: { calendar: CoverageCalendar; year: number; month: number }) {
  const { t } = useTranslation();
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // lunes = 0

  if (Object.keys(calendar).length === 0) {
    return <p className="text-sm text-muted">{t('coverage.empty')}</p>;
  }

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const colorFor = (day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const bucket = calendar[key];
    if (!bucket) return 'bg-canvas';
    if (bucket.missed > 0) return 'bg-danger/70';
    if (bucket.completed > 0) return 'bg-success/70';
    return 'bg-warning/60';
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((day, index) =>
          day === null ? (
            <span key={`empty-${index}`} />
          ) : (
            <div key={day} title={`${day}`}
              className={`kpi-number grid aspect-square place-items-center rounded-lg border border-line/60 text-xs ${colorFor(day)}`}>
              {day}
            </div>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-success/70" />{t('coverage.completed')}</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-danger/70" />{t('coverage.missed')}</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-warning/60" />{t('coverage.scheduled')}</span>
      </div>
    </div>
  );
}
