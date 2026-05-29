import { io } from 'socket.io-client';
import { getToken } from './client';

// Single socket.io connection shared across the app. Created lazily on the
// first connect() call so we don't open a socket on the auth page; closed
// on logout via disconnect(). Reconnects are handled by socket.io-client
// itself with sensible defaults.

let socket = null;

export function connect() {
  if (socket?.connected) return socket;
  if (socket) { socket.connect(); return socket; }
  socket = io({
    auth: { token: getToken() },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
  });
  return socket;
}

export function disconnect() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() { return socket; }
