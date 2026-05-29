import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useNotifications } from '../../contexts/NotificationsContext';

// Slide-out notifications feed. Opens from the 🔔 in TopBar; calling
// markAllRead() on open clears the badge. Each row maps to one of the
// event types accumulated by NotificationsContext.

const TYPE_ICON = {
  friend_request:  '👤',
  friend_accepted: '🤝',
  friend_invite:   '🎟️',
  payout:          '🪙',
  levelup:         '⭐',
  penalty:         '⚠️',
  dm:              '💬',
};

const TYPE_TINT = {
  friend_request:  'border-violet/40',
  friend_accepted: 'border-emerald/40',
  friend_invite:   'border-accent/40',
  payout:          'border-accent/40',
  levelup:         'border-violet/50',
  penalty:         'border-rose/50',
  dm:              'border-sky/40',
};

function fmtAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'just now';
  if (diff < 3_600_000)     return Math.floor(diff / 60_000) + 'm';
  if (diff < 86_400_000)    return Math.floor(diff / 3_600_000) + 'h';
  return Math.floor(diff / 86_400_000) + 'd';
}

export default function NotificationsPanel({ open, onClose }) {
  const { items, markAllRead, clear } = useNotifications();

  // Mark read whenever the panel opens (single side-effect, not on every render).
  useEffect(() => { if (open) markAllRead(); }, [open, markAllRead]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: 360, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed top-0 right-0 bottom-0 z-50 w-[min(340px,100vw)] panel-card rounded-none border-0 border-l border-line flex flex-col"
        >
          <header className="flex items-center justify-between p-3 border-b border-line">
            <h3 className="font-display text-lg tracking-wider">🔔 Notifications</h3>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <button type="button" onClick={clear}
                        className="text-[10px] uppercase tracking-widest text-ink-faint hover:text-ink px-2 py-1">
                  Clear
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close"
                      className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose">✕</button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {items.length === 0 ? (
              <div className="text-ink-faint text-sm py-10 text-center leading-relaxed">
                No notifications yet.<br/>
                <span className="text-xs text-ink-faint">Events will show up here as they happen.</span>
              </div>
            ) : items.map((it) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl bg-bg-3/40 border ${TYPE_TINT[it.type] || 'border-line'} hover:bg-bg-3/60 transition`}
              >
                <div className={`w-9 h-9 grid place-items-center rounded-lg text-base shrink-0
                  ${TYPE_TINT[it.type]?.replace('border-', 'bg-').replace('/40', '/15').replace('/50', '/15') || 'bg-bg-2 border border-line'}`}>
                  {TYPE_ICON[it.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="text-[12px] leading-snug">{it.text}</div>
                  <div className="text-[10px] text-ink-faint mt-1 uppercase tracking-widest">{fmtAgo(it.at)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
