import { motion } from 'framer-motion';
import Avatar from '../ui/Avatar';
import Card from './Card';

// Opponent panel: avatar + name + stack of card-backs proportional to
// handSize (capped at 5 stacked icons for legibility). Glows when it's
// their turn. Shows ⚠ when hand size = 1 and they HAVEN'T called UNO.

export default function OpponentPanel({ player, isCurrent, position = 'top', onCatchUno }) {
  if (!player) return null;
  const showWarn = player.handSize === 1 && !player.saidUno;
  const cardsToShow = Math.min(5, Math.max(1, player.handSize || 1));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative panel-card px-3 py-2 flex items-center gap-2.5 min-w-[140px]
                  ${isCurrent ? 'ring-2 ring-accent shadow-glow-gold' : ''}
                  ${player.abandoned ? 'opacity-50 grayscale' : ''}`}
    >
      <Avatar src={player.avatar} name={player.username} size="sm" online={player.isConnected !== false} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-extrabold truncate">{player.username}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="relative flex">
            {Array.from({ length: cardsToShow }).map((_, i) => (
              <div key={i} className="-ml-2 first:ml-0" style={{ zIndex: i }}>
                <Card size="xs" face={false} />
              </div>
            ))}
          </div>
          <span className="text-[10px] font-bold text-ink-soft tabular-nums">×{player.handSize}</span>
        </div>
      </div>

      {showWarn && (
        <button
          type="button"
          onClick={() => onCatchUno?.(player.id)}
          title="Catch them — they didn't call UNO!"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose text-white text-xs font-bold
                     grid place-items-center shadow-card animate-pulse"
        >!</button>
      )}
      {player.saidUno && (
        <span className="absolute -top-2 -right-2 chip bg-accent text-bg shadow-glow-gold">UNO</span>
      )}
    </motion.div>
  );
}
