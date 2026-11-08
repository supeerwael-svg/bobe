import { useState, type FormEvent } from 'react';
import { ChevronRight, Plus, RefreshCw, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { TextField } from '@/components/ui/TextField';
import { UndoToast } from '@/components/ui/UndoToast';
import { createTeacher, regenerateTeacherAssignments, restoreTeacher } from '@/db/teachers';
import { loadTimetableWorkspace } from '@/db/timetable';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { useAsyncData } from '@/utils/useAsyncData';
import { TeacherDetailModal } from './TeacherDetailModal';

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

export function TeachersView() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadTimetableWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const data = workspace.data;
  const teachers = data?.teachers ?? [];
  const classes = data?.classes ?? [];
  const classNameById = new Map(classes.map((item) => [item.id, item.name]));
  const selected = teachers.find((item) => item.id === selectedId) ?? null;

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdding(true);
    setActionError(null);
    setNotice(null);
    try {
      await createTeacher(institution.id, name, user.id);
      setName('');
      workspace.reload();
    } catch (error) {
      setActionError(t(errorKey(error)));
    } finally {
      setAdding(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setActionError(null);
    try {
      await regenerateTeacherAssignments(institution.id, user.id);
      setRebuildOpen(false);
      setNotice(t('teachers.regenerated'));
      workspace.reload();
    } catch (error) {
      setRebuildOpen(false);
      setActionError(t(errorKey(error)));
    } finally {
      setRebuilding(false);
    }
  };

  if (workspace.loading && !data) return <LoadingState />;
  if (workspace.error) return <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <TextField
            id="teacher-name"
            label={t('teachers.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={adding || name.trim() === ''} icon={<Plus className="size-5" aria-hidden />}>
          {t('teachers.add')}
        </Button>
      </form>

      <FormError message={actionError} />
      {notice ? <p className="rounded-xl bg-success-50 px-4 py-3 text-sm text-success-800">{notice}</p> : null}

      {teachers.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-7" aria-hidden />}
          title={t('teachers.title')}
          body={t('teachers.empty')}
        />
      ) : (
        <>
          <Button variant="secondary" onClick={() => setRebuildOpen(true)} icon={<RefreshCw className="size-5" aria-hidden />}>
            {t('teachers.regenerate')}
          </Button>
          <ul className="flex flex-col gap-3">
            {teachers.map((teacher) => (
              <li key={teacher.id} className="animate-fade-in">
                <button
                  type="button"
                  onClick={() => setSelectedId(teacher.id)}
                  className="flex min-h-16 w-full items-center gap-4 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-neutral-200 transition duration-200 hover:-translate-y-0.5 hover:ring-primary-300 active:scale-[0.99]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800">
                    {teacher.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-semibold text-neutral-900">{teacher.name}</span>
                    <span className="truncate text-sm text-neutral-600">
                      {teacher.assignments.length === 0
                        ? t('teachers.noAssignments')
                        : teacher.assignments
                            .map((item) => `${classNameById.get(item.classId) ?? ''} · ${item.subject}`)
                            .join(', ')}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-neutral-400 rtl:rotate-180" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <TeacherDetailModal
        teacher={selected}
        classes={classes}
        classNameById={classNameById}
        onClose={() => setSelectedId(null)}
        onChanged={workspace.reload}
        onDeleted={(deleted) => {
          setSelectedId(null);
          setUndo({
            id: Date.now(),
            message: t('teachers.deleted', { name: deleted.name }),
            onUndo: () => {
              restoreTeacher(deleted.id, user.id)
                .then(() => workspace.reload())
                .catch((error: unknown) => setActionError(t(errorKey(error))));
            },
          });
          workspace.reload();
        }}
      />

      <ConfirmModal
        open={rebuildOpen}
        title={t('teachers.regenerate')}
        body={t('teachers.regenerateBody')}
        confirmLabel={t('teachers.regenerate')}
        busy={rebuilding}
        onConfirm={handleRebuild}
        onCancel={() => setRebuildOpen(false)}
      />

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={() => setUndo(null)} /> : null}
    </div>
  );
}
