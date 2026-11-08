import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { weekdayName } from '@/utils/calendar';
import { slotKey } from '@/utils/timetableConflicts';
import type { SlotAvailability } from '@/utils/roomAvailability';
import type { LessonEntry } from '@/utils/timetableLessons';
import type { HourSelection } from './RoomHeatmap';

interface RoomHourModalProps {
  selection: HourSelection | null;
  availability: Map<string, SlotAvailability>;
  roomNameById: Map<string, string>;
  classNameById: Map<string, string>;
  teacherNameById: Map<string, string>;
  onClose: () => void;
}

export function RoomHourModal({
  selection,
  availability,
  roomNameById,
  classNameById,
  teacherNameById,
  onClose,
}: RoomHourModalProps) {
  const { t, i18n } = useTranslation();
  const cell = selection ? availability.get(slotKey(selection.day, selection.period)) : undefined;
  const title = selection
    ? t('timetable.slotTitle', { day: weekdayName(selection.day, i18n.language, 'long'), period: selection.period })
    : '';
  const freeNames = cell?.freeRoomIds.map((id) => roomNameById.get(id) ?? '') ?? [];
  const occupiedNames = cell?.occupiedRoomIds.map((id) => roomNameById.get(id) ?? '') ?? [];

  return (
    <Modal open={selection !== null} title={title} description={t('rooms.heatmapTitle')} onClose={onClose}>
      {cell ? (
        <div className="flex flex-col gap-6">
          <RoomList title={t('rooms.freeRooms')} names={freeNames} emptyLabel={t('rooms.noneFree')} tone="success" />
          <RoomList title={t('rooms.occupiedRooms')} names={occupiedNames} emptyLabel={t('rooms.noneOccupied')} tone="danger" />
          <LessonList
            lessons={cell.lessons}
            classNameById={classNameById}
            teacherNameById={teacherNameById}
            roomNameById={roomNameById}
          />
        </div>
      ) : null}
    </Modal>
  );
}

interface RoomListProps {
  title: string;
  names: string[];
  emptyLabel: string;
  tone: 'success' | 'danger';
}

function RoomList({ title, names, emptyLabel, tone }: RoomListProps) {
  const chipClass = tone === 'success' ? 'bg-success-50 text-success-800 ring-success-200' : 'bg-danger-50 text-danger-800 ring-danger-200';
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-700">
        {title} ({names.length})
      </h3>
      {names.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {names.map((name) => (
            <li key={name} className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${chipClass}`}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface LessonListProps {
  lessons: LessonEntry[];
  classNameById: Map<string, string>;
  teacherNameById: Map<string, string>;
  roomNameById: Map<string, string>;
}

function LessonList({ lessons, classNameById, teacherNameById, roomNameById }: LessonListProps) {
  const { t } = useTranslation();
  if (lessons.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-700">{t('timetable.drillLessons')}</h3>
      <ul className="flex flex-col gap-2">
        {lessons.map((lesson, index) => (
          <li key={`${lesson.classId}-${lesson.groupNumber ?? 0}-${index}`} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
            <p className="font-semibold text-neutral-900">
              {classNameById.get(lesson.classId) ?? ''}
              {lesson.groupNumber !== null ? ` · ${t('timetable.groupShort', { number: lesson.groupNumber })}` : ''}
              {lesson.subject ? ` · ${lesson.subject}` : ''}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {t('timetable.drillTeacher')}: {lesson.teacherId ? teacherNameById.get(lesson.teacherId) ?? '' : '-'}
              {' · '}
              {t('timetable.drillRoom')}:{' '}
              {lesson.roomId ? roomNameById.get(lesson.roomId) ?? '' : t('timetable.drillNoRoom')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
