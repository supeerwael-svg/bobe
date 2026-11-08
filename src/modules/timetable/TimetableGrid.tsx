import { Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TimetableSlot } from '@/db/types';
import { LUNCH_BREAK, PERIODS } from '@/utils/schedule';
import { weekdayName } from '@/utils/calendar';
import { slotLessons, type SlotLesson } from '@/utils/timetableLessons';

interface TimetableGridProps {
  days: number[];
  slotByKey: Map<string, TimetableSlot>;
  conflictKeys: Set<string>;
  teacherNameById: Map<string, string>;
  roomNameById: Map<string, string>;
  canEdit: boolean;
  onOpenSlot: (day: number, period: number) => void;
}

export function TimetableGrid({
  days,
  slotByKey,
  conflictKeys,
  teacherNameById,
  roomNameById,
  canEdit,
  onOpenSlot,
}: TimetableGridProps) {
  const { t, i18n } = useTranslation();
  const columnCount = days.length + 1;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <table className="w-full min-w-[36rem] border-separate border-spacing-2">
        <thead>
          <tr>
            <th scope="col" className="w-24" aria-hidden />
            {days.map((day) => (
              <th key={day} scope="col" className="rounded-xl bg-white px-2 py-3 text-sm font-semibold text-neutral-800 ring-1 ring-neutral-200">
                {weekdayName(day, i18n.language, 'long')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <Fragment key={period.number}>
              {period.start === LUNCH_BREAK.end ? (
                <tr>
                  <td colSpan={columnCount} className="rounded-xl bg-neutral-200/70 px-4 py-2 text-center text-sm font-medium text-neutral-700">
                    {t('timetable.lunchBreak')} · {LUNCH_BREAK.start} - {LUNCH_BREAK.end}
                  </td>
                </tr>
              ) : null}
              <tr>
                <th scope="row" className="rounded-xl px-2 py-1 text-start align-middle">
                  <span className="block text-sm font-semibold text-neutral-800">
                    {t('timetable.periodLabel', { number: period.number })}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {t('timetable.periodTime', { start: period.start, end: period.end })}
                  </span>
                </th>
                {days.map((day) => {
                  const key = `${day}-${period.number}`;
                  const slot = slotByKey.get(key) ?? null;
                  return (
                    <td key={day} className="p-0 align-top">
                      <SlotCell
                        slot={slot}
                        conflict={conflictKeys.has(key)}
                        canEdit={canEdit}
                        teacherNameById={teacherNameById}
                        roomNameById={roomNameById}
                        onOpen={() => onOpenSlot(day, period.number)}
                      />
                    </td>
                  );
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SlotCellProps {
  slot: TimetableSlot | null;
  conflict: boolean;
  canEdit: boolean;
  teacherNameById: Map<string, string>;
  roomNameById: Map<string, string>;
  onOpen: () => void;
}

function SlotCell({ slot, conflict, canEdit, teacherNameById, roomNameById, onOpen }: SlotCellProps) {
  const { t } = useTranslation();
  const tone = conflict
    ? 'bg-danger-50 ring-danger-300'
    : slot
      ? 'bg-primary-50 ring-primary-200'
      : 'bg-white ring-neutral-200';
  const className = `flex min-h-24 w-full flex-col items-start gap-1 rounded-xl p-2.5 text-start ring-1 transition duration-150 ${tone}`;
  const lessons = slot ? slotLessons(slot) : [];
  const split = lessons.length > 1;

  const content = (
    <>
      {conflict ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-danger-700">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          {t('timetable.conflictCell')}
        </span>
      ) : null}
      {slot && split ? (
        <ul className="flex w-full flex-col gap-1.5">
          {lessons.map((lesson) => (
            <li key={lesson.groupNumber ?? 0} className="flex w-full flex-col rounded-lg bg-white/70 px-2 py-1 ring-1 ring-primary-100">
              <span className="w-full truncate text-xs font-bold text-primary-800">
                {t('timetable.groupShort', { number: lesson.groupNumber })} · {lesson.subject}
              </span>
              <span className="w-full truncate text-xs text-neutral-700">{lessonTeacher(lesson, teacherNameById, t)}</span>
              <span className="w-full truncate text-xs text-neutral-600">{lessonRoom(lesson, roomNameById, t)}</span>
            </li>
          ))}
        </ul>
      ) : slot ? (
        <>
          <span className="w-full truncate text-sm font-semibold text-neutral-900">{slot.subject}</span>
          <span className="w-full truncate text-xs text-neutral-700">{lessonTeacher(lessons[0], teacherNameById, t)}</span>
          <span className="w-full truncate text-xs text-neutral-600">{lessonRoom(lessons[0], roomNameById, t)}</span>
        </>
      ) : canEdit ? (
        <span className="text-xs text-neutral-500">{t('timetable.emptyCell')}</span>
      ) : null}
    </>
  );

  if (!canEdit) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} hover:ring-2 hover:ring-primary-400 active:scale-[0.98]`}
      aria-label={slot ? t('timetable.editSlot') : t('timetable.addSlot')}
    >
      {content}
    </button>
  );
}

type Translate = (key: string) => string;

function lessonTeacher(lesson: SlotLesson, teacherNameById: Map<string, string>, t: Translate): string {
  return lesson.teacherId ? (teacherNameById.get(lesson.teacherId) ?? t('timetable.noTeacher')) : t('timetable.noTeacher');
}

function lessonRoom(lesson: SlotLesson, roomNameById: Map<string, string>, t: Translate): string {
  return lesson.roomId ? (roomNameById.get(lesson.roomId) ?? t('timetable.noRoom')) : t('timetable.noRoom');
}
