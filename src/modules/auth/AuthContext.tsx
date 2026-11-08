import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadSession, type SessionData } from '@/db/auth';
import { clearSessionUserId, readSessionUserId, writeSessionUserId } from '@/utils/session';

interface AuthState {
  session: SessionData | null;
  loading: boolean;
  error: unknown;
}

interface AuthContextValue extends AuthState {
  signIn: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readCurrentSession(): Promise<SessionData | null> {
  const userId = readSessionUserId();
  if (!userId) return null;
  const session = await loadSession(userId);
  if (!session) clearSessionUserId();
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const session = await readCurrentSession();
      setState({ session, loading: false, error: null });
    } catch (error) {
      setState((previous) => ({ ...previous, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (userId: string) => {
      writeSessionUserId(userId);
      await refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    clearSessionUserId();
    setState({ session: null, loading: false, error: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, refresh, signOut }),
    [state, signIn, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function useSession() {
  const { session, refresh, signOut } = useAuth();
  if (!session) throw new Error('useSession requires a signed-in user');
  return { user: session.user, institution: session.institution, refresh, signOut };
}
