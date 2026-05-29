import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

// useEquippedBack — fetches the player's equipped card-back skin so the
// Card component can render face-down stacks with the right palette
// without each call site doing its own catalog lookup. We only need the
// `visual` field per back; the rest of the catalog stays modal-local.
// Result is null while loading or when the default is equipped (Card
// falls back to its built-in classic palette in that case).

let _cached = null;        // module-level cache; one fetch per session

export default function useEquippedBack() {
  const { user } = useAuth();
  const [back, setBack] = useState(_cached);

  useEffect(() => {
    if (!user) { setBack(null); return; }
    let alive = true;
    api.get('/api/collection')
      .then((data) => {
        if (!alive) return;
        const item = (data.items || []).find((i) => i.equipped);
        if (item && item.id !== 'default') {
          _cached = item;
          setBack(item);
        } else {
          _cached = null;
          setBack(null);
        }
      })
      .catch(() => { /* keep cached value */ });
    return () => { alive = false; };
  }, [user?.id]);

  return back;
}
