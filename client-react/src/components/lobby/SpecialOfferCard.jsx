import { useEffect, useState } from 'react';

// Countdown helper: rerenders every second so the "23h 59m 12s" ticker
// stays live without a global timer.
function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, (endsAt || 0) - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return { left, h, m, s };
}

export default function SpecialOfferCard({ offer, onClaim }) {
  // Default placeholder values so the card renders even when no offer is
  // active — the backend's offers endpoint usually returns null in that
  // case. Replace with offer fields once a real offer is in flight.
  const title    = offer?.title    || 'Special Offer!';
  const subtitle = offer?.subtitle || 'Get 2,000 coins + exclusive card back';
  const endsAt   = offer?.endsAt   || (Date.now() + 23 * 3600_000 + 59 * 60_000);
  const { h, m, s } = useCountdown(endsAt);

  return (
    <div className="panel-card relative overflow-hidden p-4 sm:p-5 flex items-center gap-4
                    border-violet/30 bg-gradient-to-br from-violet/20 via-violet/5 to-bg-2">
      <div className="absolute -right-6 -bottom-6 text-7xl opacity-15 rotate-12 select-none pointer-events-none">🎴</div>
      <div className="text-4xl">🎁</div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-xl text-accent tracking-wider truncate">{title}</div>
        <div className="text-xs text-ink-soft truncate">{subtitle}</div>
        <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-1 flex items-center gap-1">
          <span>⏰</span>
          {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
        </div>
      </div>
      <button type="button" className="btn-primary text-[11px] tracking-wider px-4" onClick={onClaim}>
        VIEW OFFER
      </button>
    </div>
  );
}
