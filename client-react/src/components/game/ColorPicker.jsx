import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

// Wild color picker — appears when the player taps a Wild or Wild Draw 4.
// 4-quadrant disc, click a slice to commit the chosen color. Esc cancels.

const SLICES = [
  { color: 'red',    bg: '#ef4444' },
  { color: 'yellow', bg: '#facc15' },
  { color: 'green',  bg: '#22c55e' },
  { color: 'blue',   bg: '#3b82f6' },
];

export default function ColorPicker({ open, onPick, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] grid place-items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-md" />
          <motion.div
            className="relative flex flex-col items-center gap-4"
            initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-soft">Pick a color</div>
            <div className="relative w-44 h-44 rounded-full overflow-hidden shadow-card-lg border-4 border-bg-2">
              {SLICES.map((s, i) => {
                const angle = i * 90;
                return (
                  <button
                    key={s.color}
                    type="button"
                    onClick={() => onPick?.(s.color)}
                    aria-label={s.color}
                    className="absolute inset-0 origin-center hover:brightness-125 transition-all"
                    style={{
                      background: s.bg,
                      clipPath: 'polygon(50% 50%, 100% 0, 100% 100%)',
                      transform: `rotate(${angle}deg)`,
                    }}
                  />
                );
              })}
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-bg-2 border border-line shadow-card" />
              </div>
            </div>
            <button type="button" onClick={onCancel} className="btn-ghost text-xs">Cancel</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
