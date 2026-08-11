import { createContext, useContext } from 'react';
import useDMs from '../hooks/useDMs';

// DMsContext — one shared inbox state across the lobby. Without this,
// the TopBar (which wants the unread badge) and the FriendsPanel (which
// owns the thread list + open conversation) would each spin up their own
// useDMs() instance, double-subscribe to dm:incoming, and could disagree
// about the unread count for a frame after a new message arrives.
//
// The provider is mounted once at the LobbyPage level; consumers read
// `{ threads, unread, openWith, thread, openThread, closeThread, send }`
// via useDMsCtx() and stay in sync.

const DMsCtx = createContext(null);

export function DMsProvider({ children }) {
  const dms = useDMs();
  return <DMsCtx.Provider value={dms}>{children}</DMsCtx.Provider>;
}

export function useDMsCtx() {
  const ctx = useContext(DMsCtx);
  if (!ctx) throw new Error('useDMsCtx must be used inside <DMsProvider>');
  return ctx;
}
