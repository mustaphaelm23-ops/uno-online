import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { bpApi } from '../../api/battlepass';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Battle Pass rewards browser. Header shows season + level + XP bar +
// premium status; main body is a horizontally-scrolling tier rail where
// each tier card has a Free row and a Premium row. Claim is gated by:
//   • the tier being reached (level >= tier)
//   • not already claimed (key = `${tier}:${track}` in bp.claimed)
//   • for premium row: bp.premium === true (otherwise an unlock CTA shows
//     at the top of the modal instead)

const fmt = (n) => Number(n || 0).toLocaleString();

function RewardChip({ reward, claimable, claimed, locked, onClaim, label }) {
  if (!reward) return <div className="h-12" />;
  const icon = reward.type === 'diamonds' ? '💎' : '🪙';
  const color = reward.type === 'diamonds' ? 'text-sky' : 'text-accent';
  return (
    <button
      type="button"
      onClick={claimable ? onClaim : undefined}
      disabled={!claimable || locked}
      className={`w-full px-2.5 py-2 rounded-lg flex items-center gap-1.5 text-xs font-bold border transition
        ${claimed ? 'bg-emerald/15 border-emerald/40 text-emerald cursor-default' :
          claimable ? 'bg-accent/15 border-accent/50 text-accent hover:bg-accent/25' :
          'bg-bg-3/50 border-line text-ink-faint cursor-not-allowed'}`}
      title={locked ? 'Premium pass required' : claimable ? 'Claim' : claimed ? 'Claimed' : 'Not unlocked'}
    >
      <span className={color}>{icon}</span>
      <span className="flex-1 text-left">+{fmt(reward.amount)}</span>
      {claimed ? <span>✓</span> : locked ? <span>🔒</span> : null}
    </button>
  );
}

function TierCard({ tier, idx, level, claimed, premium, onClaim }) {
  const isReached = level >= idx;
  const isCurrent = level === idx - 1;
  const freeKey   = `${idx}:free`;
  const premKey   = `${idx}:prem`;
  const freeClaimed = claimed.includes(freeKey);
  const premClaimed = claimed.includes(premKey);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.015 }}
      className={`shrink-0 w-32 rounded-xl border p-2.5 flex flex-col gap-2
                  ${isCurrent ? 'border-accent shadow-glow-gold' :
                    isReached ? 'border-violet/40 bg-bg-3/40' :
                                'border-line bg-bg-2/40 opacity-80'}`}
    >
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-ink-faint">Tier</div>
        <div className={`font-display text-2xl tracking-wider ${isReached ? 'text-accent' : 'text-ink-soft'}`}>
          {idx}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-widest text-ink-faint text-center">Free</div>
        <RewardChip
          reward={tier.free}
          claimable={isReached && !freeClaimed}
          claimed={freeClaimed}
          onClaim={() => onClaim(idx, 'free')}
        />
        <div className="text-[9px] uppercase tracking-widest text-violet-soft text-center mt-2">Premium</div>
        <RewardChip
          reward={tier.prem}
          claimable={isReached && premium && !premClaimed}
          claimed={premClaimed}
          locked={!premium}
          onClaim={() => onClaim(idx, 'prem')}
        />
      </div>
    </motion.div>
  );
}

export default function BattlePassModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData(null);
    bpApi.get()
      .then(setData)
      .catch((e) => toast.error(e.message || 'Failed to load BP'));
  }, [open, toast]);

  const refresh = async () => {
    try { setData(await bpApi.get()); } catch { /* keep stale */ }
  };

  const claim = async (tier, track) => {
    setBusy(true);
    try {
      const res = await bpApi.claim(tier, track);
      const g = res.granted || {};
      const bits = [];
      if (g.coins)    bits.push(`+${fmt(g.coins)} 🪙${g.multiplied ? ' (2x)' : ''}`);
      if (g.diamonds) bits.push(`+${fmt(g.diamonds)} 💎`);
      toast.success(`Tier ${tier} ${track === 'prem' ? 'premium' : 'free'} — ${bits.join(', ')}`);
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  const unlockCoins = async () => {
    if (!confirm(`Unlock premium pass for ${fmt(data?.premiumPrice || 0)} 🪙?`)) return;
    setBusy(true);
    try {
      await bpApi.unlock();
      toast.success('Premium unlocked!');
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const unlockDiamonds = async () => {
    if (!confirm('Unlock premium pass for 200 💎?')) return;
    setBusy(true);
    try {
      await bpApi.unlockDiamonds();
      toast.success('Premium unlocked!');
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!confirm('Skip 10 tiers for 50 💎?')) return;
    setBusy(true);
    try {
      const res = await bpApi.skip();
      toast.success(`Skipped from tier ${res.jumped.from} to ${res.jumped.to}`);
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Skip failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Battle Pass" width="xl">
      {!data ? (
        <div className="text-ink-soft py-8 text-center animate-pulse">Loading season…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Season {data.season}</div>
              <div className="font-display text-3xl tracking-wider text-accent leading-tight">{data.name}</div>
              <div className="mt-3 flex items-center gap-3">
                <span className="chip bg-bg-3 border border-line">⭐ Lv {data.level}</span>
                {data.premium ? (
                  <span className="chip bg-gradient-to-br from-violet to-violet-deep text-white shadow-glow">👑 Premium</span>
                ) : (
                  <span className="chip bg-bg-3 border border-line text-ink-faint">Free Track</span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-[11px] text-ink-soft mb-1 flex justify-between">
                  <span>{fmt(data.xp)} XP</span>
                  <span className="text-ink-faint">{fmt(data.xpPerTier)} per tier</span>
                </div>
                <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent-soft transition-all duration-500"
                    style={{ width: `${Math.min(100, ((data.xp % data.xpPerTier) / data.xpPerTier) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {!data.premium && (
                <>
                  <button type="button" onClick={unlockCoins} disabled={busy}
                          className="btn-primary text-xs px-4 disabled:opacity-50">
                    Unlock 🪙 {fmt(data.premiumPrice)}
                  </button>
                  <button type="button" onClick={unlockDiamonds} disabled={busy}
                          className="btn-violet text-xs px-4 disabled:opacity-50">
                    Unlock 💎 200
                  </button>
                </>
              )}
              <button type="button" onClick={skip} disabled={busy}
                      className="btn-ghost text-xs px-4 disabled:opacity-50">
                Skip 10 tiers — 💎 50
              </button>
            </div>
          </div>

          {/* Tier rail */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-faint mb-2">Rewards Track</div>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
              {data.tiers.map((t, i) => (
                <TierCard
                  key={i}
                  tier={t}
                  idx={i + 1}
                  level={data.level}
                  claimed={data.claimed}
                  premium={data.premium}
                  onClaim={claim}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
