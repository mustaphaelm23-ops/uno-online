import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../api/socket';

// World Chat — last N messages broadcast across all logged-in users.
// Listens for 'chat:world' (incoming) and emits 'chat:world' on send.
// On mount, requests recent history via ack so newcomers get context.
// Defensive: handlers no-op if the socket isn't ready yet.

export default function WorldChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;

    const onIncoming = (m) => {
      setMessages((cur) => [...cur.slice(-199), m]);
    };
    sk.on('chat:world', onIncoming);

    // Backend exposes recent world chat via ack on a dedicated event in
    // some builds and on connect-emit in others. Try both gently — if
    // neither pattern is wired, we just stay empty until the first
    // incoming message arrives.
    sk.emit('chat:world_history', {}, (res) => {
      if (res?.messages) setMessages(res.messages.slice(-50));
    });

    return () => { sk.off('chat:world', onIncoming); };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    const sk = getSocket();
    if (!sk) return;
    sk.emit('chat:world', { text: clean.slice(0, 200) });
    setText('');
  };

  return (
    <section className="panel-card p-4">
      <header className="flex items-center gap-2 mb-3">
        <span>🌐</span>
        <h3 className="font-display text-lg tracking-wider">WORLD CHAT</h3>
      </header>
      <div ref={bodyRef} className="h-44 overflow-y-auto pr-1 space-y-2 mb-3">
        {messages.length === 0 ? (
          <div className="text-ink-faint text-xs italic text-center py-8">Say hi to the world…</div>
        ) : messages.map((m, i) => (
          <div key={m.id || i} className="text-xs leading-snug">
            <span className="font-bold text-accent">{m.name || m.username}:</span>{' '}
            <span className="text-ink">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          className="input py-2 text-sm"
          maxLength={200}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-violet py-2 px-3 text-sm">Send</button>
      </form>
    </section>
  );
}
