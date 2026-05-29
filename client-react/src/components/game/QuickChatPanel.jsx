import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

// Mirrors the server's QUICK_CHAT_PRESETS table by ID. Server validates
// the ID and looks up text server-side, so a tampered client can't inject
// arbitrary phrases — these labels are purely cosmetic.

const PRESETS = [
  { id: 1,  text: '👋 Hi!' },
  { id: 2,  text: '🎯 Nice play!' },
  { id: 3,  text: '🤣 GG' },
  { id: 4,  text: '😤 So close!' },
  { id: 5,  text: '🙏 Sorry!' },
  { id: 6,  text: '🎉 UNO!' },
  { id: 7,  text: '⚠️ Watch out!' },
  { id: 8,  text: '🔥 Let\'s go!' },
  { id: 9,  text: '😅 Oops' },
  { id: 10, text: '🤝 Good luck!' },
  { id: 11, text: '⏰ Hurry up!' },
  { id: 12, text: '👏 Well played' },
];

export default function QuickChatPanel({ open, onPick, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="absolute bottom-16 right-0 grid grid-cols-3 gap-1.5 p-2.5 panel-card w-[280px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onPick?.(p); onClose?.(); }}
              className="px-2.5 py-2 rounded-lg text-xs font-bold bg-bg-3/60 border border-line
                         hover:border-violet hover:bg-bg-3 transition whitespace-nowrap overflow-hidden text-ellipsis"
            >{p.text}</button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { PRESETS as QUICK_CHAT_PRESETS };
