import { useRef, useState, type CSSProperties } from 'react';
import { CalendarOff, ClipboardList, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { EmptyState, FormError } from '@/components/ui/StatusBlock';
import { saveClassDayAbsences, type AbsenceWorkspace, type StudentAbsenceEntry } from '@/db/absences';
import type { Student, StudentAbsence } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { classLessonsForDay, isIsoDate, summarizeStudentAbsences, weekdayOfDate, type ClassLesson } from '@/utils/absences';
import { PERIODS } from '@/utils/schedule';
import { todayIso } from '@/utils/dates';
import { errorKey } from '@/utils/errors';

type DraftEntries = Map<string, StudentAbsenceEntry>;

function draftKey(studentId: string, period: number): string {
  return `${studentId}|${period}`;
}

function toDraft(records: StudentAbsence[]): DraftEntries {
  return new Map(
    records.map((record) => [
      draftKey(record.studentId, record.period),
      { studentId: record.studentId, period: record.period, justified: record.justified },
    ]),
  );
}

function snapshot(entries: StudentAbsenceEntry[]): string {
  return JSON.stringify(
    [...entries]
      .sort((a, b) => a.period - b.period || a.studentId.localeCompare(b.studentId))
      .map((entry) => [entry.period, entry.studentId, entry.justified]),
  );
}

function periodStartHour(periodNumber: number): string {
  const period = PERIODS.find((p) => p.number === periodNumber);
  return period ? period.start.slice(0, 2) : String(periodNumber);
}

interface StudentAbsencesViewProps {
  data: AbsenceWorkspace;
  onSaved: () => void;
}

export function StudentAbsencesView({ data, onSaved }: StudentAbsencesViewProps) {
  const { t } = useTranslation();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso);
  const activeClassId = data.classes.some((item) => item.id === selectedClassId) ? selectedClassId : (data.classes[0]?.id ?? null);

  if (activeClassId === null) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-7" aria-hidden />}
        title={t('timetable.noClassesTitle')}
        body={data.access.isHead ? t('timetable.noClassesBody') : t('timetable.noAssignedClasses')}
      />
    );
  }

  const validDate = isIsoDate(date);
  const workingDay = validDate && data.workingDays.includes(weekdayOfDate(date));
  const lessons = workingDay ? classLessonsForDay(data.slots, activeClassId, weekdayOfDate(date)) : [];
  const students = data.students
    .filter((student) => student.classId === activeClassId)
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const records = data.studentAbsences.filter((record) => record.classId === activeClassId && record.date === date);

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.classes.map((schoolClass) => (
          <FilterChip
            key={schoolClass.id}
            label={schoolClass.name}
            active={schoolClass.id === activeClassId}
            onClick={() => setSelectedClassId(schoolClass.id)}
          />
        ))}
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700 sm:max-w-xs">
        {t('absences.date')}
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="min-h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
      </label>

      {!validDate ? <FormError message={t('validation.invalidDate')} /> : null}
      {validDate && !workingDay ? (
        <EmptyState icon={<CalendarOff className="size-7" aria-hidden />} title={t('absences.noLessonsTitle')} body={t('absences.notWorkingDay')} />
      ) : null}
      {workingDay && lessons.length === 0 ? (
        <EmptyState icon={<CalendarOff className="size-7" aria-hidden />} title={t('absences.noLessonsTitle')} body={t('absences.noLessonsBody')} />
      ) : null}
      {workingDay && lessons.length > 0 ? (
        <ClassDayEditor
          key={`${activeClassId}|${date}`}
          classId={activeClassId}
          className={data.classes.find((schoolClass) => schoolClass.id === activeClassId)?.name ?? ''}
          date={date}
          lessons={lessons}
          students={students}
          records={records}
          canEdit={data.access.canEdit}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}

interface ClassDayEditorProps {
  classId: string;
  className: string;
  date: string;
  lessons: ClassLesson[];
  students: Student[];
  records: StudentAbsence[];
  canEdit: boolean;
  onSaved: () => void;
}

function ClassDayEditor({ classId, className, date, lessons, students, records, canEdit, onSaved }: ClassDayEditorProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [draft, setDraft] = useState<DraftEntries>(() => toDraft(records));
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot([...toDraft(records).values()]));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const entries = [...draft.values()];
  const dirty = snapshot(entries) !== savedSnapshot;
  const hoursByStudent = summarizeStudentAbsences(
    entries.map((entry) => ({ studentId: entry.studentId, justified: entry.justified, date })),
  );

  const absentStudentIds = new Set(entries.map((e) => e.studentId));
  const totalAbsentStudents = absentStudentIds.size;
  const totalAbsentHours = entries.length;

  const updateDraft = (update: (next: DraftEntries) => void) => {
    setJustSaved(false);
    setDraft((current) => {
      const next = new Map(current);
      update(next);
      return next;
    });
  };

  const toggleAbsent = (studentId: string, period: number) =>
    updateDraft((next) => {
      const key = draftKey(studentId, period);
      if (next.has(key)) next.delete(key);
      else next.set(key, { studentId, period, justified: false });
    });

  const toggleJustified = (studentId: string, period: number) =>
    updateDraft((next) => {
      const key = draftKey(studentId, period);
      const entry = next.get(key);
      if (entry) next.set(key, { ...entry, justified: !entry.justified });
    });

  const startPress = (studentId: string, period: number) => {
    if (!canEdit) return;
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      const entry = draft.get(draftKey(studentId, period));
      if (!entry) return;
      longPressTriggered.current = true;
      toggleJustified(studentId, period);
    }, 550);
  };

  const cancelPress = () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const finishPress = (studentId: string, period: number) => {
    cancelPress();
    if (!longPressTriggered.current) toggleAbsent(studentId, period);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      await saveClassDayAbsences(institution.id, user.id, classId, date, entries);
      setSavedSnapshot(snapshot(entries));
      setJustSaved(true);
      onSaved();
    } catch (cause) {
      setSaveError(t(errorKey(cause)));
    } finally {
      setSaving(false);
    }
  };

  const gridTemplateColumns = `7rem repeat(${lessons.length}, 7rem)`;
  const gridStyle: CSSProperties = { gridTemplateColumns };
  const stickyColumnClass = 'sticky z-20 bg-white ltr:left-0 rtl:right-0';

  return (
    <div className="flex flex-col gap-3">
      {!canEdit ? <p className="rounded-2xl bg-neutral-100 p-4 text-sm text-neutral-700">{t('absences.readOnly')}</p> : null}

      <div className="overflow-x-auto overscroll-x-contain rounded-2xl bg-white ring-1 ring-neutral-200 [scrollbar-width:thin]">
        <div className="min-w-max">
          <div className="sticky top-16 z-30 border-b border-neutral-300 bg-white shadow-sm">
            <div className="grid min-w-max items-stretch" style={gridStyle}>
              <div className={`${stickyColumnClass} flex min-h-[4.75rem] flex-col justify-center border-e border-neutral-200 px-3 py-2`}>
                <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{t('reports.columns.student')}</span>
                <span className="text-xs font-semibold text-neutral-900">{date}</span>
                <span className="truncate text-xs text-neutral-600">{t('timetable.classLabel')}: {className}</span>
              </div>
              {lessons.map((lesson) => {
                const absentCount = entries.filter((entry) => entry.period === lesson.period).length;
                return (
                  <div key={lesson.period} className="flex min-h-[4.75rem] flex-col items-center justify-center border-e border-neutral-100 px-1 py-2 text-center">
                    <span className="text-xs font-bold text-neutral-900">{periodStartHour(lesson.period)}</span>
                    <span className="max-w-[6.75rem] whitespace-normal break-words text-[10px] font-medium leading-tight text-neutral-600" title={lesson.subject}>{lesson.subject}</span>
                    <span className="text-[10px] text-neutral-500">{t('absences.period', { number: lesson.period })}</span>
                    {absentCount > 0 ? (
                      <span className="mt-0.5 rounded-full bg-danger-100 px-1.5 text-[10px] font-semibold text-danger-700">{absentCount}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {students.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-600">{t('absences.noStudents')}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {students.map((student) => {
                const hours = hoursByStudent.get(student.id)?.hours ?? 0;
                return (
                  <li key={student.id} className="grid min-w-max items-stretch transition hover:bg-neutral-50" style={gridStyle}>
                    <div className={`${stickyColumnClass} flex min-h-[4.75rem] flex-col justify-center border-e border-neutral-200 px-3 py-3`}>
                      <p className="max-w-[7rem] truncate text-sm font-semibold text-neutral-900">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-[10px] text-neutral-500">{t('absences.hours', { count: hours })}</p>
                    </div>
                    {lessons.map((lesson) => {
                      const entry = draft.get(draftKey(student.id, lesson.period));
                      const isAbsent = entry !== undefined;
                      return (
                        <div key={lesson.period} className="flex items-center justify-center px-1 py-3">
                          <button
                            type="button"
                            disabled={!canEdit}
                            aria-pressed={isAbsent}
                            aria-label={`${student.firstName} ${student.lastName}, ${t('absences.period', { number: lesson.period })}`}
                            onPointerDown={() => startPress(student.id, lesson.period)}
                            onPointerUp={() => finishPress(student.id, lesson.period)}
                            onPointerCancel={cancelPress}
                            onPointerLeave={cancelPress}
                            className={`relative flex min-h-11 w-full flex-col items-center justify-center rounded-xl px-1 text-center text-[10px] font-medium leading-tight transition duration-150 ring-1 disabled:cursor-not-allowed ${
                              isAbsent
                                ? 'bg-danger-600 text-white ring-danger-700 hover:bg-danger-700'
                                : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'
                            }`}
                          >
                            <span className="font-bold">{periodStartHour(lesson.period)}</span>
                            <span>{isAbsent ? t('absences.absent') : t('absences.present')}</span>
                            {entry?.justified ? <span className="absolute end-1 top-1 size-1.5 rounded-full bg-white" title={t('absences.justified')} aria-label={t('absences.justified')} /> : null}
                          </button>
                        </div>
                      );
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <FormError message={saveError} />

      {/* Floating summary bar above bottom navigation */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-3xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-neutral-200 backdrop-blur">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
            <span className="font-semibold text-neutral-900">
              {t('absences.summaryAbsent', { count: totalAbsentStudents })}
            </span>
            <span className="font-medium text-neutral-600">
              {t('absences.summaryHours', { count: totalAbsentHours })}
            </span>
            <span className="text-neutral-500">
              {dirty ? t('absences.unsaved') : justSaved ? t('absences.saved') : ''}
            </span>
          </div>
          {canEdit ? (
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              icon={<Save className="size-5" aria-hidden />}
              className="min-h-10 px-3 text-sm sm:px-5 sm:text-base"
            >
              {t('absences.save')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Bottom padding so last student isn't hidden behind summary bar + nav */}
      <div className="h-40" />
    </div>
  );
}
