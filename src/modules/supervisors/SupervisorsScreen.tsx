import { useState } from 'react';
import { FileSpreadsheet, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SupervisorPermissionsScreen } from './SupervisorPermissionsScreen';
import { SupervisorRow } from './SupervisorRow';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/StatusBlock';
import { Button } from '@/components/ui/Button';
import { listClasses } from '@/db/classes';
import { listSupervisors, setSupervisorStatus } from '@/db/users';
import type { User, UserStatus } from '@/db/types';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { exportRowsToExcel } from '@/utils/spreadsheet';
import { useAsyncData } from '@/utils/useAsyncData';

const STATUS_ORDER: UserStatus[] = ['pending', 'approved', 'rejected'];

export function SupervisorsScreen() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const supervisors = useAsyncData(
    () => Promise.all([listSupervisors(institution.id), listClasses(institution.id)]),
    [institution.id],
  );
  const data = supervisors.data?.[0];
  const classNameById = new Map((supervisors.data?.[1] ?? []).map((item) => [item.id, item.name]));
  const namesFor = (user: User) =>
    (user.permissions?.assignedClasses ?? []).map((id) => classNameById.get(id)).filter((name): name is string => Boolean(name));

  if (selectedId) {
    return (
      <SupervisorPermissionsScreen
        userId={selectedId}
        onBack={() => {
          setSelectedId(null);
          supervisors.reload();
        }}
      />
    );
  }

  const handleSetStatus = async (userId: string, status: UserStatus) => {
    setBusyId(userId);
    setActionError(null);
    try {
      await setSupervisorStatus(userId, status, user.id);
      supervisors.reload();
    } catch (error) {
      setActionError(t(errorKey(error)));
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const rows = (data ?? []).map((supervisor) => ({
      [t('supervisors.columns.name')]: supervisor.name,
      [t('supervisors.columns.status')]: t(`supervisors.status.${supervisor.status}`),
      [t('supervisors.columns.classes')]: namesFor(supervisor).join(', '),
      [t('supervisors.columns.scope')]:
        supervisor.permissions?.searchScope === 'institution' ? t('supervisors.scopeInstitution') : t('supervisors.scopeAssigned'),
    }));
    exportRowsToExcel(rows, t('supervisors.title'), `supervisors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: (data ?? []).filter((item) => item.status === status),
  }));
  const sectionTitles: Record<UserStatus, string> = {
    pending: t('supervisors.pendingSection'),
    approved: t('supervisors.approvedSection'),
    rejected: t('supervisors.rejectedSection'),
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl text-neutral-900">{t('supervisors.title')}</h1>
          <p className="text-base text-neutral-600">{t('supervisors.subtitle')}</p>
        </div>
        {data && data.length > 0 ? (
          <Button variant="secondary" onClick={handleExport} icon={<FileSpreadsheet className="size-5" aria-hidden />} className="self-start">
            {t('supervisors.exportExcel')}
          </Button>
        ) : null}
      </header>

      <FormError message={actionError} />

      {supervisors.loading && !data ? (
        <LoadingState />
      ) : supervisors.error ? (
        <ErrorState message={t(errorKey(supervisors.error))} onRetry={supervisors.reload} />
      ) : data && data.length === 0 ? (
        <EmptyState icon={<Users className="size-7" aria-hidden />} title={t('supervisors.emptyTitle')} body={t('supervisors.emptyBody')} />
      ) : (
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section key={group.status} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{sectionTitles[group.status]}</h2>
              <ul className="flex flex-col gap-3">
                {group.items.map((supervisor: User) => (
                  <SupervisorRow
                    key={supervisor.id}
                    supervisor={supervisor}
                    assignedClassNames={namesFor(supervisor)}
                    busy={busyId === supervisor.id}
                    onOpen={setSelectedId}
                    onSetStatus={handleSetStatus}
                  />
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
