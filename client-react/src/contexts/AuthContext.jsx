import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import { connect as connectSocket, disconnect as disconnectSocket } from '../api/socket';

// AuthContext owns: the JWT, the cached user object (refreshable), and the
// socket connection lifecycle. Anything below in the tree consumes via
// useAuth(). On boot, if a token exists we try /api/auth/me to validate it;
// on success we open the socket. On 401 we clear the token and bounce to /auth.

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [ready, setReady]   = useState(false);

  const hydrate = useCallback(async () => {
    if (!getToken()) { setReady(true); return; }
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user || data);          // server returns { user } or the user directly
      connectSocket();
    } catch (err) {
      if (err.status === 401) clearToken();
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
    connectSocket();
    return data.user;
  }, []);

  const register = useCallback(async (username, password, email) => {
    const data = await api.post('/api/auth/register', { username, password, email });
    setToken(data.token);
    setUser(data.user);
    connectSocket();
    return data.user;
  }, []);

  const logout = useCallback(() => {
    disconnectSocket();
    clearToken();
    setUser(null);
  }, []);

  // refreshUser pulls fresh stats (coins, BP level, etc.) without a full
  // page reload — used after server actions that mutate currency.
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user || data);
    } catch { /* ignored */ }
  }, []);

  return (
    <AuthCtx.Provider value={{ user, ready, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
