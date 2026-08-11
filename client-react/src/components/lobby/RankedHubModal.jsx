import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Ranked Hub — the missing piece. Until now "Ranked" routed straight to
// the bare leaderboard list, which is why the new Phase 1-4 server work
// (placement counter, RP, season, tier, streak, DC offenses, hub layout)
// had no surface area on the client. This modal renders the full ranked
// experience: hero card with tier/placement, season pill, stats row,
// optional DC warning, "Play Ranked" CTA, and the live top-20 list.

// Progressive ladder — must mirror server LEAGUES. Each tier wider than
// the last so promotions feel harder the higher you go. Grandmaster gap
// (3000 RP) is intentionally brutal: pros only.
const TIERS = [
  { min: 0,    name: 'Bronze',      badge: '🥉', color: '#CD7F32' },
  { min: 500,  name: 'Silver',      badge: '🥈', color: '#C0C0C0' },
  { min: 1300, name: 'Gold',        badge: '🥇', color: '#FFD700' },
  { min: 2400, name: 'Platinum',    badge: '💠', color: '#E5E4E2' },
  { min: 3900, name: 'Diamond',     badge: '💎', color: '#B9F2FF' },
  { min: 6000, name: 'Master',      badge: '👑', color: '#9F70FD' },
  { min: 9000, name: 'Grandmaster', badge: '🏆', color: '#FF6B6B' },
];
function tierForRP(rp) {
  return [...TIERS].reverse().find((t) => (rp || 0) >= t.min) || TIERS[0];
}
function nextTier(rp) {
  return TIERS.find((t) => t.min > (rp || 0));
}
function fmtCountdown(ms) {
  if (ms <= 0) return 'ending soon';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default function RankedHubModal({ open, onClose, onPlay }) {
  const { user }  = useAuth();
  const toast     = useToast();
  const [season, setSeason] = useState(null);
  const [lb, setLb]         = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get('/api/ranked/season').catch(() => null),
      api.get('/api/leaderboard/ranked').catch(() => null),
    ])
      .then(([s, l]) => { setSeason(s); setLb(l); })
      .catch((e) => toast.error(e.message || 'Failed to load ranked data'))
      .finally(() => setLoading(false));
  }, [open, toast]);

  const rp       = user?.rankPoints ?? 1000;
  const peak     = user?.peakRankPoints ?? rp;
  const placed   = user?.placementGamesPlayed ?? 0;
  const inPlace  = placed < 5;
  const wins     = user?.rankedWins ?? 0;
  const losses   = user?.rankedLosses ?? 0;
  const streak   = user?.winStreak ?? 0;
  const abandons = user?.rankedAbandonCount ?? 0;
  const tier     = useMemo(() => inPlace ? null : tierForRP(rp), [inPlace, rp]);
  const next     = useMemo(() => inPlace ? null : nextTier(rp), [inPlace, rp]);
  const pct      = next && tier ? Math.min(100, Math.max(0, Math.round((rp - tier.min) / (next.min - tier.min) * 100))) : 100;

  const endsIn = Math.max(0, (season?.endsAt || 0) - Date.now());

  const handlePlay = () => {
    onClose?.();
    onPlay?.();
  };

  return (
    <Modal open={open} onClose={onClose} title={inPlace ? `Ranked — Placement ${placed}/5` : `Ranked — ${tier?.name || ''}`} width="lg">
      <div className="flex flex-col gap-5">
        {/* Hero */}
        <div className="text-center pb-4 border-b border-line">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            className="text-6xl leading-none drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]"
            style={inPlace ? {} : { filter: `drop-shadow(0 0 30px ${tier.color}80)` }}
          >
            {inPlace ? '🎯' : tier.badge}
          </motion.div>
          <div className="mt-3 font-display text-2xl tracking-widest" style={inPlace ? { color: '#FBBF24' } : { color: tier.color }}>
            {inPlace ? 'PLACEMENT' : tier.name.toUpperCase()}
          </div>
          <div className="mt-1 text-xs text-ink-soft">
            {inPlace
              ? `Play ${5 - placed} more ranked match${5 - placed === 1 ? '' : 'es'} to earn your rank`
              : `${rp} RP · Peak ${peak}`}
          </div>

          {/* Progress */}
          <div className="mt-4">
            {inPlace ? (
              <>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-faint mb-1">
                  <span>Placement progress</span><span>{placed} / 5</span>
                </div>
                <div className="h-2.5 bg-line/40 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-rose"
                    initial={{ width: 0 }}
                    animate={{ width: `${placed * 20}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </>
            ) : next ? (
              <>
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-faint mb-1">
                  <span>{rp} RP</span><span>{next.badge} {next.name} at {next.min}</span>
                </div>
                <div className="h-2.5 bg-line/40 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full"
                    style={{ background: tier.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </>
            ) : (
              <div className="text-accent font-bold text-xs tracking-widest">⭐ TOP TIER REACHED ⭐</div>
            )}
          </div>
        </div>

        {/* Season pill */}
        {season && (
          <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl px-4 py-2.5">
            <div className="font-bold text-sm">Season {season.seasonId}</div>
            <div className="text-accent text-xs font-semibold">⏳ ends in {fmtCountdown(endsIn)}</div>
          </div>
        )}

        {/* DC warning */}
        {abandons > 0 && (
          <div className="bg-rose/10 border border-rose/40 rounded-xl px-4 py-2.5 text-xs text-rose-soft">
            ⚠️ Abandon offenses: <b>{abandons}</b> · Next abandon = {abandons >= 3 ? '6hr' : abandons === 2 ? '2hr' : '1hr'} ban + extra RP/ELO loss
          </div>
        )}

        {/* Stats row */}
        {!inPlace && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-bg-2/40 border border-line rounded-lg py-2.5">
              <div className="text-xl font-extrabold text-emerald-400 tabular-nums">{wins}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Wins</div>
            </div>
            <div className="bg-bg-2/40 border border-line rounded-lg py-2.5">
              <div className="text-xl font-extrabold text-rose tabular-nums">{losses}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Losses</div>
            </div>
            <div className="bg-bg-2/40 border border-line rounded-lg py-2.5">
              <div className="text-xl font-extrabold text-accent tabular-nums">{streak}🔥</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Streak</div>
            </div>
          </div>
        )}

        {/* Play */}
        <button
          type="button"
          onClick={handlePlay}
          className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-600 text-bg font-extrabold tracking-widest text-sm uppercase rounded-xl shadow-glow-gold hover:brightness-110 active:scale-[0.98] transition"
        >
          ⚔️ {inPlace ? `Play Placement (${5 - placed} left)` : 'Play Ranked'}
        </button>

        {/* Leaderboard */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="font-display text-base tracking-widest">🏆 TOP PLAYERS</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-faint">Season {season?.seasonId || 1}</div>
          </div>
          {loading ? (
            <div className="text-ink-soft py-6 text-center text-sm animate-pulse">Loading rankings…</div>
          ) : (lb?.leaderboard?.length || 0) === 0 ? (
            <div className="text-ink-faint py-6 text-center text-xs">No-one has finished placement yet — be the first!</div>
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {lb.leaderboard.map((row, i) => {
                const isMe = row.username === user?.username;
                const rowRP = row.rankPoints ?? row.elo ?? 1000;
                const tierLabel = row.label || row.league || '—';
                return (
                  <motion.li
                    key={`${row.rank}_${row.username}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.012 }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border ${isMe ? 'bg-violet/20 border-violet shadow-glow' : row.rank === 1 ? 'bg-gradient-to-r from-accent/15 to-transparent border-accent/40' : 'bg-bg-2/40 border-line'}`}
                  >
                    <div className={`w-7 h-7 rounded-full border grid place-items-center font-extrabold text-xs tabular-nums shrink-0 ${row.rank === 1 ? 'border-accent text-accent bg-accent/15' : row.rank === 2 ? 'border-ink-soft text-ink-soft bg-ink-soft/10' : row.rank === 3 ? 'border-orange-400 text-orange-400 bg-orange-400/15' : 'border-line text-ink-faint'}`}>
                      {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                    </div>
                    <Avatar src={row.avatar} name={row.username} size="sm" />
                    <div className="flex-1 min-w-0 leading-tight">
                      <div className="text-[13px] font-bold truncate flex items-center gap-2">
                        <span className="truncate">{row.username}</span>
                        {isMe && <span className="rounded-md bg-violet text-white text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 shrink-0">YOU</span>}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-ink-faint truncate">
                        {row.badge ? `${row.badge} ` : ''}{tierLabel} · {row.gamesWon || 0}W / {row.gamesLost || 0}L
                      </div>
                    </div>
                    <div className="text-right shrink-0 leading-tight">
                      <div className="font-extrabold tabular-nums" style={{ color: row.color || '#FBBF24' }}>{rowRP}</div>
                      <div className="text-[9px] text-ink-faint uppercase tracking-widest">RP</div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
