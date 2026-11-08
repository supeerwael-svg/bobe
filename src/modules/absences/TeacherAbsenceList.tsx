import { useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { UndoToast } from '@/components/ui/UndoToast';
import { EmptyState, FormError } from '@/components/ui/StatusBlock';
import { deleteTeacherAbsence, restoreTeacherAbsence } from '@/db/absences';
import type { TeacherAbsence } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { affectedClassIds, teacherAbsenceHours } from '@/utils/absences';
import { errorKey } from '@/utils/errors';

interface TeacherAbsenceListProps {
  records: TeacherAbsence[];
  teacherNameById: Map<string, string>;
  classNameById: Map<string, string>;
  onChanged: () => void;
}

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

export function TeacherAbsenceList({ records, teacherNameById, classNameById, onChanged }: TeacherAbsenceListProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [pending, setPending] = useState<TeacherAbsence | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || a.createdAt.localeCompare(b.createdAt));

  const handleDelete = async () => {
    const record = pending;
    if (!record) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteTeacherAbsence(record.id, user.id);
      setPending(null);
      setUndo({
        id: Date.now(),
        message: t('absences.removed', { name: teacherNameById.get(record.teacherId) ?? '' }),
        onUndo: () => {
          restoreTeacherAbsence(record.id, user.id)
            .then(onChanged)
            .catch((cause: unknown) => setActionError(t(errorKey(cause))));
        },
      });
      onChanged();
    } catch (cause) {
      setPending(null);
      setActionError(t(errorKey(cause)));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-700">{t('absences.recorded')}</h2>
      <FormError message={actionError} />

      {sorted.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-7" aria-hidden />} title={t('absences.noRecords')} body="" />
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((record) => {
            const lessons = record.lessons;
            const classIds = affectedClassIds(lessons);
            return (
              <li key={record.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{teacherNameById.get(record.teacherId) ?? ''}</p>
                    <p className="text-xs text-neutral-500">{record.date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending(record)}
                    aria-label={t('absences.deleteRecord')}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-danger-600 transition duration-200 hover:bg-danger-50"
                  >
                    <Trash2 className="size-5" aria-hidden />
                  </button>
                </div>
                <p className="text-sm text-neutral-700">
                  {t('absences.hoursAbsent')}: <span className="font-semibold">{t('absences.hours', { count: teacherAbsenceHours(lessons) })}</span>
                </p>
                <p className="text-sm text-neutral-700">
                  {lessons.map((lesson) => `${lesson.subject} (${classNameById.get(lesson.classId) ?? ''})`).join(' · ')}
                </p>
                {record.reason || record.reasonNote ? (
                  <p className="text-sm text-neutral-700">
                    {t('absences.reason.label')}:{' '}
                    <span className="font-semibold">
                      {record.reason ? t(`absences.reason.${record.reason}`) : ''}
                      {record.reasonNote ? `${record.reason ? ' - ' : ''}${record.reasonNote}` : ''}
                    </span>
                  </p>
                ) : null}
                <p className="text-xs text-neutral-500">
                  {t('absences.affectedClasses')}: {classIds.map((id) => classNameById.get(id) ?? '').join(', ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={pending !== null}
        title={t('absences.deleteTitle')}
        body={t('absences.deleteBody')}
        confirmLabel={t('absences.deleteRecord')}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPending(null)}
      />

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={() => setUndo(null)} /> : null}
    </section>
  );
}
