import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import useOwnedEmotes from '../../hooks/useOwnedEmotes';

// Emotes catalog. Pure cosmetic — unlocking an emote adds it to the
// in-game ReactionsPanel grid (via useOwnedEmotes), giving players a
// broader expression palette beyond the always-free basic 12.

const RARITY = {
  common:    { label: 'Common',    border: 'border-line',           text: 'text-ink-soft',      order: 0 },
  rare:      { label: 'Rare',      border: 'border-sky/50',         text: 'text-sky',           order: 1 },
  epic:      { label: 'Epic',      border: 'border-violet/50',      text: 'text-violet-soft',   order: 2 },
  legendary: { label: 'Legendary', border: 'border-accent/60',      text: 'text-accent',        order: 3 },
};

const fmt = (n) => Number(n || 0).toLocaleString();

function reqLabel(req) {
  if (!req) return null;
  if (req.kind === 'wins')       return `Win ${req.value} matches`;
  if (req.kind === 'elo')        return `Reach ${req.value} rating`;
  if (req.kind === 'coins')      return `Hold ${fmt(req.value)} coins`;
  if (req.kind === 'level')      return `Reach level ${req.value}`;
  if (req.kind === 'bp_premium') return `Own the Battle Pass`;
  return 'Locked';
}

function EmoteTile({ item, busy, onUnlock, idx }) {
  const r = RARITY[item.rarity] || RARITY.common;
  const isOwned = item.owned;
  const isPaid  = !item.requires && item.cost > 0;
  const isGated = !!item.requires;
  const pct = item.progress
    ? Math.max(0, Math.min(100, Math.round((item.progress.current / item.progress.target) * 100)))
    : 0;
  const canUnlock = !isOwned && (isPaid ? true : (item.progress.met));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.2, idx * 0.025) }}
      className={`rounded-2xl p-4 border bg-bg-3/40 ${r.border}
                  ${isOwned ? 'ring-2 ring-emerald/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-sm leading-tight">{item.name}</div>
          <div className={`text-[10px] uppercase tracking-widest mt-0.5 ${r.text}`}>{r.label}</div>
        </div>
        {isOwned && <span className="chip bg-emerald/15 border border-emerald/50 text-emerald">OWNED</span>}
      </div>

      <div className="flex justify-center my-3 text-5xl">{item.emoji}</div>
      <div className="text-[11px] text-ink-soft text-center min-h-[28px] leading-snug">{item.desc}</div>

      {isGated && !isOwned && (
        <div className="mt-2">
          <div className="text-[10px] text-ink-faint mb-1 flex justify-between">
            <span>{reqLabel(item.requires)}</span>
            <span>{fmt(item.progress.current)}/{fmt(item.progress.target)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
            <div className="h-full bg-violet/60 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onUnlock(item)}
        disabled={busy || isOwned || !canUnlock}
        className={`mt-3 w-full py-1.5 rounded-lg text-[11px] font-extrabold tracking-wider transition
          ${isOwned ? 'bg-emerald/15 text-emerald cursor-default' :
            isPaid  ? 'bg-accent text-bg hover:brightness-110' :
            canUnlock ? 'bg-emerald text-bg hover:brightness-110' :
                        'bg-bg-2 text-ink-faint cursor-not-allowed'}`}
      >
        {isOwned ? '✓ OWNED' :
         isPaid  ? `BUY — 🪙 ${fmt(item.cost)}` :
         canUnlock ? 'UNLOCK' :
                     `${pct}%`}
      </button>
    </motion.div>
  );
}

export default function EmotesModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const { refresh: refreshOwned } = useOwnedEmotes();
  const [data, setData]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setData(await api.get('/api/emotes')); }
    catch (err) { toast.error(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  const unlock = async (item) => {
    setBusy(true);
    try {
      await api.post('/api/emotes/unlock', { id: item.id });
      toast.success(`Unlocked ${item.name} ${item.emoji}`);
      await refresh();
      refreshOwned();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const sorted = (data?.items || []).slice().sort((a, b) => {
    const rank = (x) => x.owned ? 0 : (x.progress?.met || (!x.requires)) ? 1 : 2;
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (RARITY[a.rarity]?.order || 0) - (RARITY[b.rarity]?.order || 0);
  });

  const owned = (data?.items || []).filter(i => i.owned).length;
  const total = (data?.items || []).length;

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Emotes" width="xl">
      {loading || !data ? (
        <div className="text-ink-soft py-10 text-center animate-pulse">Loading emotes…</div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-2/60 border border-line">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Extra reactions</div>
              <div className="font-display text-2xl tracking-wider text-accent">{owned} / {total}</div>
              <div className="text-[10px] text-ink-faint mt-0.5">12 free basic reactions always available</div>
            </div>
            <div className="flex-1 mx-6">
              <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet to-accent transition-all duration-500"
                     style={{ width: `${total ? Math.round((owned / total) * 100) : 0}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[65vh] overflow-y-auto pr-1">
            {sorted.map((item, i) => (
              <EmoteTile key={item.id} item={item} busy={busy} onUnlock={unlock} idx={i} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
