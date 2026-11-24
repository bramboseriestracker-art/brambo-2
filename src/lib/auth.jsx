import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const login = useCallback(async (identifier, password) => { const d = await api('/auth/login', { method: 'POST', body: { identifier, password } }); setUser(d.user); return d.user; }, []);
  const signup = useCallback(async (body) => { const d = await api('/auth/signup', { method: 'POST', body }); setUser(d.user); return d.user; }, []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }, []);

  const value = useMemo(() => ({ user, ready, login, signup, logout, setUser }), [user, ready, login, signup, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
