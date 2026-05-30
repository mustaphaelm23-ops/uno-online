import { motion } from 'framer-motion';

// The two big action tiles from the mockup: Create Room (violet) and Quick
// Match (sky). Sit DIRECTLY under the Public Rooms section as the hero
// CTAs of the lobby. Tilted UNO mini-cards protrude past the rounded
// edges so each tile reads as a premium "cards exploding outward" CTA.
// Layouts are mirrored so the visual flow converges on the centered title.

const PALETTES = {
  violet: {
    bg:       'from-violet/50 via-violet/25 to-violet/5',
    border:   'border-violet/60 hover:border-violet',
    glow:     'shadow-[0_12px_40px_rgba(124,58,237,0.50)]',
    arrow:    'from-violet to-violet-deep',
    iconCard: 'from-violet to-violet-deep',
    // 6 scattered cards in different colors / sizes / rotations.
    // Multiple cards INTENTIONALLY positioned with negative offsets so
    // they protrude past the tile's rounded border like the mockup.
    floats: [
      { cls: 'w-14 h-20 -left-7  -top-5    rotate-[-22deg] z-20', grad: 'from-emerald to-emerald/60',  face: '8'   },
      { cls: 'w-12 h-16 -left-3  -bottom-6 rotate-[18deg]  z-20', grad: 'from-rose to-rose/60',        face: '+2'  },
      { cls: 'w-10 h-14 left-16  -top-7    rotate-[8deg]   z-10', grad: 'from-violet to-violet-deep',  face: 'UNO' },
      { cls: 'w-9  h-13 left-32  -bottom-7 rotate-[-12deg] z-10', grad: 'from-amber-400 to-amber-600', face: '7'   },
      { cls: 'w-12 h-17 -right-7 -top-4    rotate-[20deg]  z-20', grad: 'from-rose to-rose/60',        face: '5'   },
      { cls: 'w-10 h-14 -right-3 -bottom-6 rotate-[-15deg] z-20', grad: 'from-emerald to-emerald/60',  face: '4'   },
    ],
  },
  sky: {
    bg:       'from-sky/50 via-sky/25 to-sky/5',
    border:   'border-sky/60 hover:border-sky',
    glow:     'shadow-[0_12px_40px_rgba(14,165,233,0.50)]',
    arrow:    'from-sky to-sky/70',
    iconCard: 'from-sky to-sky/70',
    floats: [
      { cls: 'w-14 h-20 -right-7 -top-5    rotate-[22deg]  z-20', grad: 'from-rose to-rose/60',        face: '6'   },
      { cls: 'w-12 h-16 -right-3 -bottom-6 rotate-[-18deg] z-20', grad: 'from-emerald to-emerald/60',  face: '+2'  },
      { cls: 'w-10 h-14 right-16 -top-7    rotate-[-8deg]  z-10', grad: 'from-sky to-sky/70',          face: '⚡'  },
      { cls: 'w-9  h-13 right-32 -bottom-7 rotate-[12deg]  z-10', grad: 'from-violet to-violet-deep',  face: '4'   },
      { cls: 'w-12 h-17 -left-7  -top-4    rotate-[-20deg] z-20', grad: 'from-emerald to-emerald/60',  face: '9'   },
      { cls: 'w-10 h-14 -left-3  -bottom-6 rotate-[15deg]  z-20', grad: 'from-rose to-rose/60',        face: '3'   },
    ],
  },
};

function FloatingCards({ palette }) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {palette.floats.map((f, i) => (
        <div
          key={i}
          className={`absolute rounded-lg border-2 border-white/30 shadow-[0_10px_28px_rgba(0,0,0,0.55)]
                      bg-gradient-to-br ${f.grad} ${f.cls}
                      grid place-items-center font-display text-white
                      drop-shadow-[0_3px_10px_rgba(0,0,0,.5)]`}
        >
          <div className="absolute inset-1 rounded border border-white/25 pointer-events-none" />
          <span className="relative leading-none text-xs sm:text-sm font-extrabold tracking-wide">
            {f.face}
          </span>
        </div>
      ))}
    </div>
  );
}

function IconCard({ palette, icon }) {
  return (
    <div className={`relative z-30 w-16 sm:w-20 h-16 sm:h-20 shrink-0 rounded-full grid place-items-center
                     text-3xl sm:text-4xl bg-gradient-to-br ${palette.iconCard}
                     border-2 border-white/30 ring-2 ring-white/10
                     shadow-[0_10px_28px_rgba(0,0,0,0.55)]
                     drop-shadow-[0_3px_10px_rgba(0,0,0,.4)]`}>
      {icon}
    </div>
  );
}

function ArrowChip({ palette }) {
  return (
    <div className={`relative z-30 w-12 h-12 sm:w-14 sm:h-14 shrink-0 grid place-items-center rounded-full
                     bg-gradient-to-br ${palette.arrow}
                     border-2 border-white/30 text-white text-xl sm:text-2xl font-bold
                     shadow-[0_10px_24px_rgba(0,0,0,0.55)]`}>→</div>
  );
}

function Tile({ onClick, accent, icon, title, subtitle, mirror = false }) {
  const p = PALETTES[accent] || PALETTES.violet;
  return (
    // overflow visible so float-cards poke past the rounded corners.
    // Generous py-7 / sm:py-8 makes the tile read as a tall hero CTA.
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex items-center gap-4 sm:gap-5 px-5 sm:px-6 py-7 sm:py-8 rounded-3xl border-2
                  bg-gradient-to-br ${p.bg} ${p.border} ${p.glow} transition-all w-full text-left`}
      style={{ overflow: 'visible' }}
    >
      <FloatingCards palette={p} />
      {mirror ? <ArrowChip palette={p} /> : <IconCard palette={p} icon={icon} />}
      <div className={`relative z-30 flex-1 min-w-0 ${mirror ? 'text-right' : 'text-left'}`}>
        <div className="font-display text-xl sm:text-2xl tracking-wider text-ink drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          {title}
        </div>
        <div className="text-xs sm:text-sm text-ink-soft mt-1 sm:mt-1.5 leading-snug">{subtitle}</div>
      </div>
      {mirror ? <IconCard palette={p} icon={icon} /> : <ArrowChip palette={p} />}
    </motion.button>
  );
}

export default function ActionTiles({ onCreate, onQuickMatch }) {
  // Larger vertical padding around the row so protruding cards have
  // clearance from the section above (Public Rooms) and below (BottomNav).
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-7 py-5 sm:py-7">
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
