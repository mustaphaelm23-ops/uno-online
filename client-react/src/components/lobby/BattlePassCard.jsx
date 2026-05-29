// Battle Pass widget. Reads from user.bp directly — the server already
// surfaces { xp, premium, claimed[] } via sanitizeUser on /api/auth/me.
// Level + per-tier progress are derived client-side using the season's
// xp-per-tier constant (matches server BP_SEASON.xpPerTier). The View
// Rewards CTA hands off to the BP modal which fetches the authoritative
// season payload.

const XP_PER_TIER = 1000;
const MAX_TIERS   = 20;

export default function BattlePassCard({ user, onView }) {
  const bp        = user?.bp || {};
  const xp        = Number(bp.xp || 0);
  const level     = Math.min(MAX_TIERS, Math.floor(xp / XP_PER_TIER));
  // Progress within the current tier (e.g. 750/1000 for tier 12).
  const into      = xp % XP_PER_TIER;
  const isPremium = !!bp.premium;
  const pct       = Math.max(0, Math.min(100, Math.round((into / XP_PER_TIER) * 100)));

  return (
    <div className="panel-card p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 text-7xl opacity-10 rotate-12 select-none pointer-events-none">🎴</div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Season 1</div>
      <h3 className="font-display text-2xl tracking-wider text-accent mt-0.5 flex items-center gap-2">
        BATTLE PASS
        {isPremium && (
          <span className="chip bg-gradient-to-br from-violet to-violet-deep text-white text-[9px] shadow-glow">👑 PREMIUM</span>
        )}
      </h3>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-1.5 text-xs text-ink-soft">
          <span className="flex items-center gap-1">
            ⭐ <span className="font-bold text-ink">{into.toLocaleString()}</span>
            /{XP_PER_TIER.toLocaleString()}
          </span>
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
