import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '@/i18n';

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language.startsWith('ar');
  return (
    <button
      type="button"
      onClick={() => setAppLanguage(isArabic ? 'en' : 'ar')}
      aria-label={t('language.label')}
      className="min-h-11 rounded-full bg-white px-4 text-sm font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200 transition hover:bg-neutral-100"
    >
      {isArabic ? 'English' : 'العربية'}
    </button>
  );
}
