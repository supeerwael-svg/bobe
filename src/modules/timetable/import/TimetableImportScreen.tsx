import { useState } from 'react';
import { CheckCircle2, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SubpageHeader } from '@/components/SubpageHeader';
import { Button } from '@/components/ui/Button';
import { FormError, LoadingState } from '@/components/ui/StatusBlock';
import { importTimetableSlots, loadTimetableWorkspace } from '@/db/timetable';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { exportHeaderTemplate, readFirstSheet } from '@/utils/spreadsheet';
import { useAsyncData } from '@/utils/useAsyncData';
import { TimetablePreviewStep } from './TimetablePreviewStep';
import { weekdayName } from '@/utils/calendar';
import {
  buildTimetableRows,
  detectTimetableMapping,
  TIMETABLE_FIELDS,
  type TimetableField,
  type TimetablePreviewRow,
} from './timetableRows';

const REQUIRED_FIELDS: TimetableField[] = ['day', 'period', 'subject'];

interface TimetableImportScreenProps {
  classId: string;
  className: string;
  onBack: () => void;
}

type ImportStep = 'pick' | 'preview' | 'done';

export function TimetableImportScreen({ classId, className, onBack }: TimetableImportScreenProps) {
  const { t, i18n } = useTranslation();
  const { user, institution } = useSession();
  const workspace = useAsyncData(() => loadTimetableWorkspace(institution.id, user.id), [institution.id, user.id]);
  const [step, setStep] = useState<ImportStep>('pick');
  const [preview, setPreview] = useState<TimetablePreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplate = () => {
    exportHeaderTemplate(
      TIMETABLE_FIELDS.map((field) => t(`timetable.fields.${field}`)),
      t('timetable.title'),
      'timetable-template.xlsx',
    );
  };

  const handleFile = async (selected: File) => {
    setReading(true);
    setError(null);
    let sheet: unknown[][];
    try {
      sheet = await readFirstSheet(selected);
    } catch {
      setError(t('timetable.import.readFailed'));
      return;
    } finally {
      setReading(false);
    }
    if (sheet.length < 2) {
      setError(t('timetable.import.noRows'));
      return;
    }
    const headers = (sheet[0] as unknown[]).map((cell) => String(cell ?? '').trim());
    const mapping = detectTimetableMapping(headers);
    const missing = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);
    if (missing.length > 0) {
      setError(t('timetable.import.missingColumns', { columns: missing.map((field) => t(`timetable.fields.${field}`)).join(', ') }));
      return;
    }
    if (!workspace.data) {
      setError(t('states.loadFailed'));
      return;
    }
    setPreview(
      buildTimetableRows({
        rows: sheet.slice(1),
        mapping,
        workingDays: institution.workingDays,
        teachers: workspace.data.teachers,
        rooms: workspace.data.rooms,
        classId,
        dayLabel: (day) => weekdayName(day, i18n.language, 'long'),
      }),
    );
    setStep('preview');
  };

  const handleCommit = async () => {
    const inputs = preview.flatMap((row) => (row.input ? [row.input] : []));
    setCommitting(true);
    setError(null);
    try {
      const count = await importTimetableSlots(institution.id, user.id, classId, inputs);
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
        <SubpageHeader title={t('timetable.import.title')} onBack={onBack} />
        <LoadingState />
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <TimetablePreviewStep
        rows={preview}
        committing={committing}
        error={error}
        onBack={() => setStep('pick')}
        onCommit={handleCommit}
      />
    );
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-6">
        <SubpageHeader title={t('timetable.import.title')} onBack={onBack} />
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-success-50 px-6 py-10 text-center animate-fade-up">
          <CheckCircle2 className="size-12 text-success-700" aria-hidden />
          <h2 className="text-xl font-bold text-neutral-900">{t('timetable.import.doneTitle', { count: importedCount })}</h2>
          <p className="text-base text-neutral-600">{t('timetable.import.doneBody')}</p>
        </section>
        <Button fullWidth onClick={onBack}>
          {t('timetable.import.backToSchedule')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SubpageHeader
        title={t('timetable.import.title')}
        subtitle={t('timetable.import.subtitle', { name: className })}
        onBack={onBack}
      />

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-neutral-900">{t('timetable.import.templateTitle')}</h2>
          <p className="text-sm text-neutral-600">{t('timetable.import.templateBody')}</p>
        </div>
        <Button variant="secondary" fullWidth onClick={handleTemplate} icon={<Download className="size-5" aria-hidden />}>
          {t('timetable.import.downloadTemplate')}
        </Button>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold text-neutral-900">{t('timetable.import.chooseTitle')}</h2>
          <p className="text-sm text-neutral-600">{t('timetable.import.chooseBody')}</p>
        </div>
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 px-4 text-base font-medium text-primary-800 transition hover:bg-primary-50">
          <Upload className="size-5" aria-hidden />
          {reading ? t('timetable.import.reading') : t('timetable.import.chooseFile')}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={reading}
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void handleFile(selected);
              event.target.value = '';
            }}
          />
        </label>
      </section>

      <FormError message={error ?? (workspace.error ? t(errorKey(workspace.error)) : null)} />
    </div>
  );
}
