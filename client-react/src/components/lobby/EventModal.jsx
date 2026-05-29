import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Event missions modal. The backend currently exposes the active live
// event under GET /api/event with a {missions, announcements, ...}
// payload. We surface each mission with a progress bar + claim button.
// When no event is active, we show an empty state.

const fmt = (n) => Number(n || 0).toLocaleString();

function MissionRow({ m, busy, onClaim }) {
  const pct = Math.max(0, Math.min(100, Math.round((m.current / m.target) * 100)));
  const claimable = m.complete && !m.claimed;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition
        ${m.claimed ? 'bg-emerald/10 border-emerald/30' :
          claimable ? 'bg-accent/10 border-accent/40 shadow-glow-gold' :
                      'bg-bg-3/40 border-line'}`}
    >
      <div className={`w-10 h-10 grid place-items-center rounded-lg text-xl shrink-0 border
        ${m.claimed ? 'bg-emerald/15 border-emerald/30' :
          claimable ? 'bg-accent/15 border-accent/40' :
                      'bg-bg-2 border-line'}`}>
        {m.icon || '🎯'}
      </div>
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-[13px] sm:text-sm font-bold truncate">{m.name}</div>
        <div className="text-[10px] sm:text-[11px] text-ink-soft truncate mt-0.5">{m.desc}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-bg-3 overflow-hidden">
            <div
              className={`h-full transition-all ${m.complete ? 'bg-emerald' : 'bg-gradient-to-r from-accent to-accent-soft'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-ink-faint shrink-0">
            {fmt(m.current)}/{fmt(m.target)}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 leading-tight">
        <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-ink-faint">Reward</div>
        <div className="text-[13px] sm:text-sm font-extrabold text-accent tabular-nums">🪙 {fmt(m.reward)}</div>
        <button
          type="button"
          onClick={() => onClaim(m.id)}
          disabled={!claimable || busy}
          className={`mt-1 text-[10px] tracking-wider font-extrabold px-2 py-1 rounded-md transition
            ${m.claimed ? 'bg-emerald/15 text-emerald cursor-default' :
              claimable ? 'bg-accent text-bg hover:brightness-110' :
              'bg-bg-2 text-ink-faint cursor-not-allowed'}`}
        >
          {m.claimed ? '✓ CLAIMED' : claimable ? 'CLAIM' : 'LOCKED'}
        </button>
      </div>
    </motion.li>
  );
}

export default function EventModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setData(await api.get('/api/event')); }
    catch (err) { toast.error(err.message || 'Failed to load missions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  const claim = async (missionId) => {
    setBusy(true);
    try {
      const res = await api.post('/api/event/claim', { mission: missionId });
      toast.success(`+${fmt(res.reward)} 🪙`);
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Missions" width="lg">
      {loading || !data ? (
        <div className="text-ink-soft py-10 text-center animate-pulse">Loading…</div>
      ) : !data.active ? (
        <div className="text-ink-faint py-10 text-center text-sm">
          No active event right now. Check back later for time-boxed missions and rewards.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className="rounded-2xl p-5 border border-line"
            style={{
              background: `linear-gradient(135deg, ${data.color || '#7c3aed'}33, transparent 70%), linear-gradient(180deg, #13183a, #0a0e27)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl">{data.icon || '🎉'}</div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Active event</div>
                <div className="font-display text-2xl tracking-wider text-accent leading-tight">{data.name}</div>
                {data.tagline && <div className="text-sm text-ink-soft mt-0.5">{data.tagline}</div>}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-faint mb-2">Missions</div>
            <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {data.missions.map((m) => (
                <MissionRow key={m.id} m={m} busy={busy} onClaim={claim} />
              ))}
            </ul>
          </div>

          {data.announcements?.length > 0 && (
            <div className="rounded-xl p-3 bg-bg-3/40 border border-line">
              <div className="text-[10px] uppercase tracking-widest text-ink-faint mb-1">News</div>
              <ul className="text-xs text-ink-soft space-y-1">
                {data.announcements.map((a, i) => <li key={i}>· {a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
