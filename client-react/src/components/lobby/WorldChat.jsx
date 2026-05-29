import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../api/socket';

// World Chat — last N messages broadcast across all logged-in users.
// Tightened to match the mockup: list shows ~4 rows with username in
// accent color + message body; composer is a single pill input with
// an inline emoji affordance (no separate Send button — Enter submits).

const QUICK_EMOJIS = ['🔥','❤️','😂','👏','🎉','🤔','😎'];

export default function WorldChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;

    const onIncoming = (m) => {
      setMessages((cur) => [...cur.slice(-199), m]);
    };
    sk.on('chat:world', onIncoming);

    sk.emit('chat:world_history', {}, (res) => {
      if (res?.messages) setMessages(res.messages.slice(-50));
    });

    return () => { sk.off('chat:world', onIncoming); };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e?.preventDefault?.();
    const clean = text.trim();
    if (!clean) return;
    const sk = getSocket();
    if (!sk) return;
    sk.emit('chat:world', { text: clean.slice(0, 200) });
    setText('');
    setPickerOpen(false);
  };

  return (
    <section className="panel-card p-4">
      <header className="flex items-center gap-2 mb-3">
        <span>🌐</span>
        <h3 className="font-display text-base lg:text-lg tracking-wider">WORLD CHAT</h3>
      </header>
      <div
        ref={bodyRef}
        className="h-32 lg:h-36 overflow-y-auto pr-1 space-y-1 mb-3 text-[12px] leading-snug"
      >
        {messages.length === 0 ? (
          <div className="text-ink-faint text-xs italic text-center py-6">Say hi to the world…</div>
        ) : messages.map((m, i) => (
          <div key={m.id || i} className="truncate">
            <span className="font-bold text-accent">{m.name || m.username}:</span>{' '}
            <span className="text-ink">{m.text}</span>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="relative">
        <input
          className="w-full bg-bg/60 border border-line rounded-full pl-4 pr-10 py-2 text-[13px] text-ink
                     placeholder:text-ink-faint focus:outline-none focus:border-violet/60 focus:ring-2
                     focus:ring-violet/20 transition"
          maxLength={200}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Emoji"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full
                     text-base hover:bg-bg-3 transition"
        >😀</button>
        {pickerOpen && (
          <div className="absolute right-0 bottom-full mb-1 panel-card p-2 flex gap-1 z-10">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { setText((t) => t + e); setPickerOpen(false); }}
                className="w-8 h-8 grid place-items-center rounded-lg hover:bg-bg-3 text-lg transition"
              >{e}</button>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
