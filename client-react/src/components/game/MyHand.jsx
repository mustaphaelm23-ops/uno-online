import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';

// Bottom-of-screen hand row. Cards fan out with horizontal overlap so 7+
// cards fit even at md size. Playable cards float higher (handled by Card
// ring), unplayable cards still render but are dimmed.
//
// Clicking a non-wild playable card immediately calls onPlay(cardId);
// wild cards bubble up to the parent which opens the ColorPicker first.

export default function MyHand({ hand = [], playable = [], myTurn, onPlayCard }) {
  const playableSet = new Set(playable);

  // Tighter overlap and a scale-down on small screens so a 7+ card hand
  // still fits across a narrow phone viewport without truncating.
  return (
    <div className="w-full flex flex-col items-center pointer-events-none">
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint mb-1 sm:mb-1.5 pointer-events-auto">
        Your hand · {hand.length}
      </div>
      <div className="relative h-24 sm:h-36 w-full max-w-3xl pointer-events-auto
                      scale-[0.82] sm:scale-100 origin-bottom">
        <div className="absolute inset-0 flex items-end justify-center gap-0">
          <AnimatePresence initial={false}>
            {hand.map((card, i) => {
              const canPlay = myTurn && playableSet.has(card.id);
              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: canPlay ? -10 : 0 }}
                  exit={{ opacity: 0, y: -40, scale: 0.8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="-ml-5 sm:-ml-4 first:ml-0 hover:z-10"
                  style={{ zIndex: i }}
                >
                  <Card
                    card={card}
                    size="md"
                    playable={canPlay}
                    dim={myTurn && !canPlay}
                    onClick={canPlay ? () => onPlayCard?.(card) : undefined}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
