// Battle Pass widget. Reads BP progress from the user object (server
// already surfaces it through /api/auth/me extensions). Falls back to
// reasonable defaults so the card renders before data lands.

export default function BattlePassCard({ user, onView }) {
  const xp     = user?.bp?.xp     ?? user?.battlePass?.xp     ?? 750;
  const target = user?.bp?.target ?? user?.battlePass?.target ?? 1000;
  const level  = user?.bp?.level  ?? user?.battlePass?.level  ?? 12;
  const pct    = Math.max(0, Math.min(100, Math.round((xp / target) * 100)));

  return (
    <div className="panel-card p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 text-7xl opacity-10 rotate-12 select-none pointer-events-none">🎴</div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Season 1</div>
      <h3 className="font-display text-2xl tracking-wider text-accent mt-0.5">BATTLE PASS</h3>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-1.5 text-xs text-ink-soft">
          <span className="flex items-center gap-1">⭐ <span className="font-bold text-ink">{xp.toLocaleString()}</span>/{target.toLocaleString()}</span>
          <span className="chip bg-bg-3 border border-line">Lv {level}</span>
        </div>
        <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-soft transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button type="button" onClick={onView} className="btn-ghost w-full mt-4 text-xs uppercase tracking-widest">
        View Rewards
      </button>
    </div>
  );
}
