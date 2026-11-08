import { useState, type ReactNode } from 'react';
import { CheckCircle2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { FormError, LoadingState } from '@/components/ui/StatusBlock';
import { loadStudentWorkspace, importStudents } from '@/db/students';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { exportHeaderTemplate, readFirstSheet } from '@/utils/spreadsheet';
import { todayIso } from '@/utils/dates';
import { useAsyncData } from '@/utils/useAsyncData';
import { ImportMappingStep } from './ImportMappingStep';
import { ImportPreviewStep } from './ImportPreviewStep';
import { buildPreviewRows, detectMapping, IMPORT_FIELDS, type ColumnMapping, type PreviewRow } from './importRows';

interface StudentImportScreenProps {
  onBack: () => void;
}

interface ImportFile {
  headers: string[];
  rows: unknown[][];
}

type ImportStep = 'pick' | 'map' | 'preview' | 'done';

export function StudentImportScreen({ onBack }: StudentImportScreenProps) {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadStudentWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [step, setStep] = useState<ImportStep>('pick');
  const [file, setFile] = useState<ImportFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const handleTemplate = () => {
    exportHeaderTemplate(
      IMPORT_FIELDS.map((field) => t(`students.fields.${field}`)),
      t('students.title'),
      'students-template.xlsx',
    );
  };

  const handleFile = async (selected: File) => {
    setReading(true);
    setError(null);
    try {
      const sheet = await readFirstSheet(selected);
      if (sheet.length < 2) {
        setError(t('students.import.noRows'));
        return;
      }
      const headers = (sheet[0] as unknown[]).map((cell) => String(cell ?? '').trim());
      setFile({ headers, rows: sheet.slice(1) });
      setMapping(detectMapping(headers));
      setStep('map');
    } catch {
      setError(t('students.import.readFailed'));
    } finally {
      setReading(false);
    }
  };

  const handleBuildPreview = () => {
    if (!file || !workspace.data) return;
    setPreview(
      buildPreviewRows({
        rows: file.rows,
        mapping,
        classes: workspace.data.classes,
        existing: workspace.data.students,
        today: todayIso(),
      }),
    );
    setStep('preview');
  };

  const handleCommit = async () => {
    const inputs = preview.flatMap((row) => (row.input ? [row.input] : []));
    setCommitting(true);
    setError(null);
    try {
      const count = await importStudents(institution.id, inputs, user.id);
      setImportedCount(count);
      setStep('done');
    } catch (commitError) {
      setError(t(errorKey(commitError)));
    } finally {
      setCommitting(false);
    }
  };

  if (workspace.loading && !workspace.data) {
    return (
      <div className="flex flex-col gap-6">
        <SubpageHeader title={t('students.import.title')} onBack={onBack} />
        <LoadingState />
      </div>
    );
  }

  const classes = workspace.data?.classes ?? [];

  if (step === 'map' && file) {
    return (
      <ImportMappingStep
        headers={file.headers}
        mapping={mapping}
        onChange={setMapping}
        onBack={() => setStep('pick')}
        onNext={handleBuildPreview}
      />
    );
  }

  if (step === 'preview') {
    return (
      <ImportPreviewStep
        rows={preview}
        committing={committing}
        error={error}
        onBack={() => setStep('map')}
        onCommit={handleCommit}
      />
    );
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-6">
        <SubpageHeader title={t('students.import.title')} onBack={onBack} />
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-success-50 px-6 py-10 text-center animate-fade-up">
          <CheckCircle2 className="size-12 text-success-700" aria-hidden />
          <h2 className="text-xl font-bold text-neutral-900">{t('students.import.doneTitle', { count: importedCount })}</h2>
          <p className="text-base text-neutral-600">{t('students.import.doneBody')}</p>
        </section>
        <Button fullWidth onClick={onBack}>
          {t('students.import.backToStudents')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader title={t('students.import.title')} subtitle={t('students.import.subtitle')} onBack={onBack} />

      {classes.length === 0 ? (
        <p className="rounded-xl bg-warning-50 px-4 py-4 text-sm text-warning-700">{t('students.import.needClasses')}</p>
      ) : null}

      <ImportStepCard number={1} title={t('students.import.templateTitle')} body={t('students.import.templateBody')}>
        <Button variant="secondary" fullWidth onClick={handleTemplate} icon={<Download className="size-5" aria-hidden />}>
          {t('students.import.downloadTemplate')}
        </Button>
      </ImportStepCard>

      <ImportStepCard number={2} title={t('students.import.chooseTitle')} body={t('students.import.chooseBody')}>
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 px-4 text-base font-medium text-primary-800 transition hover:bg-primary-50">
          <Upload className="size-5" aria-hidden />
          {reading ? t('students.import.reading') : t('students.import.chooseFile')}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={reading || classes.length === 0}
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void handleFile(selected);
              event.target.value = '';
            }}
          />
        </label>
      </ImportStepCard>

      <FormError message={error ?? (workspace.error ? t(errorKey(workspace.error)) : null)} />
    </div>
  );
}

function ImportStepCard({ number, title, body, children }: { number: number; title: string; body: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{number}</span>
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          <p className="text-sm text-neutral-600">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
