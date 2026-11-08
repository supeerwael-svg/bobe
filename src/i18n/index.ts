import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { ar } from './locales/ar';

export type AppLanguage = 'en' | 'ar';

const STORAGE_KEY = 'school-admin.language';

function readInitialLanguage(): AppLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ar') return stored;
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function applyDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

export function setAppLanguage(language: AppLanguage): void {
  localStorage.setItem(STORAGE_KEY, language);
  void i18n.changeLanguage(language);
}

const initialLanguage = readInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(initialLanguage);
i18n.on('languageChanged', applyDocumentLanguage);

export default i18n;
