import { AnimatePresence, motion } from 'framer-motion';
import Card from './Card';

// Bottom-of-screen hand row. Cards fan out with horizontal overlap so 7+
// cards fit even at md size. Playable cards float higher (handled by Card
// ring), unplayable cards still render but are dimmed.
//
// Clicking a non-wild playable card immediately calls onPlay(cardId);
// wild cards bubble up to the parent which opens the ColorPicker first.
//
// IMPORTANT — every game:state event from the server pumps a fresh `hand`
// + `playable` prop through here. Earlier versions used framer-motion's
// `layout` + animated `y` based on `playable`, which caused EVERY turn
// flip to re-animate every card → the "cards jumping on my turn" bug in
// 4-player rooms. The fix: use AnimatePresence ONLY for enter/exit (add
// and play), and a plain CSS transform for the "lift" on playable cards.
// No layout prop → no FLIP recompute on prop churn.

export default function MyHand({ hand = [], playable = [], myTurn, onPlayCard }) {
  const playableSet = new Set(playable);

  // Tighter overlap and a scale-down on small screens so a 7+ card hand
  // still fits across a narrow phone viewport without truncating.
  const playableCount = hand.filter((c) => playableSet.has(c.id)).length;
  return (
    <div className="w-full flex flex-col items-center pointer-events-none">
      <div className="text-[10px] uppercase tracking-[0.3em] text-ink-faint mb-1 sm:mb-1.5 pointer-events-auto flex items-center gap-2">
        <span>Your hand · <span className="text-ink tabular-nums">{hand.length}</span></span>
        {myTurn && playableCount > 0 && (
          <span className="inline-flex items-center gap-1 text-emerald font-extrabold normal-case tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            {playableCount} PLAYABLE
          </span>
        )}
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40, scale: 0.8 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="-ml-5 sm:-ml-4 first:ml-0 hover:z-10"
                  style={{ zIndex: i }}
                >
                  {/* Inner CSS-only lift — keeps framer-motion off the
                      "playable" toggle so a turn change can't trigger
                      a full re-animation of every card in the hand. */}
                  <div
                    style={{
                      transform: canPlay ? 'translateY(-10px)' : 'translateY(0)',
                      transition: 'transform .2s ease-out',
                    }}
                  >
                    <Card
                      card={card}
                      size="md"
                      playable={canPlay}
                      dim={myTurn && !canPlay}
                      onClick={canPlay ? () => onPlayCard?.(card) : undefined}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
