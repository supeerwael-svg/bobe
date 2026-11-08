import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ open, title, body, confirmLabel, busy = false, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={title} description={body} onClose={onCancel}>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
