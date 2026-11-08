import { useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { Modal } from '@/components/ui/Modal';
import { saveTimetableSlot } from '@/db/timetable';
import { TEXT_MAX_LENGTH } from '@/db/studentRules';
import { MAX_TIMETABLE_GROUPS, type Room, type Teacher, type TimetableGroup, type TimetableSlot } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { weekdayName } from '@/utils/calendar';
import { errorKey } from '@/utils/errors';
import { normalizeName } from '@/utils/timetableParsing';
import { isSplitSlot, slotLessons } from '@/utils/timetableLessons';

export interface SlotTarget {
  classId: string;
  day: number;
  period: number;
  slot: TimetableSlot | null;
}

interface SlotEditorModalProps {
  target: SlotTarget | null;
  teachers: Teacher[];
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
  onRemove: (slot: TimetableSlot) => void;
}

export function SlotEditorModal({ target, teachers, rooms, onClose, onSaved, onRemove }: SlotEditorModalProps) {
  const { t, i18n } = useTranslation();
  const title = target
    ? t('timetable.slotTitle', { day: weekdayName(target.day, i18n.language, 'long'), period: target.period })
    : '';

  return (
    <Modal open={target !== null} title={title} onClose={onClose}>
      {target ? (
        <SlotForm
          key={`${target.day}-${target.period}-${target.slot?.id ?? 'new'}`}
          target={target}
          teachers={teachers}
          rooms={rooms}
          onSaved={onSaved}
          onRemove={onRemove}
        />
      ) : null}
    </Modal>
  );
}

interface LessonDraft {
  subject: string;
  teacherName: string;
  roomId: string;
}

function draftsFromSlot(slot: TimetableSlot | null, teachers: Teacher[]): LessonDraft[] {
  if (!slot) return [{ subject: '', teacherName: '', roomId: '' }];
  const nameOf = (teacherId: string | null) => teachers.find((teacher) => teacher.id === teacherId)?.name ?? '';
  return slotLessons(slot).map((lesson) => ({
    subject: lesson.subject,
    teacherName: nameOf(lesson.teacherId),
    roomId: lesson.roomId ?? '',
  }));
}

function emptyDraft(): LessonDraft {
  return { subject: '', teacherName: '', roomId: '' };
}

interface SlotFormProps {
  target: SlotTarget;
  teachers: Teacher[];
  rooms: Room[];
  onSaved: () => void;
  onRemove: (slot: TimetableSlot) => void;
}

function SlotForm({ target, teachers, rooms, onSaved, onRemove }: SlotFormProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const existingSlot = target.slot;
  const [split, setSplit] = useState(existingSlot ? isSplitSlot(existingSlot) : false);
  const [drafts, setDrafts] = useState<LessonDraft[]>(() => draftsFromSlot(existingSlot, teachers));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (index: number, patch: Partial<LessonDraft>) =>
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));

  const toggleSplit = (next: boolean) => {
    setSplit(next);
    setDrafts((current) => {
      if (!next) return current.slice(0, 1);
      return current.length >= 2 ? current : [...current, emptyDraft()];
    });
  };

  const removeGroup = (index: number) => {
    setDrafts((current) => {
      const remaining = current.filter((_, position) => position !== index);
      if (remaining.length < 2) setSplit(false);
      return remaining;
    });
  };

  const resolveTeacher = (name: string): string | null | undefined => {
    const trimmed = name.trim();
    if (trimmed === '') return null;
    const key = normalizeName(trimmed);
    return teachers.find((teacher) => normalizeName(teacher.name) === key)?.id;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const resolved: { subject: string; teacherId: string | null; roomId: string | null }[] = [];
    for (const draft of drafts) {
      const teacherId = resolveTeacher(draft.teacherName);
      if (teacherId === undefined) {
        setError(t('timetable.teacherNotFound', { name: draft.teacherName.trim() }));
        return;
      }
      resolved.push({ subject: draft.subject, teacherId, roomId: draft.roomId || null });
    }

    const groups: TimetableGroup[] = resolved.map((item, index) => ({ groupNumber: index + 1, ...item }));
    setSaving(true);
    try {
      await saveTimetableSlot(institution.id, user.id, {
        classId: target.classId,
        day: target.day,
        period: target.period,
        subject: resolved[0].subject,
        teacherId: resolved[0].teacherId,
        roomId: resolved[0].roomId,
        groups: split ? groups : undefined,
      });
      onSaved();
    } catch (saveError) {
      setError(t(errorKey(saveError)));
    } finally {
      setSaving(false);
    }
  };

  const canAddGroup = split && drafts.length < MAX_TIMETABLE_GROUPS;
  const saveDisabled = saving || drafts.some((draft) => draft.subject.trim() === '');

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl bg-neutral-50 px-4 ring-1 ring-neutral-200">
        <span className="text-sm font-medium text-neutral-800">{t('timetable.splitToggle')}</span>
        <input
          type="checkbox"
          role="switch"
          checked={split}
          onChange={(event) => toggleSplit(event.target.checked)}
          className="size-5 accent-primary-600"
        />
      </label>

      {split ? (
        <>
          {drafts.map((draft, index) => (
            <GroupCard
              key={index}
              index={index}
              draft={draft}
              teachers={teachers}
              rooms={rooms}
              classId={target.classId}
              onChange={(patch) => updateDraft(index, patch)}
              onRemove={() => removeGroup(index)}
            />
          ))}
          {canAddGroup ? (
            <Button variant="secondary" onClick={() => setDrafts((current) => [...current, emptyDraft()])} icon={<Plus className="size-5" aria-hidden />}>
              {t('timetable.addGroup')}
            </Button>
          ) : null}
        </>
      ) : (
        <LessonFields
          idPrefix="slot"
          draft={drafts[0]}
          teachers={teachers}
          rooms={rooms}
          classId={target.classId}
          onChange={(patch) => updateDraft(0, patch)}
        />
      )}

      <FormError message={error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {existingSlot ? (
          <Button variant="ghost" onClick={() => onRemove(existingSlot)} icon={<Trash2 className="size-5" aria-hidden />}>
            {t('timetable.clearSlot')}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saveDisabled}>
          {t('timetable.saveSlot')}
        </Button>
      </div>
    </form>
  );
}

interface GroupCardProps {
  index: number;
  draft: LessonDraft;
  teachers: Teacher[];
  rooms: Room[];
  classId: string;
  onChange: (patch: Partial<LessonDraft>) => void;
  onRemove: () => void;
}

function GroupCard({ index, draft, teachers, rooms, classId, onChange, onRemove }: GroupCardProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-neutral-900">{t('timetable.groupLabel', { number: index + 1 })}</h3>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('timetable.removeGroup')}
          className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-danger-50 hover:text-danger-700"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <LessonFields idPrefix={`group-${index}`} draft={draft} teachers={teachers} rooms={rooms} classId={classId} onChange={onChange} />
    </section>
  );
}

interface LessonFieldsProps {
  idPrefix: string;
  draft: LessonDraft;
  teachers: Teacher[];
  rooms: Room[];
  classId: string;
  onChange: (patch: Partial<LessonDraft>) => void;
}

function LessonFields({ idPrefix, draft, teachers, rooms, classId, onChange }: LessonFieldsProps) {
  const { t } = useTranslation();
  const subjectKey = normalizeName(draft.subject);
  const assigned = teachers.filter((teacher) =>
    teacher.assignments.some((item) => item.classId === classId && (subjectKey === '' || normalizeName(item.subject) === subjectKey)),
  );
  const listId = `${idPrefix}-teachers`;
  const otherTeachers = teachers.filter((teacher) => !assigned.includes(teacher));

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${idPrefix}-subject`}
        label={t('timetable.subject')}
        value={draft.subject}
        maxLength={TEXT_MAX_LENGTH}
        onChange={(event) => onChange({ subject: event.target.value })}
        required
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-teacher`} className="text-sm font-medium text-neutral-700">
          {t('timetable.teacher')}
        </label>
        <input
          id={`${idPrefix}-teacher`}
          list={listId}
          value={draft.teacherName}
          onChange={(event) => onChange({ teacherName: event.target.value })}
          placeholder={t('timetable.noTeacher')}
          autoComplete="off"
          className="min-h-12 w-full rounded-xl bg-white px-4 text-base text-neutral-900 ring-1 ring-neutral-300 transition focus:outline-none focus:ring-4 focus:ring-primary-500/15"
        />
        <datalist id={listId}>
          {[...assigned, ...otherTeachers].map((teacher) => (
            <option key={teacher.id} value={teacher.name} />
          ))}
        </datalist>
        {assigned.length > 0 ? <p className="text-xs text-neutral-500">{t('timetable.suggestedTeachers')}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-room`} className="text-sm font-medium text-neutral-700">
          {t('timetable.room')}
        </label>
        <select
          id={`${idPrefix}-room`}
          value={draft.roomId}
          onChange={(event) => onChange({ roomId: event.target.value })}
          className="min-h-12 w-full rounded-xl bg-white px-4 text-base text-neutral-900 ring-1 ring-neutral-300 transition focus:outline-none focus:ring-4 focus:ring-primary-500/15"
        >
          <option value="">{t('timetable.noRoom')}</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
