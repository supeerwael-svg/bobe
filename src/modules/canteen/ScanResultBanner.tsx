import type { ScanTone } from './scanFeedback';

export interface ScanBannerState {
  tone: ScanTone;
  title: string;
  detail: string | null;
}

const TONE_CLASSES: Record<ScanTone, string> = {
  success: 'bg-success-600 text-white',
  warning: 'bg-warning-500 text-neutral-950',
  error: 'bg-danger-700 text-white',
};

export function ScanResultBanner({ banner }: { banner: ScanBannerState }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className={`flex flex-col items-center gap-2 rounded-3xl px-6 py-8 text-center shadow-lg animate-fade-up ${TONE_CLASSES[banner.tone]}`}
    >
      <p className="text-3xl font-extrabold leading-tight">{banner.title}</p>
      {banner.detail ? <p className="text-lg font-medium opacity-95">{banner.detail}</p> : null}
    </div>
  );
}
