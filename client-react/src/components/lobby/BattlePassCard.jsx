// Battle Pass widget. Reads from user.bp directly — the server already
// surfaces { xp, premium, claimed[] } via sanitizeUser on /api/auth/me.
// Level + per-tier progress are derived client-side using the season's
// xp-per-tier constant (matches server BP_SEASON.xpPerTier). The View
// Rewards CTA hands off to the BP modal which fetches the authoritative
// season payload.

const XP_PER_TIER = 1000;
const MAX_TIERS   = 20;
const NEAR_TIER_THRESHOLD = 100;        // XP within next tier to trigger the "almost there" glow

export default function BattlePassCard({ user, onView }) {
  const bp        = user?.bp || {};
  const xp        = Number(bp.xp || 0);
  const level     = Math.min(MAX_TIERS, Math.floor(xp / XP_PER_TIER));
  const into      = xp % XP_PER_TIER;
  const remaining = XP_PER_TIER - into;
  const isPremium = !!bp.premium;
  const isNear    = level < MAX_TIERS && remaining <= NEAR_TIER_THRESHOLD;
  const pct       = Math.max(0, Math.min(100, Math.round((into / XP_PER_TIER) * 100)));

  return (
    <div className={`panel-card p-4 sm:p-5 relative overflow-hidden transition
      ${isNear ? 'border-accent/50 shadow-glow-gold' : ''}`}>
      {/* Decorative card cluster + level pill + scattered coins, top-right.
          Mirrors the mockup's tilted card stack with stacked coins beneath
          and a circular level pill. */}
      <div className="absolute right-2 top-2 select-none pointer-events-none">
        <div className="relative w-28 h-16">
          {/* Card stack */}
          <div className="absolute right-8 top-1 w-8 h-11 rounded-md rotate-[-14deg]
                          bg-gradient-to-br from-emerald to-emerald/60 border border-white/20 shadow-card-lg
                          grid place-items-center text-[11px] font-display text-white">8</div>
          <div className="absolute right-2 top-0 w-8 h-11 rounded-md rotate-[6deg]
                          bg-gradient-to-br from-rose to-rose/60 border border-white/20 shadow-card-lg
                          grid place-items-center text-[11px] font-display text-white">6</div>
          {/* Center face card — black "UNO" face */}
          <div className="absolute right-12 top-2 w-9 h-12 rounded-md rotate-[-2deg]
                          bg-gradient-to-br from-bg-3 to-bg border border-white/20 shadow-card-lg
                          grid place-items-center font-display text-[9px] text-accent">UNO</div>
          {/* Scattered coins beneath */}
          <span className="absolute right-3 -bottom-1 text-[10px]">🪙</span>
          <span className="absolute right-10 -bottom-2 text-[10px] rotate-[20deg]">🪙</span>
          {/* Level pill — bottom-right */}
          <div className="absolute -bottom-1 right-0 w-6 h-6 rounded-full grid place-items-center text-[10px] font-extrabold tabular-nums
                          bg-gradient-to-br from-accent to-accent-deep text-bg border-2 border-bg shadow-card">
            {level}
          </div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Season 1</div>
      <h3 className="font-display text-2xl tracking-wider text-accent mt-0.5 flex items-center gap-2 flex-wrap">
        BATTLE PASS
        {isPremium && (
          <span className="chip bg-gradient-to-br from-violet to-violet-deep text-white text-[9px] shadow-glow">👑 PREMIUM</span>
        )}
      </h3>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-1.5 text-xs text-ink-soft">
          <span className="flex items-center gap-1 tabular-nums">
            ⭐ <span className="font-bold text-ink">{into.toLocaleString()}</span>
            <span className="text-ink-faint">/{XP_PER_TIER.toLocaleString()}</span>
          </span>
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">XP TO LV {level + 1}</span>
        </div>
        <div className="h-2 rounded-full bg-bg-3 overflow-hidden relative">
          <div
            className={`h-full bg-gradient-to-r from-accent to-accent-soft transition-all duration-500
              ${isNear ? 'shadow-[0_0_12px_rgba(245,158,11,0.6)]' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isNear && (
          <div className="text-[10px] text-accent font-extrabold tracking-wider uppercase mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {remaining} XP to LV {level + 1}
          </div>
        )}
      </div>

      <button type="button" onClick={onView} className="btn-ghost w-full mt-4 text-[11px] tracking-wider">
        VIEW REWARDS
      </button>
    </div>
  );
}
