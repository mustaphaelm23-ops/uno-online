import { motion } from 'framer-motion';
import Card from './Card';

// Center table: glowing arena ring around the discard pile + draw pile.
// Direction arrow shows clockwise vs counter-clockwise. Pot chip floats
// at the top so players see what they're playing for.
//
// Direction: server uses 1 for CW, -1 for CCW (per GameManager DIR).

export default function CenterTable({ topCard, drawPileSize, direction, pot, onDraw, canDraw }) {
  const cw = direction !== -1;
  return (
    <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] grid place-items-center">
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full"
           style={{
             background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 65%)',
             boxShadow: 'inset 0 0 80px rgba(245, 158, 11, 0.18)',
           }} />
      {/* Inner table disc */}
      <div className="absolute inset-6 rounded-full border border-accent/40"
           style={{ background: 'radial-gradient(ellipse at center, #1a0e2e 0%, #0a0e27 70%)',
                    boxShadow: '0 0 60px rgba(124, 58, 237, 0.25) inset' }} />

      {/* Direction arrow — orbiting indicator above the cards */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2 text-accent text-2xl"
        animate={{ rotate: cw ? 360 : -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      >
        {cw ? '↻' : '↺'}
      </motion.div>

      {/* Pot chip */}
      {pot > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 chip bg-accent text-bg shadow-glow-gold">
          🪙 POT {pot}
        </div>
      )}

      {/* Cards row: draw pile + discard pile */}
      <div className="relative flex items-center gap-6">
        <button
          type="button"
          onClick={canDraw ? onDraw : undefined}
          disabled={!canDraw}
          className={`relative ${canDraw ? 'cursor-pointer hover:-translate-y-1' : 'cursor-not-allowed opacity-60'}
                      transition-transform`}
          aria-label="Draw a card"
        >
          <Card size="lg" face={false} />
          {drawPileSize > 0 && (
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 chip bg-bg-3 border border-line text-ink-soft">
              {drawPileSize}
            </span>
          )}
        </button>

        <motion.div
          key={topCard?.id || 'none'}
          initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Card card={topCard} size="lg" />
        </motion.div>
      </div>
    </div>
  );
}
