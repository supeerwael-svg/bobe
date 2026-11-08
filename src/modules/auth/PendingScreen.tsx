import { useState } from 'react';
import { Clock, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/AppLogo';
import { Button } from '@/components/ui/Button';
import { useAuth } from './AuthContext';

export function PendingScreen() {
  const { t } = useTranslation();
  const { session, refresh, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const rejected = session?.user.status === 'rejected';

  const handleCheckAgain = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center animate-fade-up">
        <AppLogo size="lg" />
        <div className={`flex size-16 items-center justify-center rounded-full ${rejected ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700'}`}>
          {rejected ? <XCircle className="size-8" aria-hidden /> : <Clock className="size-8" aria-hidden />}
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl text-neutral-900">{rejected ? t('auth.rejectedTitle') : t('auth.pendingTitle')}</h1>
          <p className="text-base text-neutral-600">{rejected ? t('auth.rejectedBody') : t('auth.pendingBody')}</p>
        </div>
        <div className="flex w-full flex-col gap-3 pt-2">
          {rejected ? null : (
            <Button fullWidth onClick={handleCheckAgain} disabled={checking} icon={<RefreshCw className="size-5" aria-hidden />}>
              {t('auth.checkAgain')}
            </Button>
          )}
          <Button variant="ghost" fullWidth onClick={signOut} icon={<LogOut className="size-5 rtl:-scale-x-100" aria-hidden />}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}
