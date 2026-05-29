import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import { shopApi } from '../../api/shop';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

// Shop modal. Three tabs:
//   1. Packages  — 5 IAP packages; PURCHASE buttons; demo-mode banner if set
//   2. Offer     — current special offer (if any) with one-time CLAIM
//   3. Convert   — diamond → coin converter with confirm step
//
// All purchases / claims / conversions refresh the user object on the
// AuthContext so the TopBar currency chips update without a page reload.

const fmt = (n) => Number(n || 0).toLocaleString();
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

// Package accent palette — Starter → Ultimate (cool → hot)
const PKG_ACCENT = {
  starter:  { from: 'from-sky/30',     to: 'to-sky/5',     ring: 'ring-sky/40',     text: 'text-sky' },
  value:    { from: 'from-emerald/30', to: 'to-emerald/5', ring: 'ring-emerald/40', text: 'text-emerald' },
  premium:  { from: 'from-violet/30',  to: 'to-violet/5',  ring: 'ring-violet/40',  text: 'text-violet-soft' },
  mega:     { from: 'from-orange-500/30', to: 'to-orange-500/5', ring: 'ring-orange-500/40', text: 'text-orange-400' },
  ultimate: { from: 'from-accent/30',  to: 'to-accent/5',  ring: 'ring-accent/40',  text: 'text-accent' },
};

function PackageCard({ pkg, busy, onBuy }) {
  const a = PKG_ACCENT[pkg.id] || PKG_ACCENT.starter;
  const bonus = pkg.bonus_pct > 0 ? `+${pkg.bonus_pct}% BONUS` : null;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`relative rounded-2xl p-4 border border-line bg-gradient-to-br ${a.from} ${a.to}
                  hover:ring-1 ${a.ring} transition`}
    >
      {bonus && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 chip bg-rose text-white shadow-card">
          {bonus}
        </span>
      )}
      <div className={`text-center font-display text-xl tracking-wider ${a.text} mb-2`}>
        {pkg.label.toUpperCase()}
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-center mb-3">
        <div className="flex items-center justify-center gap-1.5">
          🪙 <span className="font-extrabold">{fmt(pkg.coins)}</span>
          <span className="text-ink-soft text-xs">coins</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          💎 <span className="font-extrabold">{fmt(pkg.diamonds)}</span>
          <span className="text-ink-soft text-xs">diamonds</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onBuy(pkg)}
        disabled={busy}
        className="btn-primary w-full disabled:opacity-50 text-[12px] tracking-wider"
      >{busy ? '…' : `BUY — ${usd(pkg.usd_cents)}`}</button>
    </motion.div>
  );
}

function PackagesTab({ refreshUser }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    shopApi.packages()
      .then(setData)
      .catch((e) => toast.error(e.message || 'Failed to load packages'));
  }, [toast]);

  const buy = async (pkg) => {
    if (!confirm(`Confirm purchase: ${pkg.label} for ${usd(pkg.usd_cents)}?`)) return;
    setBusyId(pkg.id);
    try {
      const res = await shopApi.purchase(pkg.id);
      toast.success(`Got +${fmt(res.package.coins)} 🪙 and +${fmt(res.package.diamonds)} 💎`);
      refreshUser();
    } catch (err) {
      toast.error(err.message || 'Purchase failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!data) return <div className="text-ink-soft py-8 text-center animate-pulse">Loading packages…</div>;

  return (
    <div>
      {data.demo_mode && (
        <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-xs font-bold uppercase tracking-widest text-center">
          Demo mode — no real money charged
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.packages.map((p) => (
          <PackageCard key={p.id} pkg={p} busy={busyId === p.id} onBuy={buy} />
        ))}
      </div>
    </div>
  );
}

function OfferTab({ refreshUser }) {
  const toast = useToast();
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    shopApi.currentOffer()
      .then(setOffer)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const claim = async () => {
    if (busy || !offer?.offer) return;
    setBusy(true);
    try {
      const res = await shopApi.claimOffer(offer.offer.id);
      toast.success(`Claimed! +${fmt(res.offer.coins)} 🪙, +${fmt(res.offer.diamonds)} 💎`);
      refreshUser();
      setOffer({ ...offer, alreadyClaimed: true });
    } catch (err) {
      toast.error(err.message || 'Claim failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-ink-soft py-8 text-center animate-pulse">Checking…</div>;
  if (!offer?.offer) {
    return <div className="text-ink-faint py-8 text-center text-sm">No active offer right now. Check back later.</div>;
  }

  const o = offer.offer;
  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-violet/25 via-violet/5 to-bg-2 border border-violet/40">
      {o.badge && <div className="chip bg-rose text-white inline-flex mb-3">{o.badge}</div>}
      <div className="text-[11px] uppercase tracking-[0.3em] text-ink-faint">{o.title}</div>
      <div className="font-display text-3xl tracking-wider text-accent mt-1 mb-3">{o.headline}</div>
      {o.sub && <p className="text-sm text-ink-soft mb-4">{o.sub}</p>}
      <div className="flex items-center gap-6 mb-5">
        <div className="flex items-center gap-1.5">🪙 <span className="font-extrabold text-lg">{fmt(o.coins)}</span></div>
        <div className="flex items-center gap-1.5">💎 <span className="font-extrabold text-lg">{fmt(o.diamonds)}</span></div>
      </div>
      <button
        type="button"
        onClick={claim}
        disabled={offer.alreadyClaimed || busy}
        className="btn-primary w-full text-[12px] tracking-wider disabled:opacity-50"
      >{offer.alreadyClaimed ? '✓ ALREADY CLAIMED' : busy ? 'CLAIMING…' : 'CLAIM OFFER'}</button>
    </div>
  );
}

function ConvertTab({ user, refreshUser }) {
  const toast = useToast();
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const rate = 100;                                       // backend constant
  const have = user?.diamonds || 0;
  const coinsGained = useMemo(() => amount * rate, [amount]);
  const canConvert  = amount > 0 && amount <= have;

  const convert = async () => {
    if (!canConvert || busy) return;
    if (!confirm(`Convert ${amount} 💎 → ${fmt(coinsGained)} 🪙?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await shopApi.convertDiamonds(amount);
      toast.success(`Converted ${amount} 💎 to ${fmt(coinsGained)} 🪙`);
      refreshUser();
      setAmount(1);
    } catch (err) {
      toast.error(err.message || 'Convert failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4 bg-bg-2/60 border border-line text-sm flex items-center justify-between">
        <span className="text-ink-soft">You have</span>
        <span className="font-extrabold flex items-center gap-1">💎 {fmt(have)}</span>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-ink-faint mb-2">
          Convert <span className="text-violet-soft">{amount}</span> 💎 → <span className="text-accent">{fmt(coinsGained)}</span> 🪙
        </label>
        <input
          type="range"
          min={1}
          max={Math.max(1, have)}
          value={Math.min(amount, Math.max(1, have))}
          onChange={(e) => setAmount(parseInt(e.target.value, 10))}
          className="w-full accent-violet"
          disabled={have < 1}
        />
        <div className="flex justify-between text-[10px] text-ink-faint mt-1 uppercase tracking-widest">
          <span>1 💎</span>
          <span>Rate: 1 💎 = {rate} 🪙</span>
          <span>{Math.max(1, have)} 💎</span>
        </div>
      </div>
      <button
        type="button"
        onClick={convert}
        disabled={!canConvert || busy}
        className="btn-primary w-full text-[12px] tracking-wider disabled:opacity-50"
      >
        {busy ? '…' : `CONVERT ${amount} 💎 → ${fmt(coinsGained)} 🪙`}
      </button>
      <p className="text-xs text-ink-faint text-center">Conversion is irreversible.</p>
    </div>
  );
}

const TABS = [
  { id: 'packages', label: 'Packages', icon: '💰' },
  { id: 'offer',    label: 'Offer',    icon: '🎁' },
  { id: 'convert',  label: 'Convert',  icon: '🔁' },
];

export default function ShopModal({ open, onClose, initialTab = 'packages' }) {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  return (
    <Modal open={open} onClose={onClose} title="Shop" width="xl">
      <div className="flex flex-col gap-5">
        <div className="flex gap-1 p-1 bg-bg/60 rounded-xl border border-line self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-extrabold tracking-wider uppercase transition
                ${tab === t.id ? 'bg-violet text-white shadow-glow'
                              : 'text-ink-soft hover:text-ink'}`}
            >{t.icon} {t.label}</button>
          ))}
        </div>
        {tab === 'packages' && <PackagesTab refreshUser={refreshUser} />}
        {tab === 'offer'    && <OfferTab    refreshUser={refreshUser} />}
        {tab === 'convert'  && <ConvertTab user={user} refreshUser={refreshUser} />}
      </div>
    </Modal>
  );
}
