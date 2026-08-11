import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Avatar from '../ui/Avatar';

// Progressive ladder — mirrors server LEAGUES.
const VO_TIERS = [
  { min: 0,    name: 'Bronze',      badge: '🥉', color: '#CD7F32' },
  { min: 500,  name: 'Silver',      badge: '🥈', color: '#C0C0C0' },
  { min: 1300, name: 'Gold',        badge: '🥇', color: '#FFD700' },
  { min: 2400, name: 'Platinum',    badge: '💠', color: '#E5E4E2' },
  { min: 3900, name: 'Diamond',     badge: '💎', color: '#B9F2FF' },
  { min: 6000, name: 'Master',      badge: '👑', color: '#9F70FD' },
  { min: 9000, name: 'Grandmaster', badge: '🏆', color: '#FF6B6B' },
];
function voTierFor(rp) {
  return [...VO_TIERS].reverse().find((t) => (rp || 0) >= t.min) || VO_TIERS[0];
}

// Victory podium. Ranks come from server's game:over payload:
//   data.winners[0]   → 1st (handSize 0)
//   data.players[]    → full roster including loser hand sizes
// We compose a 4-place podium ordered by handSize ascending (winner first).
// Rewards row shows coin payout, XP gain, and any cosmetic drop the server
// included in data.rewards (optional; falls back to coins/XP if absent).

const PLACE_COLOR = ['text-accent', 'text-ink-soft', 'text-orange-400', 'text-violet-soft'];
const PLACE_LABEL = ['1st', '2nd', '3rd', '4th'];

function PodiumPlace({ player, place, isMe }) {
  if (!player) return <div className="w-1/4" />;
  const stars = Math.max(0, 320 - (place * 80));        // rough star score for visual flair
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 + place * 0.1, duration: 0.4, ease: 'easeOut' }}
      className={`flex flex-col items-center gap-2 ${isMe ? 'scale-110' : ''}`}
    >
      <div className="text-[11px] uppercase tracking-widest text-ink-faint">{PLACE_LABEL[place]}</div>
      <div className="relative">
        <Avatar src={player.avatar} name={player.username} size="xl" ring={place === 0} />
        <span className={`absolute -bottom-1 -left-1 w-7 h-7 rounded-full grid place-items-center font-extrabold text-bg
                         bg-gradient-to-br from-accent to-accent-deep shadow-glow-gold border-2 border-bg`}>
          {place + 1}
        </span>
      </div>
      <div className={`font-extrabold text-sm ${PLACE_COLOR[place] || 'text-ink'} truncate max-w-[120px]`}>
        {player.username}
      </div>
      <div className="flex items-center gap-1 text-accent text-sm font-bold">
        ⭐ <span>{stars}</span>
      </div>
    </motion.div>
  );
}

function RewardChip({ icon, label, color }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-14 h-14 rounded-2xl grid place-items-center text-2xl border ${color}`}>
        {icon}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">{label}</div>
    </div>
  );
}

export default function VictoryOverlay({ data, myId, onPlayAgain, onLobby }) {
  // IMPORTANT — all hooks must run unconditionally on every render. The
  // `if (!data) return null` early return used to live above this block
  // but that violated the Rules of Hooks: the first mount (null data)
  // returned with 0 hooks, the next render added 4 useMemo + 2 useState
  // calls, React panicked and tore down the tree. Now we compute every
  // hook against a safe fallback and only branch on `data` at the JSX
  // boundary below.
  const safeData = data || {};

  // Ranked drama — only fires when the server attached a per-player
  // rankedChanges entry for me. Derived OLD tier from (newRank - delta),
  // compared against the new tier name to detect promotion/demotion.
  const myRanked = useMemo(
    () => (safeData.rankedChanges || []).find((r) => r.playerId === myId),
    [safeData, myId],
  );
  const promotion = useMemo(() => {
    if (!myRanked || myRanked.isPlacement) return null;
    const oldRP   = myRanked.newRank - myRanked.delta;
    const oldTier = voTierFor(oldRP);
    const newTier = myRanked.rankedTier || voTierFor(myRanked.newRank);
    if (oldTier.name === newTier.name) return null;
    return { promoted: myRanked.delta > 0, oldTier, newTier };
  }, [myRanked]);
  const placementReveal = myRanked
    && myRanked.isPlacement === false
    && myRanked.placementGamesPlayed >= 5
    && !promotion
    && myRanked.placementGamesPlayed === 5
    ? (myRanked.rankedTier || voTierFor(myRanked.newRank))
    : null;

  // Banner state — defer 1.6s after the modal opens so the podium reads
  // first, then the drama lands on top.
  const [showBanner, setShowBanner] = useState(false);
  useEffect(() => {
    if (!promotion && !placementReveal) return;
    const t = setTimeout(() => setShowBanner(true), 1600);
    const t2 = setTimeout(() => setShowBanner(false), 4800);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [promotion, placementReveal]);

  // Flying RP delta — slides up from the rewards row 0.6s in.
  const [showRP, setShowRP] = useState(false);
  useEffect(() => {
    if (!myRanked) return;
    const t = setTimeout(() => setShowRP(true), 600);
    const t2 = setTimeout(() => setShowRP(false), 2400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [myRanked]);

  // Bail AFTER all hooks have run.
  if (!data) return null;

  // Build ordered ranking by handSize ascending; winners[0] (handSize=0) is 1st.
  const ranked = [...(data.players || [])].sort((a, b) => (a.handSize ?? 99) - (b.handSize ?? 99)).slice(0, 4);
  const myPayout = data.payout || 0;
  const myXp     = data.xpGained || 50;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[160] grid place-items-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-bg/85 backdrop-blur-md" />
        <motion.div
          className="relative panel-card max-w-3xl w-full p-8 text-center"
          initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <motion.h1
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-display text-6xl sm:text-7xl tracking-[0.2em] text-accent
                       drop-shadow-[0_6px_24px_rgba(245,158,11,0.5)]"
          >
            {data.winnerAbandoned ? 'VICTORY!' : 'VICTORY!'}
          </motion.h1>

          <div className="grid grid-cols-4 gap-3 mt-8 mb-10">
            {ranked.map((p, i) => (
              <PodiumPlace key={p.id || i} player={p} place={i} isMe={p.id === myId} />
            ))}
          </div>

          <div className="border-t border-line pt-6">
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-faint mb-3">Rewards</div>
            <div className="flex justify-center gap-6 flex-wrap">
              <RewardChip
                icon="🪙"
                label={`+${myPayout || data.pot || 0}`}
                color="bg-accent/15 border-accent/40 text-accent"
              />
              <RewardChip
                icon="XP"
                label={`+${myXp}`}
                color="bg-violet/15 border-violet/40 text-violet-soft font-extrabold"
              />
              <RewardChip
                icon="🎴"
                label="+1"
                color="bg-rose/15 border-rose/40 text-rose"
              />
              {myRanked && (
                myRanked.isPlacement ? (
                  <RewardChip
                    icon="🎯"
                    label={`${myRanked.placementGamesPlayed}/5`}
                    color="bg-amber-500/15 border-amber-400/40 text-amber-300"
                  />
                ) : (
                  <RewardChip
                    icon="🏆"
                    label={`${myRanked.delta > 0 ? '+' : ''}${myRanked.delta} RP`}
                    color={`${myRanked.delta > 0 ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : myRanked.delta < 0 ? 'bg-rose/15 border-rose/40 text-rose' : 'bg-ink-faint/10 border-ink-faint/30 text-ink-soft'}`}
                  />
                )
              )}
            </div>
          </div>

          {/* Ranked: flying RP delta — swoops upward, 80px Bangers font. */}
          {myRanked && !myRanked.isPlacement && (
            <AnimatePresence>
              {showRP && (
                <motion.div
                  className="fixed left-1/2 top-1/2 pointer-events-none z-[170] font-display tracking-[6px]"
                  style={{
                    fontSize: '80px',
                    color: myRanked.delta > 0 ? '#5dd75d' : myRanked.delta < 0 ? '#ff6b6b' : '#cfd1d8',
                    textShadow: `0 4px 18px rgba(0,0,0,.7), 0 0 40px ${myRanked.delta > 0 ? '#5dd75d' : myRanked.delta < 0 ? '#ff6b6b' : '#cfd1d8'}`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  initial={{ y: 0, scale: 0.3, opacity: 0 }}
                  animate={{ y: -180, scale: 1, opacity: 1 }}
                  exit={{ y: -260, scale: 0.7, opacity: 0 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                >
                  {myRanked.delta > 0 ? '+' : ''}{myRanked.delta} RP
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Ranked: promotion / demotion / placement reveal banner. */}
          {(promotion || placementReveal) && (
            <AnimatePresence>
              {showBanner && (
                <motion.div
                  className="fixed left-1/2 top-1/2 z-[171] px-9 py-6 rounded-2xl text-center pointer-events-none"
                  style={{
                    background: 'linear-gradient(180deg, rgba(20,20,30,0.96), rgba(8,8,18,0.98))',
                    border: `2px solid ${promotion?.promoted || placementReveal ? '#FBBF24' : '#ff6b6b'}`,
                    boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 80px ${promotion?.promoted || placementReveal ? '#FBBF24' : '#ff6b6b'}99`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="font-display text-sm tracking-[5px]" style={{ color: promotion?.promoted || placementReveal ? '#FBBF24' : '#ff6b6b' }}>
                    {placementReveal ? '⭐ PLACEMENT COMPLETE ⭐' : promotion.promoted ? '⭐ PROMOTED ⭐' : '⚠️ DEMOTED'}
                  </div>
                  <div className="text-[64px] leading-none my-2" style={{ textShadow: `0 0 30px ${(placementReveal || promotion.newTier).color}cc` }}>
                    {(placementReveal || promotion.newTier).badge}
                  </div>
                  <div className="font-display text-2xl tracking-widest" style={{ color: (placementReveal || promotion.newTier).color }}>
                    {(placementReveal || promotion.newTier).name}
                  </div>
                  <div className="text-[11px] text-ink-soft mt-1.5 tracking-widest">
                    {placementReveal
                      ? `Welcome to ${(placementReveal).name}`
                      : `${promotion.oldTier.badge} ${promotion.oldTier.name} → ${promotion.newTier.badge} ${promotion.newTier.name}`}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button type="button" onClick={onPlayAgain} className="btn-violet px-6 text-[12px] tracking-wider">PLAY AGAIN</button>
            <button type="button" onClick={onLobby} className="btn-primary px-6 text-[12px] tracking-wider">BACK TO LOBBY</button>
          </div>

          {data.winnerAbandoned && (
            <p className="text-xs text-ink-faint mt-4">Opponent abandoned — pot split among remaining players.</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
