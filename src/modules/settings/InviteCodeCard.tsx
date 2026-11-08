import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { renewInviteCode } from '@/db/institutions';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { FormError } from '@/components/ui/StatusBlock';
import { Modal } from '@/components/ui/Modal';
import { useSession } from '@/modules/auth/AuthContext';
import { errorKey } from '@/utils/errors';
import { formatInviteCode } from '@/utils/invite';

export function InviteCodeCard() {
  const { t } = useTranslation();
  const { user, institution, refresh } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = formatInviteCode(institution.inviteCode);

  const handleRenew = async () => {
    setRenewing(true);
    setError(null);
    try {
      await renewInviteCode(institution.id, user.id);
      await refresh();
      setConfirmOpen(false);
    } catch (renewError) {
      setError(t(errorKey(renewError)));
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-neutral-50 p-4">
        <span
          className="font-mono text-3xl font-bold tracking-[0.2em] text-neutral-900"
          dir="ltr"
          aria-label={t('institution.inviteSection')}
        >
          {code}
        </span>
        <div className="flex items-center justify-between gap-3">
          <CopyButton value={code} />
        </div>
      </div>
      <FormError message={error} />
      <Button variant="secondary" fullWidth onClick={() => setConfirmOpen(true)} icon={<RefreshCw className="size-5" aria-hidden />}>
        {t('institution.renewCode')}
      </Button>

      <Modal
        open={confirmOpen}
        title={t('institution.renewTitle')}
        description={t('institution.renewBody')}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button fullWidth onClick={handleRenew} disabled={renewing}>
            {t('common.confirm')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setConfirmOpen(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
