// Left sidebar nav — mirrors the mockup's vertical menu. The PLAY item is
// the always-active "you are here" indicator on the lobby; other items
// surface entry points to features that ship in follow-up commits.
// Clicking them currently emits a toast so users see they're recognized.

import { motion } from 'framer-motion';

const ITEMS = [
  { id: 'play',    label: 'Play',         sub: 'Start your match',       icon: '🏠', active: true },
  { id: 'join',    label: 'Join by code', sub: 'Enter room code',        icon: '🔑' },
  { id: 'quick',   label: 'Quick Match',  sub: 'Find a random match',    icon: '⚡' },
  { id: 'games',   label: 'Game Center',  sub: 'Fun mini games',         icon: '🎮' },
  { id: 'daily',   label: 'Daily Reward', sub: 'Collect your bonus',     icon: '🎁' },
  { id: 'ranked',  label: 'Ranked',       sub: 'Climb the leaderboard',  icon: '👑' },
  { id: 'tourny',  label: 'Tournament',   sub: 'Compete & win',          icon: '🏆' },
  { id: 'shop',    label: 'Shop',         sub: 'Buy coins & items',      icon: '🛍️' },
];

export default function Sidebar({ onAction }) {
  return (
    <aside className="hidden lg:flex flex-col gap-2 w-64 shrink-0">
      {ITEMS.map((item) => (
        <motion.button
          key={item.id}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAction?.(item.id)}
          className={`group text-left flex items-center gap-3 rounded-xl p-3 border transition
            ${item.active
              ? 'bg-gradient-to-br from-bg-3 to-bg-2 border-accent/40 shadow-glow-gold'
              : 'bg-bg-2/60 border-line hover:border-violet/40 hover:bg-bg-3/60'}`}
        >
          <div className={`w-10 h-10 grid place-items-center rounded-lg text-xl
            ${item.active ? 'bg-accent/15 text-accent' : 'bg-bg/40 text-ink-soft group-hover:text-ink'}`}
          >{item.icon}</div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-extrabold uppercase tracking-wide leading-none mb-1
              ${item.active ? 'text-accent' : 'text-ink'}`}>{item.label}</div>
            <div className="text-[11px] text-ink-faint truncate">{item.sub}</div>
          </div>
          {item.active && <div className="text-accent text-lg">›</div>}
        </motion.button>
      ))}
    </aside>
  );
}
