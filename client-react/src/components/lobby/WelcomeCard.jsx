import Avatar from '../ui/Avatar';

// Welcome card matches the mockup: avatar + WELCOME BACK + USERNAME +
// league pill on the left; coins/rating/wins/win-rate stats grid on the
// right. Numbers are formatted with thousand separators for readability.

const fmt = (n) => Number(n || 0).toLocaleString();

function Stat({ label, value, icon, accent }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-extrabold ${accent || 'text-ink'}`}>{value}</div>
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-ink-faint mt-1">
        {icon && <span className="text-sm">{icon}</span>}{label}
      </div>
    </div>
  );
}

export default function WelcomeCard({ user }) {
  if (!user) return null;
  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const total = wins + losses;
  const winRate = total ? Math.round((wins / total) * 100) : 0;
  const leagueLabel = user.league?.name || 'Unranked';

  return (
    <div className="panel-card p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-stretch gap-5 sm:gap-6">
      <div className="flex items-center gap-4 sm:flex-1 min-w-0">
        <Avatar src={user.avatar} name={user.username} size="xl" ring />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.3em] text-ink-faint">Welcome back</div>
          <div className="font-display text-3xl sm:text-4xl tracking-wider text-accent leading-tight truncate">
            {user.username}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 chip bg-bg-3 text-ink-soft border border-line">
            <span>🏅</span>{leagueLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 sm:gap-8 sm:border-l sm:border-line sm:pl-6 sm:flex-1">
        <Stat label="Coins"    value={fmt(user.coins)}  icon="🪙" accent="text-accent" />
        <Stat label="Rating"   value={fmt(user.elo || 1000)} icon="🏆" accent="text-violet-soft" />
        <Stat label="Wins"     value={fmt(wins)}        icon="👑" accent="text-emerald" />
        <Stat label="Win Rate" value={`${winRate}%`}    icon="📈" accent="text-sky" />
      </div>
    </div>
  );
}
