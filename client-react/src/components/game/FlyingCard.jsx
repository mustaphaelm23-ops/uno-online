import { motion } from 'framer-motion';
import Card from './Card';

// Card-fly overlay. Renders absolutely-positioned card that animates from
// the source player's panel area to the center discard pile. Source is
// one of 'me' | 'left' | 'top' | 'right' — matched to the GameScreen
// layout. We use percentage-based offsets so the animation lands roughly
// over the discard regardless of viewport size.
//
// The discard pile sits a bit right-of-center (since draw pile is to its
// left). Numbers tuned by eye against the 320–400 px CenterTable.

const FROM_OFFSETS = {
  me:    { x: 0,    y: 240, rot:   10 },         // bottom-center
  left:  { x: -360, y: 0,   rot:  -25 },         // left-center
  top:   { x: 0,    y: -240, rot:    5 },         // top-center
  right: { x: 360,  y: 0,   rot:   25 },         // right-center
};

export default function FlyingCard({ from = 'me', card, onDone }) {
  const start = FROM_OFFSETS[from] || FROM_OFFSETS.me;
  return (
    <motion.div
      initial={{ x: start.x, y: start.y, rotate: start.rot, opacity: 0, scale: 0.7 }}
      animate={{ x: 30,      y: 0,      rotate: 0,         opacity: 1, scale: 1 }}
      exit={{    x: 30,      y: 0,      rotate: 0,         opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.55, ease: [0.34, 1.5, 0.64, 1] }}
      onAnimationComplete={onDone}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
    >
      <Card card={card} size="lg" />
    </motion.div>
  );
}
