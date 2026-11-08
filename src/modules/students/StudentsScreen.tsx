import { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet, GraduationCap, Plus, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { UndoToast } from '@/components/ui/UndoToast';
import { loadStudentWorkspace, restoreStudent } from '@/db/students';
import { isStudentActive } from '@/utils/statistics';
import type { Student } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { ClassesScreen } from '@/modules/students/ClassesScreen';
import { StudentDetail } from '@/modules/students/StudentDetail';
import { StudentForm } from '@/modules/students/StudentForm';
import { StudentImportScreen } from '@/modules/students/import/StudentImportScreen';
import { StudentListItem } from '@/modules/students/StudentListItem';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';
import { normalizeText } from '@/utils/text';
import { useAsyncData } from '@/utils/useAsyncData';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; student: Student }
  | { kind: 'form'; student: Student | null }
  | { kind: 'classes' }
  | { kind: 'import' };

interface UndoState {
  id: number;
  message: string;
  onUndo: () => void;
}

export function StudentsScreen() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadStudentWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dismissUndo = useCallback(() => setUndo(null), []);

  const data = workspace.data;
  const classes = useMemo(() => data?.classes ?? [], [data]);
  const students = useMemo(() => data?.students ?? [], [data]);
  const classNameById = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const canEdit = data?.access.canEdit ?? false;
  const canAdd = canEdit && classes.length > 0;
  const today = todayIso();

  const visibleStudents = useMemo(() => {
    const needle = normalizeText(query);
    return students.filter(
      (student) =>
        (classFilter === null || student.classId === classFilter) &&
        (needle === '' || normalizeText(`${student.firstName} ${student.lastName}`).includes(needle)),
    );
  }, [students, query, classFilter]);

  const backToList = () => {
    setView({ kind: 'list' });
    workspace.reload();
  };

  if (view.kind === 'classes') return <ClassesScreen onBack={backToList} />;
  if (view.kind === 'import') return <StudentImportScreen onBack={backToList} />;
  if (view.kind === 'form') {
    return <StudentForm student={view.student} classes={classes} onBack={backToList} onSaved={backToList} />;
  }
  if (view.kind === 'detail' && data) {
    return (
      <StudentDetail
        student={view.student}
        classes={classes}
        access={data.access}
        onBack={backToList}
        onEdit={() => setView({ kind: 'form', student: view.student })}
        onDeleted={(deleted) => {
          setView({ kind: 'list' });
          setUndo({
            id: Date.now(),
            message: t('students.deleted', { name: `${deleted.firstName} ${deleted.lastName}` }),
            onUndo: () => {
              restoreStudent(deleted.id, user.id)
                .then(() => workspace.reload())
                .catch((error: unknown) => setActionError(t(errorKey(error))));
            },
          });
          workspace.reload();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl text-neutral-900">{t('students.title')}</h1>
          <p className="text-base text-neutral-600">{t('students.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdd ? (
            <Button onClick={() => setView({ kind: 'form', student: null })} icon={<Plus className="size-5" aria-hidden />}>
              {t('students.add')}
            </Button>
          ) : null}
          {canAdd ? (
            <Button variant="secondary" onClick={() => setView({ kind: 'import' })} icon={<FileSpreadsheet className="size-5" aria-hidden />}>
              {t('students.importExcel')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setView({ kind: 'classes' })} icon={<GraduationCap className="size-5" aria-hidden />}>
            {t('students.manageClasses')}
          </Button>
        </div>
      </header>

      <FormError message={actionError} />

      {workspace.loading && !data ? (
        <LoadingState />
      ) : workspace.error ? (
        <ErrorState message={t(errorKey(workspace.error))} onRetry={workspace.reload} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-7" aria-hidden />}
          title={t('students.noClassesTitle')}
          body={canEdit ? t('students.noClassesBody') : t('students.noAssignedClasses')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <label className="flex min-h-12 items-center gap-3 rounded-xl bg-white px-4 ring-1 ring-neutral-300 transition focus-within:ring-4 focus-within:ring-primary-500/15">
              <Search className="size-5 shrink-0 text-neutral-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('students.searchPlaceholder')}
                className="min-h-12 w-full bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </label>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <FilterChip label={t('students.allClasses')} active={classFilter === null} onClick={() => setClassFilter(null)} />
              {classes.map((schoolClass) => (
                <FilterChip
                  key={schoolClass.id}
                  label={schoolClass.name}
                  active={classFilter === schoolClass.id}
                  onClick={() => setClassFilter(schoolClass.id)}
                />
              ))}
            </div>
          </div>

          {students.length === 0 ? (
            <EmptyState
              icon={<Users className="size-7" aria-hidden />}
              title={t('students.emptyTitle')}
              body={canEdit ? t('students.emptyBody') : t('students.emptyReadOnly')}
            />
          ) : visibleStudents.length === 0 ? (
            <p className="rounded-2xl bg-white px-6 py-10 text-center text-base text-neutral-500 ring-1 ring-neutral-200">
              {t('students.noMatches')}
            </p>
          ) : (
            <>
              <p className="text-sm text-neutral-500">{t('students.resultCount', { count: visibleStudents.length })}</p>
              <ul className="flex flex-col gap-3">
                {visibleStudents.map((student) => (
                  <StudentListItem
                    key={student.id}
                    student={student}
                    className={classNameById.get(student.classId) ?? t('students.unknownClass')}
                    left={!isStudentActive(student, today)}
                    onOpen={() => setView({ kind: 'detail', student })}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {undo ? <UndoToast key={undo.id} message={undo.message} onUndo={undo.onUndo} onExpire={dismissUndo} /> : null}
    </div>
  );
}
