import { useEffect, useState } from 'react';
import { getSocket } from '../api/socket';

// useSpectatorVote — backend already supports prediction-style votes
// for spectators (vote:spectator emit, vote:tally broadcast). This hook
// surfaces the live tally + the local user's vote and exposes castVote.
//
// Tally shape from the server: { [playerId]: count }. `my` is the
// player id this spectator backed (null until they vote).

export default function useSpectatorVote() {
  const [tally, setTally] = useState({});
  const [my, setMy]       = useState(null);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;
    const onTally = ({ tally: t, my: m }) => {
      if (t) setTally(t);
      if (m !== undefined) setMy(m);
    };
    sk.on('vote:tally', onTally);
    return () => sk.off('vote:tally', onTally);
  }, []);

  const castVote = (playerId) => {
    const sk = getSocket();
    if (!sk) return Promise.resolve({ success: false });
    return new Promise((resolve) => {
      sk.emit('vote:spectator', { playerId }, (r) => resolve(r || { success: true }));
    });
  };

  return { tally, my, castVote };
}
