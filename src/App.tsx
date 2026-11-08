import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@/components/ui/StatusBlock';
import { AuthProvider, useAuth } from '@/modules/auth/AuthContext';
import { AuthFlow } from '@/modules/auth/AuthFlow';
import { PendingScreen } from '@/modules/auth/PendingScreen';
import { AppShell } from '@/modules/shell/AppShell';

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { t } = useTranslation();
  const { session, loading, error, refresh } = useAuth();

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <ErrorState message={t('states.loadFailed')} onRetry={() => void refresh()} />
      </div>
    );
  }

  if (!session) return <AuthFlow />;
  if (session.user.status !== 'approved') return <PendingScreen />;
  return <AppShell />;
}
