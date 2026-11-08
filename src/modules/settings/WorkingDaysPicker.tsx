import { useTranslation } from 'react-i18next';
import { weekdayName, WEEK_DAY_INDEXES } from '@/utils/calendar';

interface WorkingDaysPickerProps {
  value: number[];
  error?: string;
  legend?: string;
  hint?: string;
  onChange: (days: number[]) => void;
}

export function WorkingDaysPicker({ value, error, legend, hint, onChange }: WorkingDaysPickerProps) {
  const { t, i18n } = useTranslation();

  const toggle = (day: number) => {
    const next = value.includes(day) ? value.filter((item) => item !== day) : [...value, day];
    onChange(next.sort((a, b) => a - b));
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-neutral-700">{legend ?? t('institution.workingDays')}</legend>
      <p className="text-sm text-neutral-500">{hint ?? t('institution.workingDaysHint')}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEK_DAY_INDEXES.map((day) => {
          const active = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(day)}
              className={`min-h-12 rounded-xl text-sm font-medium transition duration-150 active:scale-95 ${
                active
                  ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/20'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {weekdayName(day, i18n.language)}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
