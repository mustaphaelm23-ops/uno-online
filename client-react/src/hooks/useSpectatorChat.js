import { useEffect, useState } from 'react';
import { getSocket } from '../api/socket';

// useSpectatorChat — owns the spectator channel state for the in-room
// watcher view. Server pushes:
//   chat:spectator_history  → initial 50 on join (one shot)
//   chat:spectator_message  → live broadcast on send
// We cap the local buffer at 100 (mirroring the server-side cap) so
// long-lived spectator sessions don't bloat memory.

const CAP = 100;

export default function useSpectatorChat() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;
    const onHistory  = ({ messages: m }) => setMessages((m || []).slice(-CAP));
    const onIncoming = (msg) => setMessages((cur) => [...cur.slice(-(CAP - 1)), msg]);
    sk.on('chat:spectator_history', onHistory);
    sk.on('chat:spectator_message', onIncoming);
    return () => {
      sk.off('chat:spectator_history', onHistory);
      sk.off('chat:spectator_message', onIncoming);
    };
  }, []);

  const send = (text) => {
    const sk = getSocket();
    if (!sk) return Promise.resolve({ success: false, reason: 'not_connected' });
    return new Promise((resolve) => {
      sk.emit('chat:spectator_send', { text }, (r) => resolve(r || { success: true }));
    });
  };

  return { messages, send };
}
