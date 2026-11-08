import { useState } from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/modules/auth/AuthContext';
import { AccountSection } from './AccountSection';
import { InstitutionSettingsScreen } from './InstitutionSettingsScreen';

type SettingsView = 'main' | 'institution';

export function SettingsScreen() {
  const [view, setView] = useState<SettingsView>('main');
  if (view === 'institution') {
    return <InstitutionSettingsScreen onBack={() => setView('main')} />;
  }
  return <SettingsMain onOpenInstitution={() => setView('institution')} />;
}

function SettingsMain({ onOpenInstitution }: { onOpenInstitution: () => void }) {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const isHead = user.role === 'head';
  const roleLabel = isHead ? t('home.roleHead') : t('home.roleSupervisor');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl text-neutral-900">{t('settings.title')}</h1>
        <p className="text-base text-neutral-600">{t('settings.subtitle')}</p>
      </header>

      <AccountSection />

      <section className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xl font-bold text-white">
          {user.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-neutral-500">{t('settings.profile')}</span>
          <span className="truncate text-lg font-bold text-neutral-900">{user.name}</span>
          <span className="text-sm font-medium text-primary-700">{roleLabel}</span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <LanguageSwitch />
      </section>

      {isHead ? (
        <button
          type="button"
          onClick={onOpenInstitution}
          className="group flex min-h-20 w-full items-center gap-4 rounded-2xl bg-white p-5 text-start shadow-sm ring-1 ring-neutral-200 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-lg font-bold text-neutral-900">{t('settings.institutionSettings')}</span>
            <span className="text-sm text-neutral-600">{t('settings.institutionSettingsHint')}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
        </button>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <p className="text-sm text-neutral-600">{t('settings.signOutHint')}</p>
        <Button variant="secondary" fullWidth onClick={signOut} icon={<LogOut className="size-5 rtl:-scale-x-100" aria-hidden />}>
          {t('settings.signOut')}
        </Button>
      </section>
    </div>
  );
}
