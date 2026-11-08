import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SubpageHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function SubpageHeader({ title, subtitle, onBack }: SubpageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-11 w-fit items-center gap-1 rounded-full pe-4 text-base font-medium text-primary-700 transition hover:text-primary-800"
      >
        <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        {t('common.back')}
      </button>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl text-neutral-900">{title}</h1>
        {subtitle ? <p className="text-base text-neutral-600">{subtitle}</p> : null}
      </div>
    </div>
  );
}
