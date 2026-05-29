// Bottom action nav from the mockup. Each tile's icon now sits inside
// its own colored gradient tile (sky / violet / gold / rose / emerald)
// so the row reads as a strip of distinct categories — matches the
// mockup's illustrated icon look rather than flat emoji on bg.

const ITEMS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: '📊', tint: 'sky'     },
  { id: 'missions',    label: 'Missions',    icon: '🎯', tint: 'violet', badge: 3 },
  { id: 'achievements',label: 'Achievements',icon: '🏆', tint: 'accent'  },
  { id: 'collection',  label: 'Collection',  icon: '🎴', tint: 'rose'    },
  { id: 'emotes',      label: 'Emotes',      icon: '😎', tint: 'emerald' },
];

const TINT = {
  sky:     { bg: 'bg-gradient-to-br from-sky/30     to-sky/5',      ring: 'ring-sky/30'     },
  violet:  { bg: 'bg-gradient-to-br from-violet/30  to-violet/5',   ring: 'ring-violet/30'  },
  accent:  { bg: 'bg-gradient-to-br from-accent/30  to-accent/5',   ring: 'ring-accent/30'  },
  rose:    { bg: 'bg-gradient-to-br from-rose/30    to-rose/5',     ring: 'ring-rose/30'    },
  emerald: { bg: 'bg-gradient-to-br from-emerald/30 to-emerald/5',  ring: 'ring-emerald/30' },
};

export default function BottomNav({ onAction }) {
  return (
    <nav className="panel-card p-2 sm:p-4">
      <div className="flex justify-around gap-1 sm:gap-2">
        {ITEMS.map((item) => {
          const t = TINT[item.tint] || TINT.violet;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onAction?.(item.id)}
              className="relative group flex-1 min-w-0 flex flex-col items-center gap-1 sm:gap-1.5
                         py-1 sm:py-1.5 rounded-xl hover:bg-bg-3/40 transition"
            >
              {/* Icon tile — gradient bg + faint ring so the icon reads
                  as a small illustrated chip per the mockup. */}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded-xl
                              ${t.bg} ring-1 ${t.ring} border border-white/5
                              group-hover:scale-110 transition-transform shadow-card
                              text-xl sm:text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,.5)]`}>
                {item.icon}
              </div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest
                              text-ink-soft group-hover:text-ink truncate w-full text-center font-bold">
                {item.label}
              </div>
              {item.badge && (
                <span className="absolute top-0 right-1 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full
                                bg-rose text-white text-[9px] sm:text-[10px]
                                font-bold grid place-items-center shadow-card border-2 border-bg">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
