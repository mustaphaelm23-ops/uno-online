import { api } from './client';
import { getSocket } from './socket';

// Friends HTTP + DM socket wrappers. Friends ops are pure HTTP (idempotent
// CRUD over the user's friend graph). DMs are pure socket since they need
// live broadcast on send/receive.

export const friendsApi = {
  list:           ()                  => api.get('/api/friends'),
  request:        (username)          => api.post('/api/friends/request', { username }),
  accept:         (userId)            => api.post('/api/friends/accept',  { userId }),
  decline:        (userId)            => api.post('/api/friends/decline', { userId }),
  remove:         (userId)            => api.post('/api/friends/remove',  { userId }),
  invite:         (friendId, roomId)  => api.post('/api/friends/invite',  { friendId, roomId }),
  requests:       ()                  => api.get('/api/friends/requests').catch(() => ({ requests: [] })),
};

// Promise-emit wrappers around the DM socket protocol.
function emit(event, payload = {}) {
  const sk = getSocket();
  if (!sk) return Promise.reject(new Error('Not connected'));
  return new Promise((resolve) => {
    sk.emit(event, payload, (res) => resolve(res || { success: true }));
  });
}

export const dmApi = {
  send:    (toUserId, text)  => emit('dm:send',    { toUserId, text }),
  thread:  (withUserId)      => emit('dm:thread',  { withUserId }),
  threads: ()                => emit('dm:threads', {}),
  read:    (withUserId)      => emit('dm:read',    { withUserId }),
};
