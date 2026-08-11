import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import { connect as connectSocket, disconnect as disconnectSocket, getSocket } from '../api/socket';

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

  // Ranked socket events — keep user state in sync without a round-trip.
  // ranked:rating_update fires after every ranked match end with the
  // fresh RP / placement counter. We patch the user inline so the Ranked
  // Hub + sidebar reflect the new numbers immediately. season_rollover
  // wipes a lot at once (rankPoints soft-reset, placement counter reset,
  // bonus payouts) so we do a full refetch for that one.
  useEffect(() => {
    const sk = getSocket();
    if (!sk || !user) return;
    const onRating = (p) => {
      setUser((u) => u ? ({
        ...u,
        rankPoints:           typeof p.newRank === 'number'              ? p.newRank              : u.rankPoints,
        peakRankPoints:       typeof p.peakRank === 'number'             ? p.peakRank             : u.peakRankPoints,
        placementGamesPlayed: typeof p.placementGamesPlayed === 'number' ? p.placementGamesPlayed : u.placementGamesPlayed,
        rankedTier:           p.rankedTier || u.rankedTier,
        rankedWins:   p.placement === 1 ? (u.rankedWins   || 0) + 1 : (u.rankedWins   || 0),
        rankedLosses: p.placement === 1 ? (u.rankedLosses || 0)     : (u.rankedLosses || 0) + 1,
        winStreak:    p.placement === 1 ? (u.winStreak    || 0) + 1 : 0,
      }) : u);
    };
    const onPenalty = (p) => {
      setUser((u) => u ? ({
        ...u,
        rankedBanUntil:       typeof p.bannedUntil === 'number' ? p.bannedUntil  : u.rankedBanUntil,
        rankedAbandonCount:   typeof p.offenseCount === 'number' ? p.offenseCount : u.rankedAbandonCount,
        rankedLastAbandonAt:  Date.now(),
      }) : u);
    };
    const onRollover = async () => {
      try {
        const data = await api.get('/api/auth/me');
        setUser(data.user || data);
      } catch { /* ignored */ }
    };
    sk.on('ranked:rating_update',  onRating);
    sk.on('ranked:penalty',        onPenalty);
    sk.on('ranked:season_rollover', onRollover);
    return () => {
      sk.off('ranked:rating_update',  onRating);
      sk.off('ranked:penalty',        onPenalty);
      sk.off('ranked:season_rollover', onRollover);
    };
  }, [user?.id]);

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
