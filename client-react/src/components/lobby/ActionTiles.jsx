import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (blue). Each is a single, prominent button — heavy hover glow,
// arrow icon, two-line label.

function Tile({ onClick, accent, icon, title, subtitle }) {
  const palette = {
    violet: 'from-violet/30 to-violet/5  border-violet/40  hover:border-violet/80 shadow-glow',
    sky:    'from-sky/30    to-sky/5     border-sky/40     hover:border-sky/80    shadow-[0_8px_24px_rgba(14,165,233,0.30)]',
  }[accent] || '';
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-4 p-5 rounded-2xl border
                  bg-gradient-to-br ${palette} transition-all w-full text-left`}
    >
      <div className="text-5xl drop-shadow-[0_4px_12px_rgba(255,255,255,0.25)]">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-xl tracking-wider text-ink">{title}</div>
        <div className="text-xs text-ink-soft mt-1">{subtitle}</div>
      </div>
      <div className={`w-9 h-9 grid place-items-center rounded-full
                       ${accent === 'violet' ? 'bg-violet' : 'bg-sky'} text-white text-lg`}>→</div>
    </motion.button>
  );
}

export default function ActionTiles({ onCreate, onQuickMatch }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Tile
        onClick={onCreate}
        accent="violet"
        icon="🎴"
        title="CREATE ROOM"
        subtitle="Create your own room and invite friends"
      />
      <Tile
        onClick={onQuickMatch}
        accent="sky"
        icon="⚡"
        title="QUICK MATCH"
        subtitle="Play with random players"
      />
    </div>
  );
}
