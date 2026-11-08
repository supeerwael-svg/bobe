import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PERIODS, LUNCH_BREAK } from '@/utils/schedule';

type Row = { kind: 'period'; number: number; start: string; end: string } | { kind: 'lunch' };

export function SchedulePreview() {
  const { t } = useTranslation();
  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    for (const period of PERIODS) {
      if (period.start === LUNCH_BREAK.end) result.push({ kind: 'lunch' });
      result.push({ kind: 'period', ...period });
    }
    return result;
  }, []);

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) =>
        row.kind === 'lunch' ? (
          <li
            key="lunch"
            className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-accent-50 px-4 text-accent-800"
          >
            <span className="font-medium">{t('institution.lunchBreak')}</span>
            <span dir="ltr" className="text-sm">
              {LUNCH_BREAK.start} - {LUNCH_BREAK.end}
            </span>
          </li>
        ) : (
          <li
            key={row.number}
            className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 text-neutral-800"
          >
            <span className="font-medium">{t('institution.period', { number: row.number })}</span>
            <span dir="ltr" className="text-sm text-neutral-600">
              {row.start} - {row.end}
            </span>
          </li>
        ),
      )}
    </ol>
  );
}
