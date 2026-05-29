import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (sky). Each tile gets decorative tilted "UNO cards" that read as
// a small visual hero so the row isn't a flat colored panel — matches
// the mockup's playing-card art.

const PALETTES = {
  violet: {
    bg: 'from-violet/30 to-violet/5',
    border: 'border-violet/40 hover:border-violet/80',
    glow: 'shadow-glow',
    arrow: 'bg-violet',
    // Decorative cards behind the icon
    cards: ['from-emerald to-emerald/70', 'from-rose to-rose/70', 'from-violet to-violet-deep'],
  },
  sky: {
    bg: 'from-sky/30 to-sky/5',
    border: 'border-sky/40 hover:border-sky/80',
    glow: 'shadow-[0_8px_24px_rgba(14,165,233,0.30)]',
    arrow: 'bg-sky',
    cards: ['from-rose to-rose/70', 'from-emerald to-emerald/70', 'from-sky to-sky/70'],
  },
};

function CardCluster({ palette, icon }) {
  return (
    <div className="relative w-14 sm:w-16 h-14 sm:h-16 shrink-0 select-none pointer-events-none">
      {/* Three fanned playing-card silhouettes — the mockup uses these
          on both action tiles for the "this is the game" cue. */}
      <div className={`absolute inset-y-0 left-0 w-8 sm:w-10 rounded-md rotate-[-18deg] origin-bottom-right
                       bg-gradient-to-br ${palette.cards[0]} border border-white/20 shadow-card`} />
      <div className={`absolute inset-y-0 right-0 w-8 sm:w-10 rounded-md rotate-[18deg] origin-bottom-left
                       bg-gradient-to-br ${palette.cards[1]} border border-white/20 shadow-card`} />
      <div className={`absolute inset-0 grid place-items-center text-2xl sm:text-3xl rounded-md
                       bg-gradient-to-br ${palette.cards[2]} border border-white/20 shadow-card-lg
                       drop-shadow-[0_2px_8px_rgba(0,0,0,.3)]`}>
        {icon}
      </div>
    </div>
  );
}

function Tile({ onClick, accent, icon, title, subtitle }) {
  const p = PALETTES[accent] || PALETTES.violet;
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border
                  bg-gradient-to-br ${p.bg} ${p.border} ${p.glow} transition-all w-full text-left`}
    >
      <CardCluster palette={p} icon={icon} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-lg sm:text-xl tracking-wider text-ink">{title}</div>
        <div className="text-[11px] sm:text-xs text-ink-soft mt-0.5 sm:mt-1 leading-snug">{subtitle}</div>
      </div>
      <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 grid place-items-center rounded-full
                       ${p.arrow} text-white text-base sm:text-lg shadow-card`}>→</div>
    </motion.button>
  );
}

export default function ActionTiles({ onCreate, onQuickMatch }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
