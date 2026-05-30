import { useRef } from 'react';
import { motion } from 'framer-motion';
import Avatar from '../ui/Avatar';

// PublicRooms — featured 4-room carousel (CLASSIC / FUN / RANKED / CHILL)
// driven by GET /api/rooms/featured. Each card is themed by accent color
// matching the mockup; "HOT" / "RANKED" badges come straight from the
// server payload so client never invents categorization.

const THEME = {
  CLASSIC: { accent: 'text-emerald', glow: 'shadow-[0_0_42px_rgba(16,185,129,0.25)]', bg: 'from-emerald/15 to-emerald/0',  ring: 'ring-emerald/40',
             tableBg: 'from-emerald to-emerald/70', tableGlow: 'shadow-[inset_0_0_24px_rgba(0,0,0,0.5),0_0_28px_rgba(16,185,129,0.45)]' },
  FUN:     { accent: 'text-orange-400', glow: 'shadow-[0_0_42px_rgba(249,115,22,0.30)]', bg: 'from-orange-500/20 to-orange-500/0', ring: 'ring-orange-500/40',
             tableBg: 'from-rose to-rose/70', tableGlow: 'shadow-[inset_0_0_24px_rgba(0,0,0,0.5),0_0_28px_rgba(244,63,94,0.5)]' },
  RANKED:  { accent: 'text-accent',  glow: 'shadow-[0_0_42px_rgba(245,158,11,0.30)]', bg: 'from-accent/20 to-accent/0',   ring: 'ring-accent/40',
             tableBg: 'from-amber-700 to-amber-900', tableGlow: 'shadow-[inset_0_0_24px_rgba(0,0,0,0.6),0_0_28px_rgba(245,158,11,0.5)]' },
  CHILL:   { accent: 'text-sky',     glow: 'shadow-[0_0_42px_rgba(14,165,233,0.30)]', bg: 'from-sky/20 to-sky/0',         ring: 'ring-sky/40',
             tableBg: 'from-sky to-sky/70', tableGlow: 'shadow-[inset_0_0_24px_rgba(0,0,0,0.5),0_0_28px_rgba(14,165,233,0.5)]' },
};

// Octagonal "table" viz with seats positioned around the perimeter,
// mirroring the mockup's room-card composition. We use absolute
// positioning + transform translate so 4 seats land at top, right,
// bottom, left and the center holds the table glow with a UNO chip.
const SEAT_POS = [
  // {top, left, transform} for up to 4 seats around the table
  { top: '0',     left: '50%',  tx: '-translate-x-1/2 -translate-y-1/2' }, // top
  { top: '50%',   left: '100%', tx: '-translate-x-1/2 -translate-y-1/2' }, // right
  { top: '100%',  left: '50%',  tx: '-translate-x-1/2 -translate-y-1/2' }, // bottom
  { top: '50%',   left: '0',    tx: '-translate-x-1/2 -translate-y-1/2' }, // left
];

function RoomTable({ theme, seats = [], max = 4 }) {
  return (
    <div className="relative mx-auto w-32 h-24 sm:w-40 sm:h-28">
      {/* Octagonal table center */}
      <div className={`absolute inset-x-4 inset-y-2 sm:inset-x-6 sm:inset-y-3 rounded-[28%]
                      bg-gradient-to-br ${theme.tableBg} border border-white/15
                      ${theme.tableGlow}`}>
        {/* Table felt inner ring */}
        <div className="absolute inset-1 rounded-[28%] border border-white/10" />
        {/* Center UNO chip */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-bg-2 border border-white/20
                          grid place-items-center font-display text-[10px] sm:text-xs text-accent
                          shadow-card-lg">UNO</div>
        </div>
      </div>

      {/* Seats around the perimeter */}
      {Array.from({ length: max }).map((_, i) => {
        const p = SEAT_POS[i] || SEAT_POS[0];
        const seat = seats[i];
        return (
          <div
            key={i}
            className={`absolute ${p.tx} z-10`}
            style={{ top: p.top, left: p.left }}
          >
            {seat ? (
              <Avatar src={seat.avatar} name={seat.name} size="xs" className="ring-2 ring-bg-2" />
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-line bg-bg/60 grid place-items-center text-ink-faint text-[10px]">+</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PublicRooms({ rooms = [], hotType, onJoin, onWatchLive, onRefresh, refreshing }) {
  // Horizontal scroll container for the cards — on phone the row becomes
  // a snap-scroll carousel that the chevron buttons advance one card at
  // a time. On lg+ the grid layout fits all 4 cards so chevrons are
  // hidden via the responsive classes below.
  const scrollerRef = useRef(null);
  const scroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector('[data-room-card]');
    const step = card ? card.getBoundingClientRect().width + 12 /* gap-3 */ : 200;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  return (
    <section className="panel-card p-4 sm:p-6">
      <header className="flex items-end justify-between mb-4 sm:mb-5 gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-accent">
            <span className="text-lg sm:text-xl">🏆</span>
            <h2 className="font-display text-lg sm:text-2xl tracking-wider truncate">PUBLIC ROOMS</h2>
          </div>
          <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mt-1 tabular-nums">
            {rooms.length} rooms available
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onWatchLive && (
            <button
              type="button"
              onClick={onWatchLive}
              className="chip bg-rose/15 border border-rose/40 text-rose hover:bg-rose/25 transition"
            >📺 LIVE</button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh rooms"
              className={`inline-flex items-center gap-1.5 chip border transition
                          ${refreshing
                            ? 'bg-accent/15 border-accent/50 text-accent'
                            : 'bg-bg-2/80 border-line hover:border-accent/50 hover:text-accent'}`}
            >
              <span className={`text-base leading-none ${refreshing ? 'animate-spin' : ''}`}>↻</span>
              <span className="hidden sm:inline">REFRESH</span>
            </button>
          )}
        </div>
      </header>

      {/* Carousel on phone (snap-scroll + chevron nav) — grid on lg+. */}
      <div className="relative">
        {/* Left chevron: hidden on lg+ where the grid fits everything.
            Styled as a gold-tinted pill per the mockup's chevron arrows. */}
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Previous rooms"
          className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10
                     w-10 h-10 grid place-items-center rounded-full
                     bg-gradient-to-br from-bg-2 to-bg-3
                     border-2 border-accent/40 ring-1 ring-accent/20
                     text-accent text-xl font-extrabold
                     shadow-[0_4px_16px_rgba(245,158,11,0.35)]
                     hover:border-accent hover:bg-accent/10 transition backdrop-blur-sm"
        >‹</button>

        <div
          ref={scrollerRef}
          className="flex lg:grid lg:grid-cols-4 gap-3 sm:gap-4
                     overflow-x-auto lg:overflow-visible scroll-smooth snap-x snap-mandatory
                     -mx-1 px-1
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        {rooms.map((r, idx) => {
          const t = THEME[r.type] || THEME.CLASSIC;
          const isHot = r.type === hotType;
          const isRanked = r.badge === 'RANKED';
          return (
            <motion.button
              key={r.type}
              data-room-card
              type="button"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onJoin?.(r.type)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative rounded-2xl p-3 sm:p-5 text-left border bg-gradient-to-br ${t.bg}
                          hover:ring-1 ${t.ring} ${t.glow} transition-all
                          shrink-0 w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-auto
                          snap-start
                          ${isHot && !isRanked
                            ? 'border-accent/60 ring-2 ring-accent/40 shadow-glow-gold'
                            : 'border-line'}`}
            >
              {isRanked && (
                <span className="absolute -top-2 right-4 chip bg-gradient-to-br from-violet to-violet-deep text-white">RANKED</span>
              )}
              {isHot && !isRanked && (
                <span className="absolute -top-2 left-4 chip bg-gradient-to-br from-rose to-orange-500 text-white">HOT</span>
              )}
              <div className="text-center">
                <div className={`font-display text-base sm:text-xl tracking-wider ${t.accent} truncate`}>
                  {r.label.replace(/ Room$/i, ' ROOM').toUpperCase()}
                </div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mt-0.5">
                  {r.players}/{r.maxPlayers} Players
                </div>
              </div>
              <div className="my-4 sm:my-5">
                <RoomTable theme={t} seats={r.seats} max={r.maxPlayers} />
              </div>
              <div className="border-t border-line/60 pt-2 sm:pt-3 flex items-center justify-between text-[10px] sm:text-xs uppercase tracking-widest text-ink-soft">
                <span>Entry</span>
                <span className="flex items-center gap-1 text-accent font-bold">🪙 {r.entryFee}</span>
              </div>
            </motion.button>
          );
        })}
        </div>

        {/* Right chevron */}
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Next rooms"
          className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10
                     w-10 h-10 grid place-items-center rounded-full
                     bg-gradient-to-br from-bg-2 to-bg-3
                     border-2 border-accent/40 ring-1 ring-accent/20
                     text-accent text-xl font-extrabold
                     shadow-[0_4px_16px_rgba(245,158,11,0.35)]
                     hover:border-accent hover:bg-accent/10 transition backdrop-blur-sm"
        >›</button>
      </div>
    </section>
  );
}
