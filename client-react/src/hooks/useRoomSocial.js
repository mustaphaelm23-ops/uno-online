import { useEffect, useState } from 'react';
import { getSocket } from '../api/socket';

// useRoomSocial — owns the in-room social stream:
//   • messages    : rolling chat (capped at 80, chat:message events)
//   • bubbles     : map of playerId → { id, text, until } for quick-chat
//                   overlays. Each bubble auto-clears after 2.4 s.
//   • reactions   : array of { id, playerId, emoji, ts } animation events;
//                   each entry is removed ~2 s after appearing.
//
// All three stream from socket events; no polling. The hook is mounted
// once at the GameScreen level so we have a single source of truth and
// the bubble/reaction lifetimes don't multiply with re-renders.

const BUBBLE_TTL_MS  = 2400;
const REACTION_TTL_MS = 1800;

export default function useRoomSocial() {
  const [messages, setMessages]   = useState([]);
  const [bubbles, setBubbles]     = useState({});       // playerId → bubble
  const [reactions, setReactions] = useState([]);       // ephemeral list

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;

    const onChat = (msg) => {
      setMessages((cur) => [...cur.slice(-79), msg]);
    };

    const onQuick = ({ playerId, username, id, text }) => {
      const bubble = { id, text, username, until: Date.now() + BUBBLE_TTL_MS };
      setBubbles((cur) => ({ ...cur, [playerId]: bubble }));
      setTimeout(() => {
        setBubbles((cur) => {
          // Only clear if THIS bubble is still the active one (a newer
          // bubble from the same player should win).
          if (cur[playerId]?.id !== id) return cur;
          const { [playerId]: _, ...rest } = cur;
          return rest;
        });
      }, BUBBLE_TTL_MS);
    };

    const onReaction = ({ playerId, emoji }) => {
      const entry = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                      playerId, emoji, ts: Date.now() };
      setReactions((cur) => [...cur, entry]);
      setTimeout(() => {
        setReactions((cur) => cur.filter((r) => r.id !== entry.id));
      }, REACTION_TTL_MS);
    };

    const onThrottled = () => { /* server-side throttle ack; client UX already gates */ };

    sk.on('chat:message',           onChat);
    sk.on('chat:quick',             onQuick);
    sk.on('game:reaction',          onReaction);
    sk.on('game:reaction_throttled',onThrottled);
    sk.on('chat:quick_throttled',   onThrottled);

    return () => {
      sk.off('chat:message',           onChat);
      sk.off('chat:quick',             onQuick);
      sk.off('game:reaction',          onReaction);
      sk.off('game:reaction_throttled',onThrottled);
      sk.off('chat:quick_throttled',   onThrottled);
    };
  }, []);

  // For locally-triggered reactions: mirror them into the local stream
  // immediately so the player sees their own animation without waiting
  // for a server echo (server actually excludes the sender per design).
  const echoReaction = (playerId, emoji) => {
    const entry = { id: `${Date.now()}_local`, playerId, emoji, ts: Date.now() };
    setReactions((cur) => [...cur, entry]);
    setTimeout(() => {
      setReactions((cur) => cur.filter((r) => r.id !== entry.id));
    }, REACTION_TTL_MS);
  };

  // For locally-sent quick-chat: same idea — render our own bubble
  // immediately. Server also excludes the sender? Actually server uses
  // io.to(room) which includes the sender, BUT the client UI feedback
  // wants the bubble to appear on tap (zero round-trip), not after the
  // network bounces. We dedupe on bubble.id so the echo from the server
  // simply refreshes the timer instead of double-rendering.
  const echoBubble = (playerId, text, presetId, username) => {
    const id = presetId || `local_${Date.now()}`;
    const bubble = { id, text, username, until: Date.now() + BUBBLE_TTL_MS };
    setBubbles((cur) => ({ ...cur, [playerId]: bubble }));
    setTimeout(() => {
      setBubbles((cur) => (cur[playerId]?.id === id ? Object.fromEntries(
        Object.entries(cur).filter(([k]) => k !== playerId)
      ) : cur));
    }, BUBBLE_TTL_MS);
  };

  return { messages, bubbles, reactions, echoReaction, echoBubble };
}
