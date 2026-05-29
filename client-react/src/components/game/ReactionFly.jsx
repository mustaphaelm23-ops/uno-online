import { motion } from 'framer-motion';

// Single emoji that floats up + fades from the player's panel. Multiple
// reactions in flight (e.g. someone spam-tapping) just stack since each
// has its own random horizontal drift via the `seed` prop.

export default function ReactionFly({ emoji, seed = 0 }) {
  // Small horizontal jitter so multiple reactions don't overlap perfectly.
  // Deterministic from `seed` to avoid SSR/re-render mismatch on hot reload.
  const jitter = (((seed * 9301 + 49297) % 233280) / 233280 - 0.5) * 30;
  return (
    <motion.div
      initial={{ opacity: 0,  x: jitter, y: 0,    scale: 0.6 }}
      animate={{ opacity: 1,  x: jitter, y: -60,  scale: 1.3 }}
      exit={{   opacity: 0,  x: jitter, y: -90,  scale: 1.5 }}
      transition={{ duration: 1.6, ease: 'easeOut' }}
      className="absolute left-1/2 -translate-x-1/2 -top-2 z-30 text-3xl pointer-events-none
                 drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]"
    >
      {emoji}
    </motion.div>
  );
}
