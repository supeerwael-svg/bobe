import { useTranslation } from 'react-i18next';
import type { SchoolClass } from '@/db/types';

interface ClassAssignmentEditorProps {
  classes: SchoolClass[];
  selectedIds: string[];
  onChange: (classIds: string[]) => void;
}

export function ClassAssignmentEditor({ classes, selectedIds, onChange }: ClassAssignmentEditorProps) {
  const { t } = useTranslation();

  const toggle = (classId: string) => {
    onChange(selectedIds.includes(classId) ? selectedIds.filter((id) => id !== classId) : [...selectedIds, classId]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-neutral-800">{t('supervisors.classes')}</h3>
        <p className="text-sm text-neutral-500">{t('supervisors.classesHint')}</p>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-500">{t('supervisors.noClassesAvailable')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {classes.map((schoolClass) => {
            const checked = selectedIds.includes(schoolClass.id);
            return (
              <li key={schoolClass.id}>
                <label
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 ring-1 transition duration-200 ${
                    checked ? 'bg-primary-50 ring-primary-500' : 'bg-white ring-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(schoolClass.id)}
                    className="size-5 accent-primary-600"
                  />
                  <span className="font-medium text-neutral-900">{schoolClass.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
