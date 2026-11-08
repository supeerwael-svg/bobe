import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormError } from '@/components/ui/StatusBlock';
import { importCanteenEntries, listAllCanteenEntries } from '@/db/canteen';
import { useSession } from '@/modules/auth/AuthContext';
import { buildCanteenExport, parseCanteenExport } from '@/utils/canteenMerge';
import { downloadBlob } from '@/utils/download';
import { errorKey } from '@/utils/errors';
import { todayIso } from '@/utils/dates';

export function CanteenDataFile() {
  const { t } = useTranslation();
  const { user, institution } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setError(null);
    try {
      const entries = await listAllCanteenEntries(institution.id);
      const file = buildCanteenExport(institution.id, entries, new Date().toISOString());
      await downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), `canteen-${todayIso()}.json`);
    } catch (exportError) {
      setError(t(errorKey(exportError)));
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    let incoming;
    try {
      incoming = parseCanteenExport(await file.text(), institution.id);
    } catch {
      setError(t('canteenReport.json.invalid'));
      return;
    }
    try {
      const count = await importCanteenEntries(institution.id, incoming, user.id);
      setMessage(t('canteenReport.json.imported', { count }));
    } catch (importError) {
      setError(t(errorKey(importError)));
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{t('canteenReport.json.title')}</h2>
      <p className="text-sm text-neutral-600">{t('canteenReport.json.hint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleExport}
          className="min-h-11 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-800 transition duration-200 hover:bg-neutral-200"
        >
          {t('canteenReport.json.export')}
        </button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-primary-600 px-4 text-sm font-medium text-white transition duration-200 hover:bg-primary-700">
          {t('canteenReport.json.import')}
          <input type="file" accept="application/json,.json" onChange={handleImport} className="sr-only" />
        </label>
      </div>
      {message ? (
        <p role="status" className="text-sm text-success-700">
          {message}
        </p>
      ) : null}
      <FormError message={error} />
    </section>
  );
}
