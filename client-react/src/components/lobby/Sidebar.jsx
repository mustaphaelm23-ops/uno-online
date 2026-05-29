// Left sidebar nav — mirrors the mockup's vertical menu. Each item gets
// its own icon tint so the rail reads as a colorful list (the mockup
// uses gold/teal/red/violet/etc. per category). The PLAY item is the
// always-active "you are here" indicator on the lobby and gets the
// gold accent + chevron + heavy glow border.

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

// Icon-container palette: a gradient bg + matching glow ring so each icon
// reads as a small "chip" the way the mockup composes them.
const TINT = {
  accent:  { bg: 'bg-gradient-to-br from-accent/30  to-accent-deep/30',  text: 'text-accent',     ring: 'ring-accent/20' },
  emerald: { bg: 'bg-gradient-to-br from-emerald/30 to-emerald/10',      text: 'text-emerald',    ring: 'ring-emerald/20' },
  rose:    { bg: 'bg-gradient-to-br from-rose/30    to-rose/10',         text: 'text-rose',       ring: 'ring-rose/20' },
  violet:  { bg: 'bg-gradient-to-br from-violet/30  to-violet-deep/30',  text: 'text-violet-soft',ring: 'ring-violet/20' },
  sky:     { bg: 'bg-gradient-to-br from-sky/30     to-sky/10',          text: 'text-sky',        ring: 'ring-sky/20' },
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
        const isActive = item.active;
        return (
          <motion.button
            key={item.id}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAction?.(item.id)}
            className={`group relative text-left flex items-center gap-3 rounded-xl p-2.5 lg:p-3 border transition
              ${isActive
                ? 'bg-gradient-to-br from-bg-3 via-bg-2 to-bg-2 border-accent/60 shadow-glow-gold ring-1 ring-accent/20'
                : 'bg-bg-2/60 border-line hover:border-violet/40 hover:bg-bg-3/60'}`}
          >
            {/* Active item gets a subtle gold inner highlight along the top */}
            {isActive && (
              <span className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            )}
            <div className={`w-9 h-9 lg:w-10 lg:h-10 grid place-items-center rounded-lg text-lg lg:text-xl shrink-0
                            border border-white/5 ring-1 ${tint.ring}
                            ${isActive ? 'bg-gradient-to-br from-accent/30 to-accent-deep/30 text-accent' : `${tint.bg} ${tint.text}`}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] lg:text-sm font-extrabold uppercase tracking-wide leading-none mb-0.5 lg:mb-1 truncate
                ${isActive ? 'text-accent' : 'text-ink'}`}>{item.label}</div>
              <div className="text-[10px] lg:text-[11px] text-ink-faint truncate">{item.sub}</div>
            </div>
            {isActive && <div className="text-accent text-lg shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">›</div>}
          </motion.button>
        );
      })}
    </aside>
  );
}
