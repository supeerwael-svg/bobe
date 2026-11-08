import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { Holiday } from '@/db/types';
import { isIsoDate, requiredKey } from '@/utils/validation';

interface HolidaysEditorProps {
  holidays: Holiday[];
  onChange: (holidays: Holiday[]) => void;
}

interface Draft {
  date: string;
  name: string;
}

interface DraftErrors {
  date?: string;
  name?: string;
}

export function HolidaysEditor({ holidays, onChange }: HolidaysEditorProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<Draft>({ date: '', name: '' });
  const [errors, setErrors] = useState<DraftErrors>({});

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' });

  const addHoliday = () => {
    const next: DraftErrors = {};
    const dateError = requiredKey(draft.date);
    const nameError = requiredKey(draft.name);
    if (dateError) next.date = t(dateError);
    else if (!isIsoDate(draft.date)) next.date = t('validation.invalidDate');
    else if (holidays.some((holiday) => holiday.date === draft.date)) next.date = t('validation.holidayDuplicate');
    if (nameError) next.name = t(nameError);

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onChange([...holidays, { date: draft.date, name: draft.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
    setDraft({ date: '', name: '' });
  };

  const removeHoliday = (date: string) => {
    onChange(holidays.filter((holiday) => holiday.date !== date));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-neutral-800">{t('institution.holidays')}</h3>
        <p className="text-sm text-neutral-500">{t('institution.holidaysHint')}</p>
      </div>

      {holidays.length === 0 ? (
        <p className="rounded-xl bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-500">{t('institution.noHolidays')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.date}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-neutral-50 ps-4 pe-2 animate-fade-in"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-neutral-900">{holiday.name}</span>
                <span className="text-sm text-neutral-500" dir="ltr">
                  {dateFormatter.format(new Date(`${holiday.date}T00:00:00Z`))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeHoliday(holiday.date)}
                aria-label={t('common.remove')}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-danger-50 hover:text-danger-700"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-neutral-300 p-4">
        <TextField
          label={t('institution.holidayDate')}
          type="date"
          value={draft.date}
          error={errors.date}
          onChange={(event) => setDraft((previous) => ({ ...previous, date: event.target.value }))}
        />
        <TextField
          label={t('institution.holidayName')}
          placeholder={t('institution.holidayNamePlaceholder')}
          value={draft.name}
          error={errors.name}
          onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
        />
        <Button variant="secondary" fullWidth onClick={addHoliday} icon={<Plus className="size-5" aria-hidden />}>
          {t('institution.addHoliday')}
        </Button>
      </div>
    </div>
  );
}
