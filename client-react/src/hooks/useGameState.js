import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket';

// useGameState — subscribes to the per-player game:state stream + tracks
// game:over data. Returns:
//   state    : the latest game:state object (or null) — includes myHand,
//              myPlayable, players, currentTurn, topCard, etc.
//   over     : the game:over payload when match ends (null while playing)
//   reset()  : clears the over payload so the room can re-enter lobby state
//
// We accumulate transient events (drew_card, turn:changed) as well so the
// UI can show toasts / animations without each component subscribing
// separately.

export default function useGameState() {
  const [state, setState] = useState(null);
  const [over, setOver]   = useState(null);
  const lastDrewRef = useRef(null);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;

    const onState   = (s)    => setState(s);
    const onUpdate  = (s)    => setState(s);
    const onSpec    = (s)    => setState(s);
    const onOver    = (data) => setOver(data);
    const onDrew    = (d)    => { lastDrewRef.current = d; };

    sk.on('game:state',           onState);
    sk.on('game:state_update',    onUpdate);
    sk.on('game:spectator_state', onSpec);
    sk.on('game:over',            onOver);
    sk.on('game:drew_card',       onDrew);

    return () => {
      sk.off('game:state',           onState);
      sk.off('game:state_update',    onUpdate);
      sk.off('game:spectator_state', onSpec);
      sk.off('game:over',            onOver);
      sk.off('game:drew_card',       onDrew);
    };
  }, []);

  return {
    state,
    over,
    reset: () => { setOver(null); setState(null); },
    lastDrewRef,
  };
}
