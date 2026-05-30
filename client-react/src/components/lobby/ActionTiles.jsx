import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (sky). Each tile has a swarm of tilted UNO mini-cards that
// STICK OUT past the rounded edges (no overflow-hidden) — this is the
// hero detail that makes the row feel premium in the mockup. Layouts
// are mirrored so the visual flow converges on the center title.

const PALETTES = {
  violet: {
    bg:       'from-violet/40 via-violet/20 to-violet/5',
    border:   'border-violet/50 hover:border-violet/80',
    glow:     'shadow-[0_8px_28px_rgba(124,58,237,0.40)]',
    arrow:    'from-violet to-violet-deep',
    iconCard: 'from-violet to-violet-deep',
    // 6 scattered cards in different colors, sizes, rotations, with
    // multiple cards INTENTIONALLY positioned with negative offsets so
    // they protrude past the tile's rounded border like the mockup.
    floats: [
      { cls: 'w-12 h-16 -left-6  -top-4   rotate-[-22deg] z-20', grad: 'from-emerald to-emerald/60', face: '8'   },
      { cls: 'w-10 h-14 -left-2  -bottom-5 rotate-[18deg]  z-20', grad: 'from-rose to-rose/60',       face: '+2'  },
      { cls: 'w-9  h-12 left-14   -top-6   rotate-[8deg]   z-10', grad: 'from-violet to-violet-deep', face: 'UNO' },
      { cls: 'w-8  h-11 left-28   -bottom-6 rotate-[-12deg] z-10', grad: 'from-amber-400 to-amber-600', face: '7'  },
      { cls: 'w-11 h-15 -right-6  -top-3   rotate-[20deg]  z-20', grad: 'from-rose to-rose/60',       face: '5'   },
      { cls: 'w-9  h-12 -right-3  -bottom-5 rotate-[-15deg] z-20', grad: 'from-emerald to-emerald/60', face: '4'  },
    ],
  },
  sky: {
    bg:       'from-sky/40 via-sky/20 to-sky/5',
    border:   'border-sky/50 hover:border-sky/80',
    glow:     'shadow-[0_8px_28px_rgba(14,165,233,0.40)]',
    arrow:    'from-sky to-sky/70',
    iconCard: 'from-sky to-sky/70',
    floats: [
      { cls: 'w-12 h-16 -right-6 -top-4   rotate-[22deg]  z-20', grad: 'from-rose to-rose/60',       face: '6'   },
      { cls: 'w-10 h-14 -right-2 -bottom-5 rotate-[-18deg] z-20', grad: 'from-emerald to-emerald/60', face: '+2'  },
      { cls: 'w-9  h-12 right-14  -top-6   rotate-[-8deg]  z-10', grad: 'from-sky to-sky/70',         face: '⚡'  },
      { cls: 'w-8  h-11 right-28  -bottom-6 rotate-[12deg]  z-10', grad: 'from-violet to-violet-deep', face: '4'  },
      { cls: 'w-11 h-15 -left-6   -top-3   rotate-[-20deg] z-20', grad: 'from-emerald to-emerald/60', face: '9'  },
      { cls: 'w-9  h-12 -left-3   -bottom-5 rotate-[15deg]  z-20', grad: 'from-rose to-rose/60',       face: '3'  },
    ],
  },
};

function FloatingCards({ palette }) {
  return (
    // The container intentionally has no overflow-hidden so child cards
    // poke past the tile's rounded edges.
    <div className="absolute inset-0 pointer-events-none select-none">
      {palette.floats.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-md border-2 border-white/30 shadow-[0_8px_22px_rgba(0,0,0,0.5)]
                      bg-gradient-to-br ${f.grad} ${f.cls}
                      grid place-items-center font-display text-white
                      drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]`}
        >
          {/* Inner white-ring border + face label gives the silhouette
              real "playing card" structure. */}
          <div className="absolute inset-1 rounded border border-white/25 pointer-events-none" />
          <span className="relative leading-none text-[10px] sm:text-xs font-extrabold tracking-wide">
            {f.face}
          </span>
        </div>
      ))}
    </div>
  );
}

function IconCard({ palette, icon }) {
  return (
    <div className={`relative z-30 w-14 sm:w-16 h-14 sm:h-16 shrink-0 rounded-full grid place-items-center
                     text-2xl sm:text-3xl bg-gradient-to-br ${palette.iconCard}
                     border-2 border-white/30 ring-1 ring-white/10
                     shadow-[0_8px_24px_rgba(0,0,0,0.45)]
                     drop-shadow-[0_2px_8px_rgba(0,0,0,.3)]`}>
      {icon}
    </div>
  );
}

function ArrowChip({ palette }) {
  return (
    <div className={`relative z-30 w-10 h-10 sm:w-11 sm:h-11 shrink-0 grid place-items-center rounded-full
                     bg-gradient-to-br ${palette.arrow}
                     border-2 border-white/30 text-white text-lg sm:text-xl font-bold
                     shadow-[0_8px_20px_rgba(0,0,0,0.45)]`}>→</div>
  );
}

function Tile({ onClick, accent, icon, title, subtitle, mirror = false }) {
  const p = PALETTES[accent] || PALETTES.violet;
  return (
    // IMPORTANT: no overflow-hidden on the tile — so the float-cards
    // poke past the rounded corners exactly like the mockup.
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border
                  bg-gradient-to-br ${p.bg} ${p.border} ${p.glow} transition-all w-full text-left`}
      style={{ overflow: 'visible' }}
    >
      <FloatingCards palette={p} />
      {mirror ? <ArrowChip palette={p} /> : <IconCard palette={p} icon={icon} />}
      <div className={`relative z-30 flex-1 min-w-0 ${mirror ? 'text-right' : 'text-left'}`}>
        <div className="font-display text-lg sm:text-xl tracking-wider text-ink drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{title}</div>
        <div className="text-[11px] sm:text-xs text-ink-soft mt-0.5 sm:mt-1 leading-snug">{subtitle}</div>
      </div>
      {mirror ? <IconCard palette={p} icon={icon} /> : <ArrowChip palette={p} />}
    </motion.button>
  );
}

export default function ActionTiles({ onCreate, onQuickMatch }) {
  // py-4 sm:py-6 on the wrapper gives the float-cards vertical clearance
  // to stick out past the tiles without colliding with the row above or
  // below in the lobby flex column.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 py-3 sm:py-5">
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
