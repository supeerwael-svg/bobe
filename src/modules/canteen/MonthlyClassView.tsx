import { useEffect, useMemo, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { FormError } from '@/components/ui/StatusBlock';
import { listCanteenEntriesForDates, listCanteenStudents } from '@/db/canteen';
import { listClasses } from '@/db/classes';
import { useSession } from '@/modules/auth/AuthContext';
import { buildMonthlyClassRows, periodDates, type MonthlyClassCanteenRow } from '@/utils/canteenPeriod';
import { exportRowsToExcel } from '@/utils/spreadsheet';
import { printDailyPages } from '@/utils/printDailyPages';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';
import type { CanteenEntry, SchoolClass, Student } from '@/db/types';

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function buildPrintHtml(rows: MonthlyClassCanteenRow[], title: string, lang: string, dir: 'ltr' | 'rtl'): string {
  const head = dir === 'rtl'
    ? ['القسم', 'نصف الداخليين', 'المتوقع', 'الفعلي', 'المفقود', 'النسبة']
    : ['Class', 'Half-boarders', 'Expected', 'Actual', 'Missed', 'Rate'];
  const ths = head.map((h) => `<th>${h}</th>`).join('');
  const trs = rows.map((r) => `<tr><td>${r.className}</td><td>${r.studentCount}</td><td>${r.expectedEntries}</td><td>${r.actualEntries}</td><td>${r.missedEntries}</td><td>${r.rate === null ? '—' : r.rate + '%'}</td></tr>`).join('');
  const totals = rows.reduce(
    (acc, r) => ({
      studentCount: acc.studentCount + r.studentCount,
      expected: acc.expected + r.expectedEntries,
      actual: acc.actual + r.actualEntries,
    }),
    { studentCount: 0, expected: 0, actual: 0 },
  );
  const totalRate = totals.expected > 0 ? Math.round((totals.actual * 100) / totals.expected) : null;
  const totalRow = `<tr class="dr-total"><td><strong>${dir === 'rtl' ? 'المجموع' : 'Total'}</strong></td><td>${totals.studentCount}</td><td>${totals.expected}</td><td>${totals.actual}</td><td>${totals.expected - totals.actual}</td><td>${totalRate === null ? '—' : totalRate + '%'}</td></tr>`;
  return `<section class="dr-page"><h1 style="text-align:center;font-size:18px;margin:16px 0 8px">${title}</h1><table class="dr-table"><thead><tr>${ths}</tr></thead><tbody>${trs}${totalRow}</tbody></table></section>`;
}

export function MonthlyClassView({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const { institution } = useSession();
  const [month, setMonth] = useState(monthOf(todayIso()));
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [entries, setEntries] = useState<CanteenEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dates = periodDates('month', `${month}-01`);
    Promise.all([
      listCanteenStudents(institution.id),
      listClasses(institution.id),
      listCanteenEntriesForDates(institution.id, dates),
    ])
      .then(([loadedStudents, loadedClasses, loadedEntries]) => {
        if (cancelled) return;
        setStudents(loadedStudents);
        setClasses(loadedClasses);
        setEntries(loadedEntries);
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(t(errorKey(loadError)));
      });
    return () => { cancelled = true; };
  }, [institution.id, month, t]);

  const context = useMemo(
    () => ({
      canteenDays: institution.canteenDays ?? institution.workingDays,
      holidayDates: new Set(institution.holidays.map((h) => h.date)),
      trackingStart: institution.canteenTrackingStart ?? null,
    }),
    [institution],
  );

  const rows = useMemo(() => {
    const dates = periodDates('month', `${month}-01`);
    return buildMonthlyClassRows(students, classes, dates, entries, context);
  }, [students, classes, entries, context, month]);

  const handleExcel = () => {
    const excelRows = rows.map((r) => ({
      [t('canteenReport.monthlyClass.className')]: r.className,
      [t('canteenReport.monthlyClass.halfBoarders')]: r.studentCount,
      [t('canteenReport.monthlyClass.expected')]: r.expectedEntries,
      [t('canteenReport.monthlyClass.actual')]: r.actualEntries,
      [t('canteenReport.monthlyClass.missed')]: r.missedEntries,
      [t('canteenReport.monthlyClass.rate')]: r.rate === null ? '—' : `${r.rate}%`,
    }));
    exportRowsToExcel(excelRows, t('canteenReport.monthlyClass.title'), `canteen-monthly-class-${month}.xlsx`);
  };

  const handlePrint = () => {
    const html = buildPrintHtml(rows, t('canteenReport.monthlyClass.title'), i18n.language, i18n.dir());
    printDailyPages([html], t('canteenReport.monthlyClass.title'), i18n.language, i18n.dir());
  };

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('canteenReport.monthlyClass.title')} subtitle={t('canteenReport.monthlyClass.subtitle')} onBack={onBack} />

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t('canteenReport.monthlyClass.month')}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
          />
        </label>
      </section>

      <FormError message={error} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePrint}
          disabled={rows.length === 0}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          <Printer className="size-4" aria-hidden />
          {t('canteenReport.monthlyClass.print')}
        </button>
        <button
          type="button"
          onClick={handleExcel}
          disabled={rows.length === 0}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden />
          {t('canteenReport.monthlyClass.export')}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('canteenReport.noneMissing')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="p-3 text-start font-medium">{t('canteenReport.monthlyClass.className')}</th>
                <th className="p-3 text-end font-medium">{t('canteenReport.monthlyClass.halfBoarders')}</th>
                <th className="p-3 text-end font-medium">{t('canteenReport.monthlyClass.expected')}</th>
                <th className="p-3 text-end font-medium">{t('canteenReport.monthlyClass.actual')}</th>
                <th className="p-3 text-end font-medium">{t('canteenReport.monthlyClass.missed')}</th>
                <th className="p-3 text-end font-medium">{t('canteenReport.monthlyClass.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.classId} className="border-b border-neutral-100 last:border-0">
                  <td className="p-3 font-medium text-neutral-900">{row.className}</td>
                  <td className="p-3 text-end text-neutral-700">{row.studentCount}</td>
                  <td className="p-3 text-end text-neutral-700">{row.expectedEntries}</td>
                  <td className="p-3 text-end text-success-700">{row.actualEntries}</td>
                  <td className="p-3 text-end text-danger-700">{row.missedEntries}</td>
                  <td className="p-3 text-end font-bold text-neutral-900">{row.rate === null ? '—' : `${row.rate}%`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-bold">
                <td className="p-3 text-neutral-900">{t('canteenReport.monthlyClass.total')}</td>
                <td className="p-3 text-end text-neutral-900">{rows.reduce((s, r) => s + r.studentCount, 0)}</td>
                <td className="p-3 text-end text-neutral-900">{rows.reduce((s, r) => s + r.expectedEntries, 0)}</td>
                <td className="p-3 text-end text-neutral-900">{rows.reduce((s, r) => s + r.actualEntries, 0)}</td>
                <td className="p-3 text-end text-neutral-900">{rows.reduce((s, r) => s + r.missedEntries, 0)}</td>
                <td className="p-3 text-end text-neutral-900">
                  {(() => {
                    const totalExpected = rows.reduce((s, r) => s + r.expectedEntries, 0);
                    const totalActual = rows.reduce((s, r) => s + r.actualEntries, 0);
                    return totalExpected > 0 ? `${Math.round((totalActual * 100) / totalExpected)}%` : '—';
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
