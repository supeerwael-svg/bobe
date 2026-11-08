import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const UNDO_WINDOW_MS = 6000;

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
}

export function UndoToast({ message, onUndo, onExpire }: UndoToastProps) {
  const { t } = useTranslation();
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    const timer = window.setTimeout(() => expireRef.current(), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl bg-neutral-900 px-5 py-4 text-white shadow-xl animate-fade-up"
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={() => {
          onUndo();
          onExpire();
        }}
        className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-primary-300 transition hover:bg-white/10"
      >
        {t('common.undo')}
      </button>
    </div>
  );
}
