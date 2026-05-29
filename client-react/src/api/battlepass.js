import { api } from './client';

// Battle Pass endpoints. GET returns the full state; POSTs are atomic.
// Each successful claim/unlock/skip echoes the new coin/diamond balance
// so callers can refresh the AuthContext user without a second roundtrip.

export const bpApi = {
  get:             ()              => api.get('/api/battlepass'),
  claim:           (tier, track)   => api.post('/api/battlepass/claim', { tier, track }),
  unlock:          ()              => api.post('/api/battlepass/unlock'),
  unlockDiamonds:  ()              => api.post('/api/battlepass/unlock-diamonds'),
  skip:            ()              => api.post('/api/battlepass/skip'),
};
