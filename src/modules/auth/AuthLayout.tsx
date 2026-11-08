import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/AppLogo';
import { LanguageToggle } from '@/components/LanguageToggle';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, onBack, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-4 px-6 pb-2 pt-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-11 items-center gap-1 rounded-full pe-4 text-base font-medium text-neutral-700 transition hover:text-neutral-900"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        <LanguageToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 pb-10 pt-6 animate-fade-up">
        <div className="mb-8 flex flex-col items-start gap-4">
          <AppLogo />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl text-neutral-900">{title}</h1>
            <p className="text-base text-neutral-600">{subtitle}</p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
