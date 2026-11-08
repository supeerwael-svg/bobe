import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import type { PreviewRow } from './importRows';

interface ImportPreviewStepProps {
  rows: PreviewRow[];
  committing: boolean;
  error: string | null;
  onBack: () => void;
  onCommit: () => void;
}

export function ImportPreviewStep({ rows, committing, error, onBack, onCommit }: ImportPreviewStepProps) {
  const { t } = useTranslation();
  const validCount = rows.filter((row) => row.input !== null).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('students.import.title')} subtitle={t('students.import.previewSubtitle')} onBack={onBack} />

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label={t('students.import.totalRows')} value={rows.length} tone="neutral" />
        <SummaryCard label={t('students.import.validRows')} value={validCount} tone="success" />
        <SummaryCard label={t('students.import.invalidRows')} value={invalidCount} tone="danger" />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-base text-neutral-500 ring-1 ring-neutral-200">
          {t('students.import.noDataRows')}
        </p>
      ) : (
        <ul className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pe-1">
          {rows.map((row) => {
            const valid = row.input !== null;
            return (
              <li
                key={row.rowNumber}
                className={`flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ${valid ? 'ring-neutral-200' : 'ring-danger-200'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-xs text-neutral-500">{t('students.import.rowNumber', { number: row.rowNumber })}</span>
                    <span className="truncate text-base font-semibold text-neutral-900">
                      {row.displayName || t('students.import.unnamedRow')}
                    </span>
                  </div>
                  {valid ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {t('students.import.ready')}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-50 px-3 py-1 text-xs font-medium text-danger-700">
                      <AlertTriangle className="size-4" aria-hidden />
                      {t('students.import.skipped')}
                    </span>
                  )}
                </div>
                {row.issues.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm text-danger-700">
                    {row.issues.map((issue, index) => (
                      <li key={`${issue.key}-${index}`}>
                        {issue.field
                          ? t('students.import.fieldIssue', { field: t(`students.fields.${issue.field}`), issue: t(issue.key) })
                          : t(issue.key)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <FormError message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onBack} disabled={committing}>
          {t('common.back')}
        </Button>
        <Button onClick={onCommit} disabled={validCount === 0 || committing}>
          {committing ? t('students.import.importing') : t('students.import.commit', { count: validCount })}
        </Button>
      </div>
      {invalidCount > 0 ? <p className="text-sm text-neutral-500">{t('students.import.skipNote')}</p> : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'success' | 'danger' }) {
  const toneClass = {
    neutral: 'text-neutral-900',
    success: 'text-success-700',
    danger: 'text-danger-700',
  }[tone];
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className={`text-2xl font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}
