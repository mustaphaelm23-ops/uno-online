import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (sky). Each tile is wrapped by scattered, tilted mini UNO cards
// that float around the edges — the mockup's "cards drifting around the
// CTA" hero motif. Layouts are MIRRORED:
//   Create Room → person-icon LEFT, arrow RIGHT
//   Quick Match → arrow LEFT, lightning-icon RIGHT
// Both arrows point right; the result reads as a visual flow that
// converges on the center title from both ends of the row.

const PALETTES = {
  violet: {
    bg:        'from-violet/40 via-violet/20 to-violet/5',
    border:    'border-violet/50 hover:border-violet/80',
    glow:      'shadow-[0_8px_28px_rgba(124,58,237,0.40)]',
    arrow:     'from-violet to-violet-deep',
    iconCard:  'from-violet to-violet-deep',
    // 5 scattered cards in different colors, sizes, rotations and
    // positions so the tile feels alive (not just "cards in a corner").
    floats: [
      { cls: 'w-10 h-14 -left-3   top-2     rotate-[-22deg] z-0', grad: 'from-emerald to-emerald/60', face: '8' },
      { cls: 'w-9  h-12 -left-1   -bottom-2 rotate-[18deg]  z-0', grad: 'from-rose to-rose/60',       face: '+2' },
      { cls: 'w-8  h-11 left-12   -top-3    rotate-[8deg]   z-0', grad: 'from-violet to-violet-deep', face: 'UNO' },
      { cls: 'w-7  h-10 left-24   -bottom-3 rotate-[-12deg] z-0', grad: 'from-amber-400 to-amber-600', face: '7' },
      { cls: 'w-9  h-12 right-2   -top-4    rotate-[16deg]  z-0', grad: 'from-rose to-rose/60',       face: '5' },
    ],
  },
  sky: {
    bg:       'from-sky/40 via-sky/20 to-sky/5',
    border:   'border-sky/50 hover:border-sky/80',
    glow:     'shadow-[0_8px_28px_rgba(14,165,233,0.40)]',
    arrow:    'from-sky to-sky/70',
    iconCard: 'from-sky to-sky/70',
    floats: [
      { cls: 'w-10 h-14 -right-3  top-2     rotate-[22deg]  z-0', grad: 'from-rose to-rose/60',       face: '6' },
      { cls: 'w-9  h-12 -right-1  -bottom-2 rotate-[-18deg] z-0', grad: 'from-emerald to-emerald/60', face: '+2' },
      { cls: 'w-8  h-11 right-12  -top-3    rotate-[-8deg]  z-0', grad: 'from-sky to-sky/70',         face: '⚡' },
      { cls: 'w-7  h-10 right-24  -bottom-3 rotate-[12deg]  z-0', grad: 'from-violet to-violet-deep', face: '4' },
      { cls: 'w-9  h-12 left-2    -top-4    rotate-[-16deg] z-0', grad: 'from-emerald to-emerald/60', face: '9' },
    ],
  },
};

function FloatingCards({ palette }) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none opacity-95">
      {palette.floats.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-md border border-white/20 shadow-card-lg
                      bg-gradient-to-br ${f.grad} ${f.cls}
                      grid place-items-center font-display text-[9px] text-white
                      drop-shadow-[0_2px_6px_rgba(0,0,0,.4)]`}
        >
          {/* Inner border + tiny face label so the cards read as playing cards */}
          <div className="absolute inset-1 rounded border border-white/15 pointer-events-none" />
          <span className="relative leading-none">{f.face}</span>
        </div>
      ))}
    </div>
  );
}

function IconCard({ palette, icon }) {
  // Circular icon container per mockup — softer than a rounded-xl card.
  return (
    <div className={`relative z-10 w-14 sm:w-16 h-14 sm:h-16 shrink-0 rounded-full grid place-items-center
                     text-2xl sm:text-3xl bg-gradient-to-br ${palette.iconCard}
                     border border-white/30 ring-1 ring-white/10
                     shadow-[0_8px_24px_rgba(0,0,0,0.35)]
                     drop-shadow-[0_2px_8px_rgba(0,0,0,.3)]`}>
      {icon}
    </div>
  );
}

function ArrowChip({ palette }) {
  return (
    <div className={`relative z-10 w-10 h-10 sm:w-11 sm:h-11 shrink-0 grid place-items-center rounded-full
                     bg-gradient-to-br ${palette.arrow}
                     border border-white/30 text-white text-lg sm:text-xl font-bold
                     shadow-[0_8px_20px_rgba(0,0,0,0.35)]`}>→</div>
  );
}

function Tile({ onClick, accent, icon, title, subtitle, mirror = false }) {
  const p = PALETTES[accent] || PALETTES.violet;
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border
                  bg-gradient-to-br ${p.bg} ${p.border} ${p.glow} transition-all w-full text-left`}
    >
      <FloatingCards palette={p} />
      {/* Mirror layout: arrow on LEFT, icon on RIGHT for Quick Match;
          icon on LEFT, arrow on RIGHT for Create Room. */}
      {mirror ? <ArrowChip palette={p} /> : <IconCard palette={p} icon={icon} />}
      <div className={`relative z-10 flex-1 min-w-0 ${mirror ? 'text-right' : 'text-left'}`}>
        <div className="font-display text-lg sm:text-xl tracking-wider text-ink drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">{title}</div>
        <div className="text-[11px] sm:text-xs text-ink-soft mt-0.5 sm:mt-1 leading-snug">{subtitle}</div>
      </div>
      {mirror ? <IconCard palette={p} icon={icon} /> : <ArrowChip palette={p} />}
    </motion.button>
  );
}

export default function ActionTiles({ onCreate, onQuickMatch }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <Tile
        onClick={onCreate}
        accent="violet"
        icon="👤"
        title="CREATE ROOM"
        subtitle="Create your own room and invite friends"
      />
      <Tile
        onClick={onQuickMatch}
        accent="sky"
        icon="⚡"
        title="QUICK MATCH"
        subtitle="Play with random players"
        mirror
      />
    </div>
  );
}
