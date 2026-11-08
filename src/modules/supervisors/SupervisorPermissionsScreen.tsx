import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { getActiveUser, defaultPermissions, removeSupervisor, updateSupervisorPermissions } from '@/db/users';
import { listClasses } from '@/db/classes';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { useSession } from '@/modules/auth/AuthContext';
import type { SchoolClass, SearchScope, SupervisorPermissions, User } from '@/db/types';
import { errorKey } from '@/utils/errors';
import { useAsyncData } from '@/utils/useAsyncData';
import { ClassAssignmentEditor } from './ClassAssignmentEditor';
import { ModuleAccessEditor } from './ModuleAccessEditor';

interface SupervisorPermissionsScreenProps {
  userId: string;
  onBack: () => void;
}

export function SupervisorPermissionsScreen({ userId, onBack }: SupervisorPermissionsScreenProps) {
  const { t } = useTranslation();
  const { institution } = useSession();
  const data = useAsyncData(
    () => Promise.all([getActiveUser(userId), listClasses(institution.id)]),
    [userId, institution.id],
  );

  return (
    <div className="flex flex-col gap-6">
      {data.loading && !data.data ? (
        <LoadingState />
      ) : data.error || !data.data ? (
        <>
          <SubpageHeader title={t('supervisors.permissionsTitle')} onBack={onBack} />
          <ErrorState message={t(errorKey(data.error))} onRetry={data.reload} />
        </>
      ) : (
        <PermissionsForm key={data.data[0].id} supervisor={data.data[0]} classes={data.data[1]} onBack={onBack} />
      )}
    </div>
  );
}

interface PermissionsFormProps {
  supervisor: User;
  classes: SchoolClass[];
  onBack: () => void;
}

function PermissionsForm({ supervisor, classes, onBack }: PermissionsFormProps) {
  const { t } = useTranslation();
  const { user: actor } = useSession();
  const [draft, setDraft] = useState<SupervisorPermissions>(() => supervisor.permissions ?? defaultPermissions());
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const update = (next: Partial<SupervisorPermissions>) => {
    setSaved(false);
    setDraft((previous) => ({ ...previous, ...next }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateSupervisorPermissions(supervisor.id, draft, actor.id);
      setSaved(true);
    } catch (saveError) {
      setError(t(errorKey(saveError)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await removeSupervisor(supervisor.id, actor.id);
      onBack();
    } catch (removeError) {
      setError(t(errorKey(removeError)));
      setSubmitting(false);
      setRemoveOpen(false);
    }
  };

  const scopes: { value: SearchScope; label: string; hint: string }[] = [
    { value: 'assigned', label: t('supervisors.scopeAssigned'), hint: t('supervisors.scopeAssignedHint') },
    { value: 'institution', label: t('supervisors.scopeInstitution'), hint: t('supervisors.scopeInstitutionHint') },
  ];

  return (
    <>
      <SubpageHeader title={supervisor.name} subtitle={t('supervisors.permissionsSubtitle')} onBack={onBack} />

      <Section>
        <ClassAssignmentEditor
          classes={classes}
          selectedIds={draft.assignedClasses}
          onChange={(assignedClasses) => update({ assignedClasses })}
        />
      </Section>

      <Section>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-medium text-neutral-800">{t('supervisors.searchScope')}</legend>
          {scopes.map((scope) => {
            const active = draft.searchScope === scope.value;
            return (
              <label
                key={scope.value}
                className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 transition duration-200 ${
                  active ? 'bg-primary-50 ring-primary-500' : 'bg-white ring-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="search-scope"
                  value={scope.value}
                  checked={active}
                  onChange={() => update({ searchScope: scope.value })}
                  className="mt-1 size-5 accent-primary-600"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-medium text-neutral-900">{scope.label}</span>
                  <span className="text-sm text-neutral-600">{scope.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </Section>

      <Section>
        <ModuleAccessEditor modules={draft.modules} onChange={(moduleId, level) => update({ modules: { ...draft.modules, [moduleId]: level } })} />
      </Section>

      <FormError message={error} />
      <div className="sticky bottom-24 z-10 flex flex-col items-stretch gap-2">
        <Button fullWidth onClick={handleSave} disabled={submitting} className="shadow-lg">
          {t('supervisors.savePermissions')}
        </Button>
        {saved ? (
          <p role="status" className="text-center text-sm font-medium text-success-700 animate-fade-in">
            {t('supervisors.permissionsSaved')}
          </p>
        ) : null}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-danger-200 bg-white p-5">
        <Button variant="ghost" fullWidth onClick={() => setRemoveOpen(true)} className="text-danger-700 hover:bg-danger-50" icon={<Trash2 className="size-5" aria-hidden />}>
          {t('supervisors.removeSupervisor')}
        </Button>
      </section>

      <Modal open={removeOpen} title={t('supervisors.removeTitle')} description={t('supervisors.removeBody')} onClose={() => setRemoveOpen(false)}>
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" fullWidth onClick={handleRemove} disabled={submitting}>
            {t('supervisors.removeSupervisor')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setRemoveOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">{children}</section>;
}
