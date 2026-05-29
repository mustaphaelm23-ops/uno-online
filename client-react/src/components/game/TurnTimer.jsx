import { useEffect, useState } from 'react';

// SVG ring countdown matching the mockup's "02:35" pill. We derive a
// per-second tick locally so the ring fills smoothly without relying on
// game:state pushes (server is still authoritative; this is just UI).
// When the turn changes, turnEndsAt changes and we re-anchor.

export default function TurnTimer({ endsAt, totalMs = 30_000, label }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) {
    return (
      <div className="chip bg-bg-2/80 border border-line text-ink-soft">⏱ {label || '—'}</div>
    );
  }

  const left = Math.max(0, endsAt - now);
  const pct  = Math.max(0, Math.min(1, left / totalMs));
  const r    = 16;
  const c    = 2 * Math.PI * r;
  const dash = `${(1 - pct) * c} ${c}`;
  const seconds = Math.ceil(left / 1000);
  const danger  = left < 8000;

  return (
    <div className="flex items-center gap-2 chip bg-bg-2/90 border border-line">
      <svg width="22" height="22" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} stroke="rgba(255,255,255,.1)" strokeWidth="4" fill="none" />
        <circle
          cx="20" cy="20" r={r}
          stroke={danger ? '#f43f5e' : '#f59e0b'}
          strokeWidth="4" fill="none"
          strokeDasharray={dash}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.2s' }}
        />
      </svg>
      <span className={`tabular-nums font-bold text-sm ${danger ? 'text-rose' : 'text-accent'}`}>
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </span>
    </div>
  );
}
