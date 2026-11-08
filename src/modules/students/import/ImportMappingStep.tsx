import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS, type ColumnMapping, type ImportField } from './importRows';

interface ImportMappingStepProps {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ImportMappingStep({ headers, mapping, onChange, onBack, onNext }: ImportMappingStepProps) {
  const { t } = useTranslation();
  const missing = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);

  const setColumn = (field: ImportField, value: string) => {
    const next = { ...mapping };
    if (value === '') delete next[field];
    else next[field] = Number(value);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('students.import.title')} subtitle={t('students.import.mapSubtitle')} onBack={onBack} />

      <section className="flex flex-col divide-y divide-neutral-100 rounded-2xl bg-white ring-1 ring-neutral-200">
        {IMPORT_FIELDS.map((field) => {
          const required = REQUIRED_IMPORT_FIELDS.includes(field);
          return (
            <div key={field} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor={`map-${field}`} className="text-base font-medium text-neutral-800">
                {t(`students.fields.${field}`)}
                {required ? <span className="ms-1 text-danger-600">*</span> : null}
              </label>
              <select
                id={`map-${field}`}
                value={mapping[field] ?? ''}
                onChange={(event) => setColumn(field, event.target.value)}
                className="min-h-12 rounded-xl bg-white px-4 text-base text-neutral-900 ring-1 ring-inset ring-neutral-300 focus:outline-none focus:ring-4 focus:ring-primary-500/15 sm:w-64"
              >
                <option value="">{t('students.import.notMapped')}</option>
                {headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={index}>
                    {header || t('students.import.columnNumber', { number: index + 1 })}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </section>

      {missing.length > 0 ? (
        <p className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {t('students.import.missingRequired', { fields: missing.map((field) => t(`students.fields.${field}`)).join(', ') })}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button onClick={onNext} disabled={missing.length > 0} icon={<ArrowRight className="size-5 rtl:rotate-180" aria-hidden />}>
          {t('students.import.preview')}
        </Button>
      </div>
    </div>
  );
}
