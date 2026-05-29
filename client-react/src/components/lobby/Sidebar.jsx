// Left sidebar nav — mirrors the mockup's vertical menu. Each item gets
// its own icon tint so the rail reads as a colorful list (the mockup
// uses gold/teal/red/violet/etc. per category). The PLAY item is the
// always-active "you are here" indicator on the lobby and gets the
// gold accent + chevron.

import { motion } from 'framer-motion';

const ITEMS = [
  { id: 'play',    label: 'Play',         sub: 'Start your match',       icon: '🏠', tint: 'accent', active: true },
  { id: 'join',    label: 'Join by code', sub: 'Enter room code',        icon: '🔑', tint: 'emerald' },
  { id: 'quick',   label: 'Quick Match',  sub: 'Find a random match',    icon: '⚡', tint: 'rose'    },
  { id: 'games',   label: 'Game Center',  sub: 'Fun mini games',         icon: '🎮', tint: 'violet'  },
  { id: 'daily',   label: 'Daily Reward', sub: 'Collect your bonus',     icon: '🎁', tint: 'rose'    },
  { id: 'ranked',  label: 'Ranked',       sub: 'Climb the leaderboard',  icon: '👑', tint: 'accent'  },
  { id: 'tourny',  label: 'Tournament',   sub: 'Compete & win',          icon: '🏆', tint: 'accent'  },
  { id: 'shop',    label: 'Shop',         sub: 'Buy coins & items',      icon: '🛍️', tint: 'sky'     },
];

const TINT = {
  accent:  'bg-accent/15  text-accent',
  emerald: 'bg-emerald/15 text-emerald',
  rose:    'bg-rose/15    text-rose',
  violet:  'bg-violet/15  text-violet-soft',
  sky:     'bg-sky/15     text-sky',
};

// `inDrawer` flips the visibility / sizing so the same component works
// both as the desktop left-rail (sticky, fixed width, hidden under lg)
// and inside the mobile SidebarDrawer (full-width, always visible since
// the drawer handles its own visibility).
export default function Sidebar({ onAction, inDrawer = false }) {
  const wrapperCls = inDrawer
    ? 'flex flex-col gap-1.5 w-full'
    : 'hidden lg:flex flex-col gap-2 w-64 shrink-0';
  return (
    <aside className={wrapperCls}>
      {ITEMS.map((item) => {
        const tint = TINT[item.tint] || TINT.violet;
        return (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAction?.(item.id)}
            className={`group text-left flex items-center gap-3 rounded-xl p-2.5 lg:p-3 border transition
              ${item.active
                ? 'bg-gradient-to-br from-bg-3 to-bg-2 border-accent/40 shadow-glow-gold'
                : 'bg-bg-2/60 border-line hover:border-violet/40 hover:bg-bg-3/60'}`}
          >
            <div className={`w-9 h-9 lg:w-10 lg:h-10 grid place-items-center rounded-lg text-lg lg:text-xl shrink-0
              ${item.active ? 'bg-accent/15 text-accent' : tint}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] lg:text-sm font-extrabold uppercase tracking-wide leading-none mb-0.5 lg:mb-1 truncate
                ${item.active ? 'text-accent' : 'text-ink'}`}>{item.label}</div>
              <div className="text-[10px] lg:text-[11px] text-ink-faint truncate">{item.sub}</div>
            </div>
            {item.active && <div className="text-accent text-lg shrink-0">›</div>}
          </motion.button>
        );
      })}
    </aside>
  );
}
