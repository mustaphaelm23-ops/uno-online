import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

// Emoji reactions — 12 commonly-shipped emojis. Server enforces a 1s
// per-socket throttle; honest clients also gate locally with a 1.5s
// debounce passed down by the parent (SocialBar).

const REACTIONS = ['🔥','❤️','😂','😱','👏','🤔','💩','🤡','😎','🎉','⚡','💯'];

export default function ReactionsPanel({ open, onPick, onClose }) {
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
          className="absolute bottom-16 right-0 grid grid-cols-6 gap-1.5 p-2.5 panel-card w-[240px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onPick?.(emoji); onClose?.(); }}
              className="w-9 h-9 rounded-lg grid place-items-center text-xl bg-bg-3/60 border border-line
                         hover:border-violet hover:bg-bg-3 hover:scale-110 transition"
            >{emoji}</button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { REACTIONS };
