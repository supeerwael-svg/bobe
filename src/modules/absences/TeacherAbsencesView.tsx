import { useState } from 'react';
import { CalendarOff, Save, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { EmptyState, FormError } from '@/components/ui/StatusBlock';
import { saveTeacherAbsence, type AbsenceWorkspace } from '@/db/absences';
import { TeacherAbsenceList } from '@/modules/absences/TeacherAbsenceList';
import { useSession } from '@/modules/auth/AuthContext';
import { affectedClassIds, isIsoDate, teacherAbsenceHours, teacherLessonsForDay, weekdayOfDate } from '@/utils/absences';
import { todayIso } from '@/utils/dates';
import { errorKey } from '@/utils/errors';
import { TEACHER_ABSENCE_REASONS, type TeacherAbsenceLesson, type TeacherAbsenceReason } from '@/db/types';
import { INPUT_CLASS } from '@/modules/absences/DailyReportEditors';

interface TeacherAbsencesViewProps {
  data: AbsenceWorkspace;
  onChanged: () => void;
}

export function TeacherAbsencesView({ data, onChanged }: TeacherAbsencesViewProps) {
  const { t } = useTranslation();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso);
  const activeTeacherId = data.teachers.some((item) => item.id === teacherId) ? teacherId : (data.teachers[0]?.id ?? null);

  if (activeTeacherId === null) {
    return <EmptyState icon={<UserX className="size-7" aria-hidden />} title={t('absences.chooseTeacher')} body={t('absences.noTeachers')} />;
  }

  const validDate = isIsoDate(date);
  const workingDay = validDate && data.workingDays.includes(weekdayOfDate(date));
  const lessons = workingDay ? teacherLessonsForDay(data.slots, activeTeacherId, weekdayOfDate(date)) : [];
  const existing = data.teacherAbsences.find((record) => record.teacherId === activeTeacherId && record.date === date);
  const classNameById = new Map(data.classes.map((item) => [item.id, item.name]));
  const teacherNameById = new Map(data.teachers.map((item) => [item.id, item.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.teachers.map((teacher) => (
          <FilterChip
            key={teacher.id}
            label={teacher.name}
            active={teacher.id === activeTeacherId}
            onClick={() => setTeacherId(teacher.id)}
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
        <EmptyState icon={<CalendarOff className="size-7" aria-hidden />} title={t('absences.teacherNoLessons')} body={t('absences.noLessonsBody')} />
      ) : null}
      {workingDay && lessons.length > 0 ? (
        <TeacherAbsenceForm
          key={`${activeTeacherId}|${date}`}
          teacherId={activeTeacherId}
          teacherName={teacherNameById.get(activeTeacherId) ?? ''}
          date={date}
          lessons={lessons}
          initialPeriods={existing ? existing.lessons.map((lesson) => lesson.period) : lessons.map((lesson) => lesson.period)}
          initialReason={existing?.reason ?? ''}
          initialReasonNote={existing?.reasonNote ?? ''}
          classNameById={classNameById}
          onSaved={onChanged}
        />
      ) : null}

      <TeacherAbsenceList
        records={data.teacherAbsences}
        teacherNameById={teacherNameById}
        classNameById={classNameById}
        onChanged={onChanged}
      />
    </div>
  );
}

interface TeacherAbsenceFormProps {
  teacherId: string;
  teacherName: string;
  date: string;
  lessons: TeacherAbsenceLesson[];
  initialPeriods: number[];
  initialReason: TeacherAbsenceReason | '';
  initialReasonNote: string;
  classNameById: Map<string, string>;
  onSaved: () => void;
}

function TeacherAbsenceForm({
  teacherId,
  teacherName,
  date,
  lessons,
  initialPeriods,
  initialReason,
  initialReasonNote,
  classNameById,
  onSaved,
}: TeacherAbsenceFormProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initialPeriods));
  const [reason, setReason] = useState<TeacherAbsenceReason | ''>(initialReason);
  const [reasonNote, setReasonNote] = useState(initialReasonNote);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedLessons = lessons.filter((lesson) => selected.has(lesson.period));
  const classIds = affectedClassIds(selectedLessons);

  const togglePeriod = (period: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveTeacherAbsence(institution.id, user.id, teacherId, date, [...selected], {
        reason: reason || undefined,
        reasonNote,
      });
      onSaved();
    } catch (cause) {
      setSaveError(t(errorKey(cause)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-neutral-900">{teacherName}</h2>
        <p className="text-sm text-neutral-600">{t('absences.teacherLessons')}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {lessons.map((lesson) => {
          const checked = selected.has(lesson.period);
          return (
            <li key={lesson.period}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 ring-1 ring-neutral-200 transition duration-200 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePeriod(lesson.period)}
                  className="size-5 accent-primary-600"
                />
                <span className="flex-1 text-sm font-medium text-neutral-900">
                  {t('absences.period', { number: lesson.period })} · {lesson.subject}
                </span>
                <span className="text-xs text-neutral-500">{classNameById.get(lesson.classId) ?? ''}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-4">
        <p className="text-sm text-neutral-700">
          {t('absences.hoursAbsent')}: <span className="font-semibold text-neutral-900">{t('absences.hours', { count: teacherAbsenceHours(selectedLessons) })}</span>
        </p>
        <p className="text-sm text-neutral-700">
          {t('absences.affectedClasses')}:{' '}
          <span className="font-semibold text-neutral-900">
            {classIds.length > 0 ? classIds.map((id) => classNameById.get(id) ?? '').join(', ') : '-'}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          {t('absences.reason.label')}
          <select className={INPUT_CLASS} value={reason} onChange={(event) => setReason(event.target.value as TeacherAbsenceReason | '')}>
            <option value="">{t('absences.reason.none')}</option>
            {TEACHER_ABSENCE_REASONS.map((value) => (
              <option key={value} value={value}>
                {t(`absences.reason.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
          {t('absences.reason.note')}
          <input className={INPUT_CLASS} value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} />
        </label>
      </div>

      <FormError message={saveError} />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} icon={<Save className="size-5" aria-hidden />}>
          {t('absences.recordAbsence')}
        </Button>
      </div>
    </section>
  );
}
