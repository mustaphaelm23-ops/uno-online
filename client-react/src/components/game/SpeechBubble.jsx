import { motion } from 'framer-motion';

// 2.4 s ephemeral speech bubble, anchored above the player's panel by the
// parent (absolute positioning). The text is short by design — server
// constrains via the preset lookup, so we don't truncate further.

export default function SpeechBubble({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="absolute left-1/2 -translate-x-1/2 -top-9 z-30 px-3 py-1.5 rounded-2xl
                 bg-gradient-to-br from-violet to-violet-deep text-white text-xs font-bold
                 whitespace-nowrap shadow-card-lg border border-violet-soft/50 pointer-events-none"
    >
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45
                       bg-violet border-r border-b border-violet-soft/50" />
    </motion.div>
  );
}
