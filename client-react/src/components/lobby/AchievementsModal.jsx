import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Achievements grid. Server-owned catalog (GET /api/achievements) means
// the client just renders. Cards sort: claimable first (complete &&
// !claimed — the actionable ones), then earned (complete && claimed),
// then locked sorted by progress percentage descending so the player
// sees their closest goals.

const fmt = (n) => Number(n || 0).toLocaleString();

function AchievementCard({ a, busy, onClaim, idx }) {
  const pct = Math.max(0, Math.min(100, Math.round((a.current / a.target) * 100)));
  const claimable = a.complete && !a.claimed;
  const earned    = a.complete && a.claimed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.25, idx * 0.025) }}
      className={`relative rounded-2xl p-4 border transition
        ${claimable ? 'bg-gradient-to-br from-accent/20 to-accent/0 border-accent/50 shadow-glow-gold'
                    : earned    ? 'bg-gradient-to-br from-emerald/15 to-emerald/0 border-emerald/40'
                                : 'bg-bg-3/40 border-line'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 grid place-items-center rounded-xl text-2xl shrink-0
          ${earned ? 'bg-emerald/15 border border-emerald/30' :
            claimable ? 'bg-accent/15 border border-accent/40' :
                        'bg-bg-2/60 border border-line'}`}>
          {a.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight truncate">{a.name}</div>
          <div className="text-[11px] text-ink-soft mt-0.5">{a.desc}</div>
        </div>
        {earned && (
          <span className="absolute top-2 right-2 chip bg-emerald/20 border border-emerald/50 text-emerald">✓ EARNED</span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-faint mb-1">
          <span>{fmt(a.current)} / {fmt(a.target)}</span>
          <span className="text-accent">🪙 +{fmt(a.reward)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500
              ${earned ? 'bg-emerald' :
                claimable ? 'bg-gradient-to-r from-accent to-accent-soft' :
                            'bg-violet/60'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onClaim(a.id)}
        disabled={!claimable || busy}
        className={`mt-3 w-full py-1.5 rounded-lg text-xs font-bold transition
          ${earned ? 'bg-emerald/15 text-emerald cursor-default' :
            claimable ? 'bg-accent text-bg hover:brightness-110' :
            'bg-bg-2 text-ink-faint cursor-not-allowed'}`}
      >
        {earned ? '✓ Claimed' : claimable ? 'Claim Reward' : `${pct}%`}
      </button>
    </motion.div>
  );
}

export default function AchievementsModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setData(await api.get('/api/achievements')); }
    catch (err) { toast.error(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  const claim = async (id) => {
    setBusy(true);
    try {
      const res = await api.post('/api/achievements/claim', { id });
      toast.success(`+${fmt(res.reward)} 🪙`);
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  // Sort: claimable (urgent) → earned → locked-by-progress-desc.
  const sorted = useMemo(() => {
    if (!data?.achievements) return [];
    return [...data.achievements].sort((a, b) => {
      const rank = (x) => x.complete && !x.claimed ? 0 : x.claimed ? 1 : 2;
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      // Within locked group, show closest-to-complete first.
      if (ra === 2) return (b.current / b.target) - (a.current / a.target);
      return 0;
    });
  }, [data]);

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Achievements" width="xl">
      {loading || !data ? (
        <div className="text-ink-soft py-10 text-center animate-pulse">Loading trophies…</div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-2/60 border border-line">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Trophy case</div>
              <div className="font-display text-2xl tracking-wider text-accent">
                {data.earned} / {data.total}
              </div>
            </div>
            <div className="flex-1 mx-6">
              <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald to-accent transition-all duration-500"
                  style={{ width: `${Math.round((data.earned / data.total) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-ink-faint mt-1 text-right">
                {Math.round((data.earned / data.total) * 100)}% complete
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[65vh] overflow-y-auto pr-1">
            {sorted.map((a, i) => (
              <AchievementCard key={a.id} a={a} busy={busy} onClaim={claim} idx={i} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
