import Avatar from '../ui/Avatar';

// Welcome card matches the mockup: avatar + WELCOME BACK + USERNAME +
// league pill on the left; coins/rating/wins/win-rate stats grid on the
// right. Numbers are formatted with thousand separators for readability
// and abbreviated on phone (12,345 → 12.3K) so the 4-stat grid fits.

const fmt = (n) => Number(n || 0).toLocaleString();
const fmtCompact = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000)    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return fmt(num);
};

function Stat({ label, value, valueCompact, icon, accent }) {
  return (
    <div className="text-center">
      <div className={`text-lg sm:text-2xl font-extrabold tabular-nums ${accent || 'text-ink'}`}>
        <span className="sm:hidden">{valueCompact ?? value}</span>
        <span className="hidden sm:inline">{value}</span>
      </div>
      <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-ink-faint mt-0.5 sm:mt-1">
        {icon && <span className="text-xs sm:text-sm">{icon}</span>}{label}
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
    <div className="panel-card p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6">
      <div className="flex items-center gap-3 sm:gap-4 sm:flex-1 min-w-0 w-full">
        <Avatar
          src={user.avatar}
          name={user.username}
          size="lg"
          ring
          level={user.accountLevel || 1}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-ink-faint">Welcome back</div>
          <div className="font-display text-2xl sm:text-4xl tracking-wider text-accent leading-tight truncate">
            {user.username}
          </div>
          <div className="mt-1 sm:mt-1.5 inline-flex items-center gap-1 chip bg-bg-3 text-ink-soft border border-line">
            <span>🏅</span>{leagueLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-8 w-full sm:w-auto sm:border-l sm:border-line sm:pl-6 sm:flex-1">
        <Stat label="Coins"    value={fmt(user.coins)}      valueCompact={fmtCompact(user.coins)}     icon="🪙" accent="text-accent" />
        <Stat label="Rating"   value={fmt(user.elo || 1000)} valueCompact={fmtCompact(user.elo || 1000)} icon="🏆" accent="text-violet-soft" />
        <Stat label="Wins"     value={fmt(wins)}             valueCompact={fmtCompact(wins)}            icon="👑" accent="text-emerald" />
        <Stat label="Win Rate" value={`${winRate}%`}         icon="📈" accent="text-sky" />
      </div>
    </div>
  );
}
