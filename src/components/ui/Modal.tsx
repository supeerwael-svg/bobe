import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-neutral-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center sm:inset-0 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          className="pointer-events-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl animate-fade-up sm:rounded-3xl"
        >
          <div className="mb-2 flex items-start justify-between gap-4">
            <h2 id="modal-title" className="text-xl font-bold text-neutral-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="-me-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
            >
              <X className="size-5" />
            </button>
          </div>
          {description ? <p className="mb-6 text-base text-neutral-600">{description}</p> : null}
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
