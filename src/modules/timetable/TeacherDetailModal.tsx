import { useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { addTeacherAssignment, deleteTeacher, removeTeacherAssignment } from '@/db/teachers';
import { TEXT_MAX_LENGTH } from '@/db/studentRules';
import type { SchoolClass, Teacher, TeacherAssignment } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';

interface TeacherDetailModalProps {
  teacher: Teacher | null;
  classes: SchoolClass[];
  classNameById: Map<string, string>;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: (teacher: Teacher) => void;
}

export function TeacherDetailModal({ teacher, classes, classNameById, onClose, onChanged, onDeleted }: TeacherDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<TeacherAssignment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const runAction = async (action: () => Promise<void>, after: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after();
    } catch (actionError) {
      setError(t(errorKey(actionError)));
    } finally {
      setBusy(false);
    }
  };

  const handleAddAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!teacher || classId === '') return;
    const cleanSubject = subject.trim();
    void runAction(() => addTeacherAssignment(teacher.id, classId, cleanSubject, user.id), () => {
      setSubject('');
      onChanged();
    });
  };

  const handleRemoveAssignment = () => {
    const assignment = pendingRemoval;
    if (!teacher || !assignment) return;
    void runAction(() => removeTeacherAssignment(teacher.id, assignment.classId, assignment.subject, user.id), () => {
      setPendingRemoval(null);
      onChanged();
    });
  };

  const handleDelete = () => {
    if (!teacher) return;
    void runAction(() => deleteTeacher(teacher.id, user.id), () => {
      setConfirmDelete(false);
      onDeleted(teacher);
    });
  };

  return (
    <>
      <Modal open={teacher !== null} title={teacher?.name ?? ''} onClose={onClose}>
        {teacher ? (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-neutral-700">{t('teachers.assignmentsTitle')}</h3>
              {teacher.assignments.length === 0 ? (
                <p className="text-sm text-neutral-500">{t('teachers.noAssignments')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {teacher.assignments.map((assignment) => (
                    <li
                      key={`${assignment.classId}-${assignment.subject}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200"
                    >
                      <span className="min-w-0 truncate text-sm text-neutral-900">
                        <span className="font-semibold">{classNameById.get(assignment.classId) ?? ''}</span> · {assignment.subject}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingRemoval(assignment)}
                        aria-label={t('teachers.removeAssignment')}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-danger-50 hover:text-danger-700"
                      >
                        <X className="size-5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form onSubmit={handleAddAssignment} className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
              <h3 className="text-sm font-semibold text-neutral-700">{t('teachers.addAssignment')}</h3>
              <div className="flex flex-col gap-2">
                <label htmlFor="assignment-class" className="text-sm font-medium text-neutral-700">
                  {t('teachers.assignClass')}
                </label>
                <select
                  id="assignment-class"
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  className="min-h-12 w-full rounded-xl bg-white px-4 text-base text-neutral-900 ring-1 ring-neutral-300 transition focus:outline-none focus:ring-4 focus:ring-primary-500/15"
                >
                  <option value="">{classes.length === 0 ? t('teachers.noClasses') : '-'}</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                id="assignment-subject"
                label={t('teachers.assignSubject')}
                value={subject}
                maxLength={TEXT_MAX_LENGTH}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <Button type="submit" disabled={busy || classId === '' || subject.trim() === ''}>
                {t('teachers.addAssignment')}
              </Button>
            </form>

            <FormError message={error} />

            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 className="size-5" aria-hidden />}
              className="text-danger-700 hover:bg-danger-50"
            >
              {t('teachers.deleteTeacher')}
            </Button>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={pendingRemoval !== null}
        title={t('teachers.removeAssignmentTitle')}
        body={t('teachers.removeAssignmentBody')}
        confirmLabel={t('teachers.removeAssignment')}
        busy={busy}
        onConfirm={handleRemoveAssignment}
        onCancel={() => setPendingRemoval(null)}
      />

      <ConfirmModal
        open={confirmDelete && teacher !== null}
        title={t('teachers.deleteTitle', { name: teacher?.name ?? '' })}
        body={t('teachers.deleteBody')}
        confirmLabel={t('teachers.deleteTeacher')}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
