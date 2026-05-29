import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// Slide-out chat panel for the in-room conversation. Auto-scrolls to
// bottom on new messages. Composer is rate-limited softly client-side
// (1 s) so accidental double-Enter doesn't hammer the server.

function fmtTime(ts) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function ChatPanel({ open, onClose, messages = [], myId, onSend, title = '💬 Room Chat' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  const submit = async (e) => {
    e.preventDefault();
    const clean = text.trim().slice(0, 200);
    if (!clean || busy) return;
    setBusy(true);
    setText('');
    try { await onSend?.(clean); }
    finally { setTimeout(() => setBusy(false), 700); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed top-0 right-0 bottom-0 z-40 w-[min(340px,100vw)] panel-card rounded-none border-0
                     border-l border-line flex flex-col"
        >
          <header className="flex items-center justify-between p-3 border-b border-line">
            <h3 className="font-display text-lg tracking-wider">{title}</h3>
            <button type="button" onClick={onClose}
                    aria-label="Close chat"
                    className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose">✕</button>
          </header>
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-ink-faint text-xs italic text-center py-8">No messages yet</div>
            ) : messages.map((m, i) => {
              const mine = m.userId === myId;
              return (
                <div key={m.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm
                    ${mine ? 'bg-violet text-white rounded-br-sm'
                           : 'bg-bg-3/70 text-ink rounded-bl-sm border border-line'}`}>
                    {!mine && <div className="text-[10px] font-bold text-accent mb-0.5">{m.username}</div>}
                    <div className="leading-snug">{m.text}</div>
                    <div className="text-[9px] opacity-60 mt-1 text-right">{fmtTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={submit} className="flex gap-2 p-3 border-t border-line">
            <input
              className="input py-2 text-sm"
              maxLength={200}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              aria-label="Send"
              className="btn-violet py-2 px-3 text-[11px] tracking-wider disabled:opacity-50"
            >SEND</button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
