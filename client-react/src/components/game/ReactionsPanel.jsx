import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import useOwnedEmotes from '../../hooks/useOwnedEmotes';

// Emoji reactions — 12 always-free basic emojis plus any extras the
// user has unlocked from the Emotes collection. Server enforces a 1s
// per-socket throttle; honest clients also gate locally with a 1.5s
// debounce passed down by the parent (SocialBar).

const BASIC = ['🔥','❤️','😂','😱','👏','🤔','💩','🤡','😎','🎉','⚡','💯'];

// Rarity → glow ring on unlocked emote tiles so they stand out from basic.
const RARITY_RING = {
  common:    '',
  rare:      'ring-1 ring-sky/50',
  epic:      'ring-1 ring-violet/60',
  legendary: 'ring-1 ring-accent/60',
};

export default function ReactionsPanel({ open, onPick, onClose }) {
  const { owned } = useOwnedEmotes();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Concatenated grid: basic first, then unlocked extras (de-duped against
  // basic just in case a future basic overlaps an emote). Tiles keep the
  // rarity ring so unlocks feel rewarding visually.
  const tiles = useMemo(() => {
    const basicSet = new Set(BASIC);
    const extras = (owned || []).filter((e) => !basicSet.has(e.emoji));
    return [
      ...BASIC.map((emoji) => ({ emoji, rarity: 'common' })),
      ...extras,
    ];
  }, [owned]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className="absolute bottom-16 right-0 grid grid-cols-6 gap-1.5 p-2.5 panel-card max-w-[260px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {tiles.map((t) => (
            <button
              key={t.id || t.emoji}
              type="button"
              onClick={() => { onPick?.(t.emoji); onClose?.(); }}
              className={`w-9 h-9 rounded-lg grid place-items-center text-xl bg-bg-3/60 border border-line
                          hover:border-violet hover:bg-bg-3 hover:scale-110 transition
                          ${RARITY_RING[t.rarity] || ''}`}
            >{t.emoji}</button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { BASIC as REACTIONS };
