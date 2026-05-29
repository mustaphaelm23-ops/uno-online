import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Daily reward modal — 100 🪙 every 24h. Server tracks
// user.lastDailyClaimAt; we read it from the cached user object to know
// the cooldown without an extra round-trip. On 429 the response includes
// nextClaimAt so we can show the countdown even if the local cache is
// stale.

const DAY_MS = 86_400_000;
const REWARD = 100;

function useNow(everyMs = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [enabled, everyMs]);
  return now;
}

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DailyRewardModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [nextClaimAt, setNextClaimAt] = useState(null);

  // Initial cooldown comes from the cached user object; a 429 response
  // refines it (e.g. if we missed an earlier claim from another tab).
  useEffect(() => {
    if (!open) return;
    const last = user?.lastDailyClaimAt || 0;
    setNextClaimAt(last > 0 ? last + DAY_MS : 0);
  }, [open, user?.lastDailyClaimAt]);

  const now = useNow(1000, open);
  const remaining = Math.max(0, (nextClaimAt || 0) - now);
  const canClaim  = remaining === 0;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post('/api/coins/claim-daily');
      toast.success(`+${res.earned} 🪙 daily reward!`);
      await refreshUser();
      setNextClaimAt(Date.now() + DAY_MS);
    } catch (err) {
      if (err.status === 429 && err.data?.nextClaimAt) {
        setNextClaimAt(err.data.nextClaimAt);
        toast.info('Already claimed today');
      } else {
        toast.error(err.message || 'Claim failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Daily Reward" width="sm">
      <div className="flex flex-col items-center gap-4 sm:gap-5 py-3 sm:py-4">
        <motion.div
          initial={{ scale: 0.7, rotate: -10 }}
          animate={{ scale: 1,   rotate: 0   }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="text-6xl sm:text-7xl drop-shadow-[0_8px_20px_rgba(245,158,11,0.45)]"
        >🎁</motion.div>
        <div className="text-center">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-ink-faint">Today's bonus</div>
          <div className="font-display text-3xl sm:text-4xl tracking-wider text-accent flex items-center gap-2 justify-center mt-1 tabular-nums">
            🪙 {REWARD}
          </div>
        </div>
        {canClaim ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="btn-primary text-[12px] tracking-wider px-6 w-full disabled:opacity-50"
          >
            {busy ? 'CLAIMING…' : 'CLAIM NOW'}
          </button>
        ) : (
          <div className="w-full text-center">
            <div className="text-[9px] uppercase tracking-widest text-ink-faint mb-1">Next in</div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-3/60 border border-line">
              <span className="text-base">⏰</span>
              <span className="font-display text-xl tracking-wider tabular-nums text-ink">{fmtCountdown(remaining)}</span>
            </div>
          </div>
        )}
        <p className="text-[11px] sm:text-xs text-ink-faint text-center max-w-xs leading-snug">
          Come back every 24h for a free coin bonus.
        </p>
      </div>
    </Modal>
  );
}
