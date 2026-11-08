import { useState, type ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { exportBackup, parseBackup, replaceAllData, type BackupData } from '@/db/backup';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/StatusBlock';
import { Modal } from '@/components/ui/Modal';
import { useSession } from '@/modules/auth/AuthContext';
import { downloadBlob } from '@/utils/download';
import { errorKey } from '@/utils/errors';

export function BackupCard() {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleExport = async () => {
    setError(null);
    try {
      const json = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      await downloadBlob(new Blob([json], { type: 'application/json' }), `school-admin-backup-${date}.json`);
    } catch (exportError) {
      setError(t(errorKey(exportError)));
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const parsed = parseBackup(await file.text());
      if (parsed) setPendingRestore(parsed);
      else setError(t('institution.restoreInvalid'));
    } catch (readError) {
      setError(t(errorKey(readError)));
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    setError(null);
    try {
      await replaceAllData(pendingRestore);
      setPendingRestore(null);
      await refresh();
    } catch (restoreError) {
      setError(t(errorKey(restoreError)));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" fullWidth onClick={handleExport} icon={<Download className="size-5" aria-hidden />}>
        {t('institution.exportBackup')}
      </Button>
      <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 text-base font-medium text-neutral-800 ring-1 ring-inset ring-neutral-300 transition hover:bg-neutral-50 active:scale-[0.98]">
        <Upload className="size-5" aria-hidden />
        {t('institution.restoreBackup')}
        <input type="file" accept="application/json,.json" className="sr-only" onChange={handleFileChange} />
      </label>
      <FormError message={error} />

      <Modal
        open={pendingRestore !== null}
        title={t('institution.restoreTitle')}
        description={t('institution.restoreBody')}
        onClose={() => setPendingRestore(null)}
      >
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant="danger" fullWidth onClick={handleRestore} disabled={restoring}>
            {t('common.confirm')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setPendingRestore(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
