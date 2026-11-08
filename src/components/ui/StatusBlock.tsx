import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-500">
      <Loader2 className="size-8 animate-spin text-primary-600" />
      <p className="text-base">{label ?? t('states.loadingData')}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body: string;
}

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center animate-fade-up">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">{icon}</div>
      <h3 className="text-lg text-neutral-900">{title}</h3>
      <p className="max-w-sm text-base text-neutral-600">{body}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl bg-danger-50 px-6 py-10 text-center">
      <AlertCircle className="size-8 text-danger-700" />
      <p className="text-base text-danger-700">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-50 p-4 text-base text-danger-700 animate-fade-in">
      <AlertCircle className="mt-0.5 size-5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
