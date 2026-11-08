import { useTranslation } from 'react-i18next';
import { MODULE_IDS, type AccessLevel, type ModuleId } from '@/db/types';

interface ModuleAccessEditorProps {
  modules: Record<ModuleId, AccessLevel>;
  onChange: (moduleId: ModuleId, level: AccessLevel) => void;
}

const ACCESS_LEVELS: AccessLevel[] = ['edit', 'view'];

export function ModuleAccessEditor({ modules, onChange }: ModuleAccessEditorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-neutral-800">{t('supervisors.moduleAccess')}</h3>
        <p className="text-sm text-neutral-500">{t('supervisors.moduleAccessHint')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {MODULE_IDS.map((moduleId) => (
          <li key={moduleId} className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="px-1 font-medium text-neutral-900">{t(`supervisors.modules.${moduleId}`)}</span>
            <div role="radiogroup" aria-label={t(`supervisors.modules.${moduleId}`)} className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-200/70 p-1 sm:w-64">
              {ACCESS_LEVELS.map((level) => {
                const active = (modules[moduleId] ?? 'view') === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(moduleId, level)}
                    className={`min-h-11 rounded-lg px-2 text-sm font-medium transition duration-200 ${
                      active ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {t(`supervisors.access.${level}`)}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
