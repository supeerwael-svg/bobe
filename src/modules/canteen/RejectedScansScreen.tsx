import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { FormError } from '@/components/ui/StatusBlock';
import { listCanteenEntriesForDates, listCanteenStudents } from '@/db/canteen';
import { useSession } from '@/modules/auth/AuthContext';
import { CANTEEN_REJECT_REASONS, type CanteenEntry, type CanteenRejectReason, type Student } from '@/db/types';
import { rejectedEntries } from '@/utils/canteenPeriod';
import { errorKey } from '@/utils/errors';
import { exportRowsToExcel } from '@/utils/spreadsheet';
import { todayIso } from '@/utils/dates';

type ReasonFilter = CanteenRejectReason | 'all';

export function RejectedScansScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { institution } = useSession();
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState<ReasonFilter>('all');
  const [entries, setEntries] = useState<CanteenEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCanteenEntriesForDates(institution.id, [date]), listCanteenStudents(institution.id)])
      .then(([loadedEntries, loadedStudents]) => {
        if (cancelled) return;
        setEntries(loadedEntries);
        setStudents(loadedStudents);
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) setError(t(errorKey(loadError)));
      });
    return () => {
      cancelled = true;
    };
  }, [institution.id, date, t]);

  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const rejected = useMemo(() => rejectedEntries(entries, date, reason), [entries, date, reason]);

  const describe = (entry: CanteenEntry) => {
    const student = entry.studentId ? studentById.get(entry.studentId) : undefined;
    return student ? `${student.firstName} ${student.lastName}` : entry.scannedCode ?? '';
  };

  const handleExport = () => {
    const rows = rejected.map((entry) => ({
      [t('canteenReport.rejected.time')]: entry.time,
      [t('canteenReport.rejected.student')]: describe(entry),
      [t('canteenReport.rejected.reason')]: t(`canteen.reasons.${entry.reason ?? 'unknown'}`),
    }));
    exportRowsToExcel(rows, t('canteenReport.rejected.title'), `canteen-rejected-${date}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('canteenReport.rejected.title')} subtitle={t('canteenReport.rejected.subtitle')} onBack={onBack} />

      <section className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t('canteenReport.anchorDate')}
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t('canteenReport.rejected.reason')}
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as ReasonFilter)}
            className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
          >
            <option value="all">{t('canteenReport.rejected.allReasons')}</option>
            {CANTEEN_REJECT_REASONS.map((item) => (
              <option key={item} value={item}>
                {t(`canteen.reasons.${item}`)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <FormError message={error} />

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-neutral-600">{t('canteenReport.rejected.count', { count: rejected.length })}</span>
        <button
          type="button"
          onClick={handleExport}
          disabled={rejected.length === 0}
          className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition duration-200 hover:bg-primary-700 disabled:opacity-50"
        >
          {t('canteenReport.rejected.export')}
        </button>
      </div>

      {rejected.length === 0 ? <p className="text-sm text-neutral-500">{t('canteenReport.rejected.empty')}</p> : null}
      <ul className="flex flex-col gap-2">
        {rejected.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-200">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-neutral-900">{describe(entry)}</span>
              <span className="text-sm text-neutral-600">{entry.time}</span>
            </div>
            <span className="rounded-full bg-danger-50 px-3 py-1 text-xs font-medium text-danger-700">
              {t(`canteen.reasons.${entry.reason ?? 'unknown'}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
