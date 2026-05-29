// Bottom action nav from the mockup. Mostly stubs for follow-up commits
// — each tile calls onAction(id) so the lobby page can route to the right
// modal/page once those features are ported over.

const ITEMS = [
  { id: 'leaderboard', label: 'Leaderboard', icon: '📊' },
  { id: 'missions',    label: 'Missions',    icon: '🎯', badge: 3 },
  { id: 'achievements',label: 'Achievements', icon: '🏆' },
  { id: 'collection',  label: 'Collection',  icon: '🎴' },
  { id: 'emotes',      label: 'Emotes',      icon: '😎' },
];

export default function BottomNav({ onAction }) {
  return (
    <nav className="panel-card p-3 sm:p-4">
      <div className="flex justify-around gap-2">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction?.(item.id)}
            className="relative group flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl
                       hover:bg-bg-3/40 transition"
          >
            <div className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-soft group-hover:text-ink">
              {item.label}
            </div>
            {item.badge && (
              <span className="absolute top-0 right-2 w-5 h-5 rounded-full bg-rose text-white text-[10px]
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
