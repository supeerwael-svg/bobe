import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { FormError } from '@/components/ui/StatusBlock';
import { listCanteenEntriesForDates, listCanteenStudents, loadWholeDayAbsenceKeys } from '@/db/canteen';
import { listClasses } from '@/db/classes';
import { useSession } from '@/modules/auth/AuthContext';
import {
  buildPeriodRows,
  halfBoardersWithoutEntry,
  isZeroEntry,
  periodDates,
  sortByLowestRate,
  splitMissedDays,
  type CanteenPeriodMode,
  type CanteenPeriodRow,
} from '@/utils/canteenPeriod';
import { RejectedScansScreen } from './RejectedScansScreen';
import { CanteenDataFile } from './CanteenDataFile';
import { MonthlyClassView } from './MonthlyClassView';
import { classLevelOf, CLASS_LEVELS } from '@/utils/classLevel';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';
import type { CanteenEntry, SchoolClass, Student } from '@/db/types';

const MODES: CanteenPeriodMode[] = ['day', 'week', 'month'];

interface ReportData {
  students: Student[];
  classes: SchoolClass[];
  entries: CanteenEntry[];
  absentKeys: Set<string>;
  dates: string[];
}

export function CanteenReportScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { institution } = useSession();
  const [mode, setMode] = useState<CanteenPeriodMode>('day');
  const [anchor, setAnchor] = useState(todayIso());
  const [classId, setClassId] = useState('');
  const [level, setLevel] = useState('');
  const [presentOnly, setPresentOnly] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const dates = periodDates(mode, anchor);
    Promise.all([
      listCanteenStudents(institution.id),
      listClasses(institution.id),
      listCanteenEntriesForDates(institution.id, dates),
    ])
      .then(async ([students, classes, entries]) => {
        const absentKeys = await loadWholeDayAbsenceKeys(institution, students, dates);
        if (!cancelled) setData({ students, classes, entries, absentKeys, dates });
      })
      .catch((loadError) => {
        if (!cancelled) setError(t(errorKey(loadError)));
      });
    return () => {
      cancelled = true;
    };
  }, [institution, mode, anchor, t]);

  const context = useMemo(
    () => ({
      canteenDays: institution.canteenDays ?? institution.workingDays,
      holidayDates: new Set(institution.holidays.map((holiday) => holiday.date)),
      trackingStart: institution.canteenTrackingStart ?? null,
    }),
    [institution],
  );

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const classById = new Map(data.classes.map((schoolClass) => [schoolClass.id, schoolClass]));
    return data.students.filter((student) => {
      if (classId && student.classId !== classId) return false;
      if (level) {
        const schoolClass = classById.get(student.classId);
        if (!schoolClass || String(classLevelOf(schoolClass)) !== level) return false;
      }
      return true;
    });
  }, [data, classId, level]);

  const className = (student: Student) => data?.classes.find((item) => item.id === student.classId)?.name ?? '';
  const studentName = (student: Student) => `${student.firstName} ${student.lastName}`;

  const dayList = useMemo(() => {
    if (!data || mode !== 'day') return [];
    return halfBoardersWithoutEntry(filteredStudents, anchor, data.entries, context);
  }, [data, mode, filteredStudents, anchor, context]);

  const rows: CanteenPeriodRow[] = useMemo(() => {
    if (!data || mode === 'day') return [];
    return sortByLowestRate(buildPeriodRows(filteredStudents, data.dates, data.entries, context));
  }, [data, mode, filteredStudents, context]);

  const rowSplits = useMemo(
    () => new Map(rows.map((row) => [row.studentId, splitMissedDays(row, data?.absentKeys ?? new Set())])),
    [rows, data],
  );

  const visibleRows = presentOnly ? rows.filter((row) => (rowSplits.get(row.studentId)?.presentNotEaten.length ?? 0) > 0) : rows;
  const studentById = new Map(filteredStudents.map((student) => [student.id, student]));

  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [monthlyClassOpen, setMonthlyClassOpen] = useState(false);
  if (rejectedOpen) return <RejectedScansScreen onBack={() => setRejectedOpen(false)} />;
  if (monthlyClassOpen) return <MonthlyClassView onBack={() => setMonthlyClassOpen(false)} />;

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('canteenReport.title')} subtitle={t('canteenReport.subtitle')} onBack={onBack} />
      {institution.canteenTrackingStart ? (
        <p className="text-sm text-neutral-600">{t('canteenReport.trackingSince', { date: institution.canteenTrackingStart })}</p>
      ) : (
        <p className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">{t('canteen.trackingOff')}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setRejectedOpen(true)}
          className="min-h-11 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition duration-200 hover:bg-neutral-200"
        >
          {t('canteenReport.rejected.open')}
        </button>
        <button
          type="button"
          onClick={() => setMonthlyClassOpen(true)}
          className="min-h-11 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition duration-200 hover:bg-neutral-200"
        >
          {t('canteenReport.monthlyClass.open')}
        </button>
      </div>
      <CanteenDataFile />

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div role="group" aria-label={t('canteenReport.periodLabel')} className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-200/70 p-1">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`min-h-11 rounded-lg text-sm font-medium transition duration-200 ${
                mode === item ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t(`canteenReport.periods.${item}`)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          {t('canteenReport.anchorDate')}
          <input
            type="date"
            value={anchor}
            onChange={(event) => setAnchor(event.target.value)}
            className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            {t('canteenReport.classFilter')}
            <select
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
            >
              <option value="">{t('canteenReport.allClasses')}</option>
              {(data?.classes ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            {t('canteenReport.levelFilter')}
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900"
            >
              <option value="">{t('canteenReport.allLevels')}</option>
              {CLASS_LEVELS.map((item) => (
                <option key={item} value={String(item)}>
                  {t('canteenReport.level', { level: item })}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <FormError message={error} />

      {mode === 'day' ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{t('canteenReport.didNotEnter')}</h2>
          {dayList.length === 0 ? <p className="text-sm text-neutral-500">{t('canteenReport.noneMissing')}</p> : null}
          <ul className="flex flex-col gap-2">
            {dayList.map((student) => (
              <li key={student.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-neutral-200">
                <span className="font-medium text-neutral-900">{studentName(student)}</span>
                <span className="text-sm text-neutral-600">{className(student)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{t('canteenReport.rates')}</h2>
            <button
              type="button"
              aria-pressed={presentOnly}
              onClick={() => setPresentOnly((value) => !value)}
              className={`min-h-11 rounded-xl px-3 text-sm font-medium transition duration-200 ${
                presentOnly ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {t('canteenReport.presentNotEaten')}
            </button>
          </div>
          {visibleRows.length === 0 ? <p className="text-sm text-neutral-500">{t('canteenReport.noneMissing')}</p> : null}
          <ul className="flex flex-col gap-2">
            {visibleRows.map((row) => {
              const student = studentById.get(row.studentId);
              if (!student) return null;
              const split = rowSplits.get(row.studentId);
              const zero = isZeroEntry(row);
              return (
                <li
                  key={row.studentId}
                  className={`flex flex-col gap-2 rounded-xl p-3 shadow-sm ring-1 ${
                    zero ? 'bg-danger-50 ring-danger-200' : 'bg-white ring-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-neutral-900">{studentName(student)}</span>
                      <span className="text-sm text-neutral-600">{className(student)}</span>
                    </div>
                    <span className={`text-lg font-bold ${zero ? 'text-danger-700' : 'text-neutral-900'}`}>
                      {row.rate === null ? '-' : `${row.rate}%`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                    <span>{t('canteenReport.columns.expected', { count: row.expectedDays.length })}</span>
                    <span>{t('canteenReport.columns.entered', { count: row.enteredDays.length })}</span>
                    <span>{t('canteenReport.columns.missed', { count: row.missedDays.length })}</span>
                    <span>{t('canteenReport.crossCheck.absentCount', { count: split?.absentFromSchool.length ?? 0 })}</span>
                    <span>{t('canteenReport.crossCheck.presentCount', { count: split?.presentNotEaten.length ?? 0 })}</span>
                  </div>
                  {zero ? <span className="text-sm font-medium text-danger-700">{t('canteenReport.zeroEntry')}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
