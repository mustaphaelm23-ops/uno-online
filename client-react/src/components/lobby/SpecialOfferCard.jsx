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

const URGENT_MS = 60 * 60 * 1000;       // under 1h → rose glow + pulsing dot

export default function SpecialOfferCard({ offer, onClaim }) {
  // Default placeholder values so the card renders even when no offer is
  // active — the backend's offers endpoint usually returns null in that
  // case. Replace with offer fields once a real offer is in flight.
  const title    = offer?.title    || 'Special Offer!';
  const subtitle = offer?.subtitle || 'Get 2,000 coins + exclusive card back';
  const endsAt   = offer?.endsAt   || (Date.now() + 23 * 3600_000 + 59 * 60_000);
  const { left, h, m, s } = useCountdown(endsAt);
  const urgent = left > 0 && left <= URGENT_MS;

  return (
    <div className={`panel-card relative overflow-hidden p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition
                    ${urgent
                      ? 'border-rose/50 bg-gradient-to-br from-rose/20 via-rose/5 to-bg-2 shadow-[0_8px_24px_rgba(244,63,94,0.3)]'
                      : 'border-violet/30 bg-gradient-to-br from-violet/20 via-violet/5 to-bg-2'}`}>
      {/* Card-back thumbnail + scattered coins — matches the mockup's
          "EXCLUSIVE CARD BACK" hero artwork on the right edge. */}
      <div className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 select-none pointer-events-none">
        <div className="relative w-14 sm:w-16 h-14 sm:h-16">
          {/* Stacked coins behind the card */}
          <span className="absolute left-0 bottom-1 text-sm sm:text-base">🪙</span>
          <span className="absolute left-3 -bottom-0 text-xs sm:text-sm rotate-[15deg]">🪙</span>
          {/* Card-back thumbnail */}
          <div className="absolute right-0 bottom-0 w-10 sm:w-12 h-14 sm:h-16 rounded-md rotate-[10deg] overflow-hidden border border-white/25 shadow-card-lg
                          bg-gradient-to-br from-rose to-rose/70">
            <div className="absolute inset-0 grid place-items-center font-display text-amber-300 text-base sm:text-lg -rotate-12 drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]">UNO</div>
            <div className="absolute inset-1 rounded border border-white/20 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="text-3xl sm:text-4xl shrink-0">🎁</div>
      <div className="flex-1 min-w-0 pr-12 sm:pr-14">
        <div className={`font-display text-base sm:text-xl tracking-wider truncate
                        ${urgent ? 'text-rose' : 'text-accent'}`}>
          {title}
        </div>
        <div className="text-[11px] sm:text-xs text-ink-soft truncate">{subtitle}</div>
        <div className={`text-[10px] uppercase tracking-widest mt-1 flex items-center gap-1 tabular-nums
                        ${urgent ? 'text-rose font-extrabold' : 'text-ink-faint'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${urgent ? 'bg-rose animate-pulse' : 'bg-ink-faint'}`} />
          {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
        </div>
      </div>
      <button
        type="button"
        className={`relative z-10 text-[11px] tracking-wider px-3 sm:px-4 py-2 rounded-xl font-extrabold transition shrink-0
                    ${urgent
                      ? 'bg-gradient-to-br from-rose to-rose text-white shadow-[0_8px_24px_rgba(244,63,94,0.4)] hover:brightness-110'
                      : 'bg-gradient-to-br from-accent to-accent-deep text-bg shadow-glow-gold hover:from-accent-soft hover:to-accent'}`}
        onClick={onClaim}
      >
        VIEW OFFER
      </button>
    </div>
  );
}
