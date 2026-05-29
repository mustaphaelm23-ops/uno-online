import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (sky). Each tile is wrapped by scattered, tilted mini UNO cards
// that float around the edges — same hero motif the mockup uses to make
// the row feel premium, not just a flat colored panel.

const PALETTES = {
  violet: {
    bg: 'from-violet/30 to-violet/5',
    border: 'border-violet/40 hover:border-violet/80',
    glow: 'shadow-glow',
    arrow: 'bg-violet',
    iconCard: 'from-violet to-violet-deep',
    floats: [
      // [classes, color gradient]
      { cls: 'w-7 h-10 -left-2 -top-3 rotate-[-22deg]', grad: 'from-emerald to-emerald/60' },
      { cls: 'w-6 h-9  -bottom-3 left-8  rotate-[15deg]', grad: 'from-rose to-rose/60' },
      { cls: 'w-7 h-10 -top-4 left-16    rotate-[8deg]',  grad: 'from-violet to-violet-deep' },
    ],
  },
  sky: {
    bg: 'from-sky/30 to-sky/5',
    border: 'border-sky/40 hover:border-sky/80',
    glow: 'shadow-[0_8px_24px_rgba(14,165,233,0.30)]',
    arrow: 'bg-sky',
    iconCard: 'from-sky to-sky/70',
    floats: [
      { cls: 'w-7 h-10 -left-2 -top-3 rotate-[18deg]',   grad: 'from-rose to-rose/60' },
      { cls: 'w-6 h-9  -bottom-3 left-8 rotate-[-14deg]',grad: 'from-emerald to-emerald/60' },
      { cls: 'w-7 h-10 -top-4 left-16   rotate-[-10deg]',grad: 'from-sky to-sky/70' },
    ],
  },
};

function FloatingCards({ palette }) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {palette.floats.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-md border border-white/20 shadow-card-lg
                      bg-gradient-to-br ${f.grad} ${f.cls}
                      after:absolute after:inset-1 after:rounded after:border after:border-white/15`}
        />
      ))}
    </div>
  );
}

function IconCard({ palette, icon }) {
  return (
    <div className={`relative w-12 sm:w-14 h-12 sm:h-14 shrink-0 rounded-xl grid place-items-center text-2xl sm:text-3xl
                     bg-gradient-to-br ${palette.iconCard} border border-white/30 shadow-card-lg
                     drop-shadow-[0_2px_8px_rgba(0,0,0,.3)]`}>
      {icon}
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
      className={`relative overflow-hidden flex items-center gap-3 sm:gap-4 p-4 sm:p-5 pl-6 sm:pl-8 rounded-2xl border
                  bg-gradient-to-br ${p.bg} ${p.border} ${p.glow} transition-all w-full text-left`}
    >
      <FloatingCards palette={p} />
      <IconCard palette={p} icon={icon} />
      <div className="relative flex-1 min-w-0">
        <div className="font-display text-lg sm:text-xl tracking-wider text-ink">{title}</div>
        <div className="text-[11px] sm:text-xs text-ink-soft mt-0.5 sm:mt-1 leading-snug">{subtitle}</div>
      </div>
      <div className={`relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 grid place-items-center rounded-full
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
