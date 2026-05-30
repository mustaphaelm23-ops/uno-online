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
    <div className="text-center px-2 sm:px-3 first:pl-0 last:pr-0">
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
    // Pill-shaped card per mockup — softer top/bottom curves (rounded-3xl)
    // with a subtle inner border highlight so it reads as a hero element.
    <div className="relative rounded-3xl border border-line bg-gradient-to-br from-bg-2 to-bg
                    p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6
                    shadow-card overflow-hidden">
      {/* Soft top highlight rim */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      {/* Ambient glow behind avatar */}
      <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full
                      bg-violet/15 blur-3xl pointer-events-none" aria-hidden />

      <div className="relative flex items-center gap-3 sm:gap-4 sm:flex-1 min-w-0 w-full">
        {/* Gradient ring frame around the avatar — matches the mockup's
            premium gold/violet halo around the user's portrait. */}
        <div className="relative shrink-0 p-[3px] rounded-full bg-gradient-to-br from-accent via-amber-400 to-accent-deep
                        shadow-[0_0_24px_rgba(245,158,11,0.45)]">
          <div className="rounded-full bg-bg-2 p-[2px]">
            <Avatar
              src={user.avatar}
              name={user.username}
              size="lg"
              level={user.accountLevel || 1}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-ink-faint">Welcome back</div>
          <div className="font-display text-2xl sm:text-4xl tracking-wider text-accent leading-tight truncate
                          drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]">
            {user.username}
          </div>
          <div className="mt-1 sm:mt-1.5 inline-flex items-center gap-1 chip bg-bg-3 text-ink-soft border border-line">
            <span>🏅</span>{leagueLabel}
          </div>
        </div>
      </div>

      {/* Stats grid with subtle vertical dividers between each column,
          matching the mockup's right-side meta strip. */}
      <div className="relative grid grid-cols-4 w-full sm:w-auto sm:flex-1 sm:border-l sm:border-line/60 sm:pl-6
                      divide-x divide-line/40">
        <Stat label="Coins"    value={fmt(user.coins)}       valueCompact={fmtCompact(user.coins)}     icon="🪙" accent="text-accent" />
        <Stat label="Rating"   value={fmt(user.elo || 1000)} valueCompact={fmtCompact(user.elo || 1000)} icon="🏆" accent="text-violet-soft" />
        <Stat label="Wins"     value={fmt(wins)}             valueCompact={fmtCompact(wins)}            icon="👑" accent="text-emerald" />
        <Stat label="Win Rate" value={`${winRate}%`}         icon="📈" accent="text-sky" />
      </div>
    </div>
  );
}
