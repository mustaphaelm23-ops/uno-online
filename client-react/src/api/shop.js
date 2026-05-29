import { api } from './client';

// Tiny wrappers for the backend's shop + offer endpoints. Each just
// forwards to api/client; centralizing the URLs here so the lobby
// components don't have to know the routes.
//
// Backend currently runs in demo mode (no real payments) — the response
// shapes already include `simulated: true` and a `demo_mode: true` flag
// for the catalog. When real-provider integration lands, neither shape
// nor caller code needs to change.

export const shopApi = {
  packages:        ()             => api.get('/api/shop/packages'),
  purchase:        (packageId)    => api.post('/api/shop/purchase', { packageId }),
  convertDiamonds: (amount)       => api.post('/api/shop/convert-diamonds', { amount }),
  currentOffer:    ()             => api.get('/api/offers/current'),
  claimOffer:      (offerId)      => api.post(`/api/offers/claim/${offerId}`),
};
