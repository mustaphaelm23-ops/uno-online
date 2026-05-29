// Bottom action nav from the mockup. Each tile has its own icon tint
// (cyan / violet / gold / rose / amber) so the strip reads as a
// colorful row of distinct categories rather than five uniform buttons.

const ITEMS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: '📊', tint: 'sky'     },
  { id: 'missions',    label: 'Missions',    icon: '🎯', tint: 'violet', badge: 3 },
  { id: 'achievements',label: 'Achievements',icon: '🏆', tint: 'accent'  },
  { id: 'collection',  label: 'Collection',  icon: '🎴', tint: 'rose'    },
  { id: 'emotes',      label: 'Emotes',      icon: '😎', tint: 'emerald' },
];

const TINT = {
  sky:     'text-sky',
  violet:  'text-violet-soft',
  accent:  'text-accent',
  rose:    'text-rose',
  emerald: 'text-emerald',
};

export default function BottomNav({ onAction }) {
  return (
    <nav className="panel-card p-2 sm:p-4">
      <div className="flex justify-around gap-1 sm:gap-2">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction?.(item.id)}
            className="relative group flex-1 min-w-0 flex flex-col items-center gap-1 py-1 sm:py-1.5 rounded-xl
                       hover:bg-bg-3/40 transition"
          >
            <div className={`text-xl sm:text-2xl group-hover:scale-110 transition-transform drop-shadow-[0_2px_8px_rgba(0,0,0,.5)] ${TINT[item.tint] || ''}`}>
              {item.icon}
            </div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider sm:tracking-widest text-ink-soft group-hover:text-ink truncate w-full text-center font-bold">
              {item.label}
            </div>
            {item.badge && (
              <span className="absolute top-0 right-1 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose text-white text-[9px] sm:text-[10px]
                              font-bold grid place-items-center shadow-card">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
