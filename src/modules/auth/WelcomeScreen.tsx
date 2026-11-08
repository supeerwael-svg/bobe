import type { ReactNode } from 'react';
import { ChevronRight, KeyRound, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/AppLogo';
import { LanguageToggle } from '@/components/LanguageToggle';

interface WelcomeScreenProps {
  onCreate: () => void;
  onJoin: () => void;
  onLogin: () => void;
}

export function WelcomeScreen({ onCreate, onJoin, onLogin }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="mx-auto flex w-full max-w-md justify-end px-6 pt-6">
        <LanguageToggle />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 pb-10 animate-fade-up">
        <div className="flex flex-col items-start gap-5">
          <AppLogo size="lg" />
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl text-neutral-900">{t('auth.welcomeTitle')}</h1>
            <p className="text-lg text-neutral-600">{t('auth.welcomeSubtitle')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <ChoiceCard
            icon={<UserPlus className="size-6" aria-hidden />}
            title={t('auth.createCard')}
            hint={t('auth.createCardHint')}
            onClick={onCreate}
            tone="primary"
          />
          <ChoiceCard
            icon={<KeyRound className="size-6" aria-hidden />}
            title={t('auth.joinCard')}
            hint={t('auth.joinCardHint')}
            onClick={onJoin}
            tone="secondary"
          />
        </div>

        <button
          type="button"
          onClick={onLogin}
          className="min-h-12 text-center text-base font-medium text-primary-700 underline-offset-4 transition hover:underline"
        >
          {t('auth.loginLink')}
        </button>
      </main>
    </div>
  );
}

interface ChoiceCardProps {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  tone: 'primary' | 'secondary';
}

function ChoiceCard({ icon, title, hint, onClick, tone }: ChoiceCardProps) {
  const tileClasses = tone === 'primary' ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-20 w-full items-center gap-4 rounded-2xl bg-white p-5 text-start shadow-sm ring-1 ring-neutral-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${tileClasses}`}>{icon}</span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-lg font-bold text-neutral-900">{title}</span>
        <span className="text-sm text-neutral-600">{hint}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
    </button>
  );
}
