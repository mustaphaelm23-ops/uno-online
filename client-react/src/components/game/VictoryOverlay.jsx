import { AnimatePresence, motion } from 'framer-motion';
import Avatar from '../ui/Avatar';

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
            <div className="flex justify-center gap-6">
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
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <button type="button" onClick={onPlayAgain} className="btn-violet px-6">Play Again</button>
            <button type="button" onClick={onLobby} className="btn-primary px-6">Back to Lobby</button>
          </div>

          {data.winnerAbandoned && (
            <p className="text-xs text-ink-faint mt-4">Opponent abandoned — pot split among remaining players.</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
