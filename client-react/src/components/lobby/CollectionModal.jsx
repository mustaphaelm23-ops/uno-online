import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Card from '../game/Card';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Card-back collection grid. Server-owned catalog (GET /api/collection)
// so the client just renders. Each tile shows a live Card preview using
// the cosmetic's palette, plus the state-appropriate action: Equip
// (owned) / Buy {cost} 🪙 (paid) / Progress bar (requirement-gated) /
// Equipped (current). The "Equipped" pill stays at the top of every
// rarity group regardless of sort order.

const RARITY = {
  common:    { label: 'Common',    tint: 'border-line text-ink-soft',          order: 0 },
  rare:      { label: 'Rare',      tint: 'border-sky/50 text-sky',             order: 1 },
  epic:      { label: 'Epic',      tint: 'border-violet/50 text-violet-soft',  order: 2 },
  legendary: { label: 'Legendary', tint: 'border-accent/60 text-accent shadow-glow-gold', order: 3 },
};

const fmt = (n) => Number(n || 0).toLocaleString();

function reqLabel(req) {
  if (!req) return null;
  if (req.kind === 'wins') return `Win ${req.value} matches`;
  if (req.kind === 'elo')  return `Reach ${req.value} rating`;
  return 'Locked';
}

function BackTile({ item, busy, onAction, idx }) {
  const r  = RARITY[item.rarity] || RARITY.common;
  const isEquipped = item.equipped;
  const isOwned    = item.owned;
  const isPaid     = !item.requires && item.cost > 0;
  const isGated    = !!item.requires;
  const pct = item.progress
    ? Math.max(0, Math.min(100, Math.round((item.progress.current / item.progress.target) * 100)))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.25, idx * 0.03) }}
      className={`rounded-2xl p-4 border bg-bg-3/40 ${r.tint.split(' ').filter(c => c.startsWith('border-')).join(' ')}
                  ${isEquipped ? 'ring-2 ring-accent shadow-glow-gold' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-sm leading-tight">{item.name}</div>
          <div className={`text-[10px] uppercase tracking-widest mt-0.5
            ${r.tint.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
            {r.label}
          </div>
        </div>
        {isEquipped && (
          <span className="chip bg-accent text-bg">EQUIPPED</span>
        )}
      </div>

      <div className="flex justify-center my-4">
        <Card size="lg" face={false} back={item} />
      </div>

      <div className="text-[11px] text-ink-soft text-center min-h-[28px] leading-snug">{item.desc}</div>

      {isGated && !isOwned && (
        <div className="mt-2">
          <div className="text-[10px] text-ink-faint mb-1 flex justify-between">
            <span>{reqLabel(item.requires)}</span>
            <span>{fmt(item.progress.current)}/{fmt(item.progress.target)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
            <div className="h-full bg-violet/60 transition-all"
                 style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onAction(item)}
        disabled={busy || (isEquipped) || (isGated && !isOwned && !item.progress.met)}
        className={`mt-3 w-full py-1.5 rounded-lg text-xs font-bold transition
          ${isEquipped         ? 'bg-emerald/15 text-emerald cursor-default' :
            isOwned            ? 'bg-violet text-white hover:brightness-110' :
            isPaid             ? 'bg-accent text-bg hover:brightness-110' :
            isGated && item.progress.met ? 'bg-emerald text-bg hover:brightness-110' :
                                 'bg-bg-2 text-ink-faint cursor-not-allowed'}`}
      >
        {isEquipped ? '✓ Equipped' :
         isOwned    ? 'Equip' :
         isPaid     ? `Buy — 🪙 ${fmt(item.cost)}` :
         item.progress.met ? 'Unlock' :
                             `${pct}%`}
      </button>
    </motion.div>
  );
}

export default function CollectionModal({ open, onClose }) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setData(await api.get('/api/collection')); }
    catch (err) { toast.error(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  const handle = async (item) => {
    setBusy(true);
    try {
      if (item.owned) {
        await api.post('/api/collection/equip', { id: item.id });
        toast.success(`Equipped ${item.name}`);
      } else {
        await api.post('/api/collection/unlock', { id: item.id });
        toast.success(`Unlocked ${item.name}!`);
      }
      await refresh();
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  // Sort: equipped first, then owned, then unlockable (req met), then by rarity asc.
  const sorted = (data?.items || []).slice().sort((a, b) => {
    const rank = (x) => x.equipped ? 0 : x.owned ? 1 : x.progress?.met ? 2 : 3;
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (RARITY[a.rarity]?.order || 0) - (RARITY[b.rarity]?.order || 0);
  });

  const owned = (data?.items || []).filter(i => i.owned).length;
  const total = (data?.items || []).length;

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Collection" width="xl">
      {loading || !data ? (
        <div className="text-ink-soft py-10 text-center animate-pulse">Loading collection…</div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-2/60 border border-line">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint">Card backs</div>
              <div className="font-display text-2xl tracking-wider text-accent">{owned} / {total}</div>
            </div>
            <div className="flex-1 mx-6">
              <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet to-accent transition-all duration-500"
                     style={{ width: `${Math.round((owned / total) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto pr-1">
            {sorted.map((item, i) => (
              <BackTile key={item.id} item={item} busy={busy} onAction={handle} idx={i} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
