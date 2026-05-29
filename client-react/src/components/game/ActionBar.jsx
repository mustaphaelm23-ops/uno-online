import { motion } from 'framer-motion';

// Right-side floating action bar: UNO call, Draw, Pass. Each shows only
// when contextually valid (UNO on handSize===2 before play, Draw on your
// turn before you've drawn, Pass after drawing if you choose not to play).

export default function ActionBar({ myTurn, canUno, canDraw, canPass, onUno, onDraw, onPass }) {
  return (
    <div className="flex flex-col gap-2 items-end">
      {canUno && (
        <motion.button
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.94 }}
          onClick={onUno}
          className="w-16 h-16 rounded-full font-display text-2xl tracking-wider text-bg
                     bg-gradient-to-br from-accent to-accent-deep shadow-glow-gold
                     border-2 border-white/30 animate-pulse"
        >UNO!</motion.button>
      )}
      <button
        type="button"
        onClick={onDraw}
        disabled={!canDraw}
        className="btn-violet text-xs px-4 disabled:opacity-40 disabled:cursor-not-allowed"
      >Draw</button>
      <button
        type="button"
        onClick={onPass}
        disabled={!canPass}
        className="btn-ghost text-xs px-4 disabled:opacity-40 disabled:cursor-not-allowed"
      >Pass</button>
      {!myTurn && (
        <div className="text-[10px] text-ink-faint uppercase tracking-widest mt-1">Waiting…</div>
      )}
    </div>
  );
}
