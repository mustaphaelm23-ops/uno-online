import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

// useOwnedEmotes — returns the user's catalog of extra unlocked emotes
// so the in-game ReactionsPanel can append them to the always-free
// basic set. Module-cached so each session does one /api/emotes fetch.
// Returns [{id, emoji, name, rarity}] — only the rendering-relevant
// fields. The full catalog lives in the EmotesModal.

let _cached = null;

export default function useOwnedEmotes() {
  const { user } = useAuth();
  const [owned, setOwned] = useState(_cached || []);

  useEffect(() => {
    if (!user) { setOwned([]); return; }
    let alive = true;
    api.get('/api/emotes')
      .then((data) => {
        if (!alive) return;
        const mine = (data.items || [])
          .filter((i) => i.owned)
          .map((i) => ({ id: i.id, emoji: i.emoji, name: i.name, rarity: i.rarity }));
        _cached = mine;
        setOwned(mine);
      })
      .catch(() => { /* keep cached */ });
    return () => { alive = false; };
  }, [user?.id]);

  // Expose a refresh that callers (EmotesModal) can fire after an unlock.
  const refresh = async () => {
    try {
      const data = await api.get('/api/emotes');
      const mine = (data.items || [])
        .filter((i) => i.owned)
        .map((i) => ({ id: i.id, emoji: i.emoji, name: i.name, rarity: i.rarity }));
      _cached = mine;
      setOwned(mine);
    } catch { /* ignore */ }
  };

  return { owned, refresh };
}
