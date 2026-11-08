import { useCallback, useState, type FormEvent } from 'react';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TextField } from '@/components/ui/TextField';
import { UndoToast } from '@/components/ui/UndoToast';
import { CLASS_NAME_MAX_LENGTH, createClass, deleteClass, renameClass, restoreClass } from '@/db/classes';
import { loadStudentWorkspace } from '@/db/students';
import type { SchoolClass, Student } from '@/db/types';
import { CLASS_LEVELS, classLevelOf } from '@/utils/classLevel';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { useAsyncData } from '@/utils/useAsyncData';

interface ClassesScreenProps {
  onBack: () => void;
}

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

type Dialog = { kind: 'rename'; schoolClass: SchoolClass } | { kind: 'delete'; schoolClass: SchoolClass } | null;

export function ClassesScreen({ onBack }: ClassesScreenProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const isHead = user.role === 'head';
  const workspace = useAsyncData(() => loadStudentWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const dismissUndo = useCallback(() => setUndo(null), []);
  const classes = workspace.data?.classes ?? [];
  const students = workspace.data?.students ?? [];

  const handleDeleted = (schoolClass: SchoolClass) => {
    setDialog(null);
    setUndo({
      id: Date.now(),
      message: t('classes.deleted', { name: schoolClass.name }),
      onUndo: () => {
        restoreClass(schoolClass.id, user.id)
          .then(() => workspace.reload())
          .catch((error: unknown) => setActionError(t(errorKey(error))));
      },
    });
    workspace.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('classes.title')} subtitle={isHead ? t('classes.subtitle') : t('classes.readOnly')} onBack={onBack} />

      {isHead ? <AddClassForm institutionId={institution.id} actorId={user.id} onCreated={workspace.reload} /> : null}

      <FormError message={actionError} />

      {workspace.loading && !workspace.data ? (
        <LoadingState />
      ) : workspace.error ? (
        <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-7" aria-hidden />}
          title={t('classes.emptyTitle')}
          body={isHead ? t('classes.emptyBody') : t('classes.emptyReadOnly')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {classes.map((schoolClass) => (
            <ClassRow
              key={schoolClass.id}
              schoolClass={schoolClass}
              studentCount={countStudents(students, schoolClass.id)}
              isHead={isHead}
              onRename={() => setDialog({ kind: 'rename', schoolClass })}
              onDelete={() => setDialog({ kind: 'delete', schoolClass })}
            />
          ))}
        </ul>
      )}

      {dialog?.kind === 'rename' ? (
        <RenameClassDialog
          key={dialog.schoolClass.id}
          schoolClass={dialog.schoolClass}
          actorId={user.id}
          onClose={() => setDialog(null)}
          onRenamed={() => {
            setDialog(null);
            workspace.reload();
          }}
        />
      ) : null}

      {dialog?.kind === 'delete' ? (
        <DeleteClassDialog
          schoolClass={dialog.schoolClass}
          studentCount={countStudents(students, dialog.schoolClass.id)}
          actorId={user.id}
          onClose={() => setDialog(null)}
          onDeleted={handleDeleted}
        />
      ) : null}

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={dismissUndo} /> : null}
    </div>
  );
}

function countStudents(students: Student[], classId: string): number {
  return students.filter((student) => student.classId === classId).length;
}

interface AddClassFormProps {
  institutionId: string;
  actorId: string;
  onCreated: () => void;
}

function AddClassForm({ institutionId, actorId, onCreated }: AddClassFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createClass(institutionId, draft, actorId);
      setDraft('');
      onCreated();
    } catch (createError) {
      setError(t(errorKey(createError)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <TextField
        label={t('classes.name')}
        placeholder={t('classes.namePlaceholder')}
        maxLength={CLASS_NAME_MAX_LENGTH}
        value={draft}
        error={error}
        onChange={(event) => {
          setError(null);
          setDraft(event.target.value);
        }}
      />
      <Button type="submit" fullWidth disabled={submitting} icon={<Plus className="size-5" aria-hidden />}>
        {t('classes.add')}
      </Button>
    </form>
  );
}

interface ClassRowProps {
  schoolClass: SchoolClass;
  studentCount: number;
  isHead: boolean;
  onRename: () => void;
  onDelete: () => void;
}

function ClassRow({ schoolClass, studentCount, isHead, onRename, onDelete }: ClassRowProps) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 animate-fade-in">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-medium text-neutral-900">{schoolClass.name}</span>
        <span className="text-sm text-neutral-500">{t('classes.studentCount', { count: studentCount })}</span>
      </span>
      {isHead ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRename}
            aria-label={t('classes.rename')}
            className="flex size-11 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-neutral-100"
          >
            <Pencil className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t('classes.delete')}
            className="flex size-11 items-center justify-center rounded-xl text-danger-700 transition hover:bg-danger-50"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </span>
      ) : null}
    </li>
  );
}

interface RenameClassDialogProps {
  schoolClass: SchoolClass;
  actorId: string;
  onClose: () => void;
  onRenamed: () => void;
}

function RenameClassDialog({ schoolClass, actorId, onClose, onRenamed }: RenameClassDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(schoolClass.name);
  const [level, setLevel] = useState<string>(String(classLevelOf(schoolClass) ?? 'none'));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await renameClass(schoolClass.id, name, level === 'none' ? null : Number(level), actorId);
      onRenamed();
    } catch (renameError) {
      setError(t(errorKey(renameError)));
      setSubmitting(false);
    }
  };

  return (
    <Modal open title={t('classes.renameTitle')} onClose={onClose}>
      <form noValidate onSubmit={handleSave} className="flex flex-col gap-5">
        <TextField
          label={t('classes.name')}
          maxLength={CLASS_NAME_MAX_LENGTH}
          value={name}
          error={error}
          onChange={(event) => {
            setError(null);
            setName(event.target.value);
          }}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">{t('classes.level')}</span>
          <SegmentedControl
            options={[
              ...CLASS_LEVELS.map((item) => ({ id: String(item), label: String(item) })),
              { id: 'none', label: t('classes.levelNone') },
            ]}
            value={level}
            onChange={setLevel}
          />
        </div>
        <Button type="submit" fullWidth disabled={submitting}>
          {t('common.save')}
        </Button>
      </form>
    </Modal>
  );
}

interface DeleteClassDialogProps {
  schoolClass: SchoolClass;
  studentCount: number;
  actorId: string;
  onClose: () => void;
  onDeleted: (schoolClass: SchoolClass) => void;
}

function DeleteClassDialog({ schoolClass, studentCount, actorId, onClose, onDeleted }: DeleteClassDialogProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const blocked = studentCount > 0;

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteClass(schoolClass.id, actorId);
      onDeleted(schoolClass);
    } catch (deleteError) {
      setError(t(errorKey(deleteError)));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title={t('classes.deleteTitle', { name: schoolClass.name })}
      description={blocked ? t('classes.deleteBlocked', { count: studentCount }) : t('classes.deleteBody')}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <FormError message={error} />
        <Button variant="danger" fullWidth onClick={handleDelete} disabled={submitting || blocked}>
          {t('classes.delete')}
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </div>
    </Modal>
  );
}
