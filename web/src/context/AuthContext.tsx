import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../lib/api';
import type { Role } from '../lib/types';

interface AuthValue {
  role: Role | null;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((result) => setRole(result.role))
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (password: string) => {
    const result = await api.login(password);
    setRole(result.role);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setRole(null);
    }
  }, []);

  const value = useMemo<AuthValue>(() => ({ role, loading, login, logout }), [role, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return context;
}

export { ApiError };
