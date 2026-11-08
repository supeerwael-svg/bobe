import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from '@/i18n';

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

export function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  const current = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-neutral-700">{t('language.label')}</span>
      <div role="radiogroup" aria-label={t('language.label')} className="grid grid-cols-2 gap-1 rounded-2xl bg-neutral-200/70 p-1">
        {OPTIONS.map((option) => {
          const active = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setAppLanguage(option.value)}
              className={`min-h-12 rounded-xl text-base font-medium transition duration-200 ${
                active ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
