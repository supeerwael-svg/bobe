import { useMemo, type ReactNode } from 'react';
import { CalendarDays, DoorOpen, UserCheck, UserRoundPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/ui/CopyButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/StatusBlock';
import { listSupervisors } from '@/db/users';
import { useSession } from '@/modules/auth/AuthContext';
import { weekdayName } from '@/utils/calendar';
import { errorKey } from '@/utils/errors';
import { formatInviteCode } from '@/utils/invite';
import { useAsyncData } from '@/utils/useAsyncData';

interface HomeScreenProps {
  onNavigate: (tab: 'supervisors') => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const isHead = user.role === 'head';

  const supervisors = useAsyncData(
    () => (isHead ? listSupervisors(institution.id) : Promise.resolve([])),
    [institution.id, isHead],
  );

  const pendingCount = useMemo(
    () => supervisors.data?.filter((item) => item.status === 'pending').length ?? 0,
    [supervisors.data],
  );
  const approvedCount = useMemo(
    () => supervisors.data?.filter((item) => item.status === 'approved').length ?? 0,
    [supervisors.data],
  );

  const workingDays = [...institution.workingDays]
    .sort((a, b) => a - b)
    .map((day) => weekdayName(day, i18n.language))
    .join(' · ');
  const inviteCode = formatInviteCode(institution.inviteCode);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
          {isHead ? t('home.roleHead') : t('home.roleSupervisor')}
        </span>
        <h1 className="text-3xl text-neutral-900">{t('home.greeting', { name: user.name })}</h1>
        <p className="text-base text-neutral-600">{t('home.greetingSubtitle')}</p>
      </section>

      {isHead ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">{t('home.inviteCode')}</span>
              <span className="font-mono text-2xl font-bold tracking-widest text-neutral-900" dir="ltr">
                {inviteCode}
              </span>
            </div>
            <CopyButton value={inviteCode} />
          </div>
          <p className="text-sm text-neutral-600">{t('home.inviteCodeHint')}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<DoorOpen className="size-5" aria-hidden />} label={t('home.rooms')} value={String(institution.rooms)} tone="primary" />
        <StatCard
          icon={<CalendarDays className="size-5" aria-hidden />}
          label={t('home.holidays')}
          value={String(institution.holidays.length)}
          tone="accent"
        />
        <div className="col-span-2">
          <StatCard
            icon={<CalendarDays className="size-5" aria-hidden />}
            label={t('home.workingDays')}
            value={workingDays || t('home.noWorkingDays')}
            tone="secondary"
            wide
          />
        </div>
      </section>

      {isHead ? (
        supervisors.loading ? (
          <LoadingState />
        ) : supervisors.error ? (
          <ErrorState message={t(errorKey(supervisors.error))} onRetry={supervisors.reload} />
        ) : (
          <section className="grid grid-cols-2 gap-3">
            <StatCard icon={<UserCheck className="size-5" aria-hidden />} label={t('home.supervisors')} value={String(approvedCount)} tone="success" />
            <button
              type="button"
              onClick={() => onNavigate('supervisors')}
              className="flex flex-col gap-3 rounded-2xl bg-white p-5 text-start shadow-sm ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
                <UserRoundPlus className="size-5" aria-hidden />
              </span>
              <span className="text-sm text-neutral-600">{t('home.pending')}</span>
              <span className="flex w-full items-center justify-between gap-2 text-2xl font-bold text-neutral-900">
                {pendingCount}
                <span className="text-sm font-medium text-primary-700">{t('home.reviewPending')}</span>
              </span>
            </button>
          </section>
        )
      ) : null}

      <EmptyState icon={<Users className="size-7" aria-hidden />} title={t('home.emptyTitle')} body={t('home.emptyBody')} />
    </div>
  );
}

const TONE_CLASSES = {
  primary: 'bg-primary-50 text-primary-700',
  secondary: 'bg-secondary-50 text-secondary-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-success-50 text-success-700',
} as const;

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  tone: keyof typeof TONE_CLASSES;
  wide?: boolean;
}

function StatCard({ icon, label, value, tone, wide = false }: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <span className={`flex size-10 items-center justify-center rounded-xl ${TONE_CLASSES[tone]}`}>{icon}</span>
      <span className="text-sm text-neutral-600">{label}</span>
      <span className={`font-bold text-neutral-900 ${wide ? 'text-lg' : 'text-2xl'}`}>{value}</span>
    </div>
  );
}
