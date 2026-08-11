import { motion } from 'framer-motion';

// Single UNO card — face for player hands, back for opponents/draw pile.
// Size keywords match the table layout's needs: 'sm' for opponent stacks,
// 'md' for my hand, 'lg' for the discard centerpiece.
//
// The face design mirrors a physical card: bold colored field, white oval
// inset with the symbol, small TL/BR corner numerals. Wild cards get a
// 4-color quadrant background and a star symbol.

const COLOR_BG = {
  red:    'linear-gradient(135deg, #ef4444, #b91c1c)',
  blue:   'linear-gradient(135deg, #3b82f6, #1e40af)',
  green:  'linear-gradient(135deg, #22c55e, #15803d)',
  yellow: 'linear-gradient(135deg, #facc15, #b45309)',
  wild:   'conic-gradient(from 45deg, #ef4444 0deg 90deg, #facc15 90deg 180deg, #22c55e 180deg 270deg, #3b82f6 270deg 360deg)',
};

const SIZE = {
  xs: { card: 'w-10 h-14',  num: 'text-lg',  corner: 'text-[8px]'  },
  sm: { card: 'w-12 h-16',  num: 'text-xl',  corner: 'text-[9px]'  },
  md: { card: 'w-16 h-24',  num: 'text-3xl', corner: 'text-[11px]' },
  lg: { card: 'w-20 h-28',  num: 'text-4xl', corner: 'text-[12px]' },
};

const SYMBOLS = {
  skip:           '⊘',
  reverse:        '↻',
  draw_two:       '+2',
  wild:           '★',
  wild_draw_four: '+4',
};

function CornerNumeral({ symbol, color, position, sizeCls }) {
  return (
    <span className={`absolute ${position} font-extrabold ${sizeCls} leading-none`}
          style={{ color }}>{symbol}</span>
  );
}

export default function Card({ card, size = 'md', face = true, playable = false, dim = false, onClick, className = '', back = null }) {
  const sz = SIZE[size] || SIZE.md;

  if (!face) {
    // Back of card — palette driven by the cosmetic `back` prop so the
    // user's equipped Collection skin renders without a separate asset.
    // Falls back to the classic crimson UNO design when no skin is set.
    const v = (back && back.visual) || { bg:'#b91c1c', bg2:'#7f1d1d', accent:'#fbbf24', label:'UNO' };
    return (
      <div className={`${sz.card} rounded-lg overflow-hidden relative shadow-card border border-black/30 ${className}`}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${v.bg}, ${v.bg2})` }} />
        <div className="absolute inset-0 grid place-items-center">
          <div className={`font-display ${sz.num} tracking-wider -rotate-12 drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]`}
               style={{ color: v.accent }}>
            {v.label || 'UNO'}
          </div>
        </div>
        <div className="absolute inset-1.5 rounded-md border-2 border-white/15 pointer-events-none" />
      </div>
    );
  }

  if (!card) return <div className={`${sz.card} ${className}`} />;

  const colorKey = card.isWild ? 'wild' : card.color;
  const bgStyle  = { background: COLOR_BG[colorKey] || COLOR_BG.red };
  const symbol   = SYMBOLS[card.value] || card.value;
  const isAction = card.isAction;

  // Inner oval color: keep wild text dark for legibility against the
  // multicolor field.
  const innerTextColor = card.isWild ? '#0f172a' : COLOR_BG[colorKey]?.match(/#[a-f0-9]+/i)?.[0] || '#000';
  const cornerColor    = card.isWild ? '#fff' : '#fff';

  // Stable component type — we used to toggle between motion.button and a
  // plain div based on whether onClick was defined, but that swapped the
  // host element on every turn change, which forced React to fully
  // unmount + remount the entire card (DOM + animations reset). The
  // visible symptom in 4-player rooms was cards "jumping" or briefly
  // disappearing the moment the turn flipped. Always rendering a
  // motion.button (with an explicit type="button") keeps the element
  // identity stable; we just no-op the click when it isn't playable.
  const interactiveProps = onClick
    ? { whileHover: { y: -8, scale: 1.04 }, whileTap: { scale: 0.97 } }
    : {};

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      {...interactiveProps}
      className={`${sz.card} relative rounded-lg overflow-hidden shadow-card border border-white/25
                  ${dim ? 'opacity-50 grayscale' : ''}
                  ${playable ? 'ring-2 ring-emerald shadow-[0_0_22px_rgba(16,185,129,0.5)]' : ''}
                  ${onClick ? 'cursor-pointer' : 'cursor-default'}
                  ${className}`}
    >
      <div className="absolute inset-0" style={bgStyle} />
      {/* White oval */}
      <div className="absolute inset-2 rounded-lg bg-white/95 grid place-items-center -rotate-[20deg] overflow-hidden">
        <span className={`font-display ${sz.num} font-extrabold leading-none`}
              style={{ color: innerTextColor }}>
          {symbol}
        </span>
      </div>
      {/* Corner numerals */}
      <CornerNumeral symbol={symbol} color={cornerColor} position="top-1 left-1.5" sizeCls={sz.corner} />
      <CornerNumeral symbol={symbol} color={cornerColor} position="bottom-1 right-1.5 rotate-180" sizeCls={sz.corner} />
      {/* Wild chosenColor pip — small dot in TR corner showing the active color */}
      {card.isWild && card.chosenColor && (
        <div className="absolute top-1 right-1 w-3 h-3 rounded-full border border-white"
             style={{ background: COLOR_BG[card.chosenColor]?.match(/#[a-f0-9]+/i)?.[0] || '#fff' }} />
      )}
    </motion.button>
  );
}
