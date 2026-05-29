import { useRef } from 'react';
import { motion } from 'framer-motion';
import Avatar from '../ui/Avatar';

// PublicRooms — featured 4-room carousel (CLASSIC / FUN / RANKED / CHILL)
// driven by GET /api/rooms/featured. Each card is themed by accent color
// matching the mockup; "HOT" / "RANKED" badges come straight from the
// server payload so client never invents categorization.

const THEME = {
  CLASSIC: { accent: 'text-emerald', glow: 'shadow-[0_0_42px_rgba(16,185,129,0.25)]', bg: 'from-emerald/15 to-emerald/0',  ring: 'ring-emerald/40' },
  FUN:     { accent: 'text-orange-400', glow: 'shadow-[0_0_42px_rgba(249,115,22,0.30)]', bg: 'from-orange-500/20 to-orange-500/0', ring: 'ring-orange-500/40' },
  RANKED:  { accent: 'text-accent',  glow: 'shadow-[0_0_42px_rgba(245,158,11,0.30)]', bg: 'from-accent/20 to-accent/0',   ring: 'ring-accent/40' },
  CHILL:   { accent: 'text-sky',     glow: 'shadow-[0_0_42px_rgba(14,165,233,0.30)]', bg: 'from-sky/20 to-sky/0',         ring: 'ring-sky/40' },
};

function SeatStrip({ seats = [], max = 4 }) {
  const filled = seats.slice(0, max);
  const empty  = Math.max(0, max - filled.length);
  return (
    <div className="flex justify-center -space-x-2">
      {filled.map((s, i) => (
        <Avatar key={i} src={s.avatar} name={s.name} size="sm" className="ring-2 ring-bg-2" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <div key={`e${i}`} className="w-9 h-9 rounded-full border-2 border-dashed border-line bg-bg/40 grid place-items-center text-ink-faint text-xs">+</div>
      ))}
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
              className="inline-flex items-center gap-1.5 chip bg-bg-2/80 border border-line hover:border-violet/50 transition"
            >
              <span className={`text-base leading-none ${refreshing ? 'animate-spin' : ''}`}>↻</span>
              <span className="hidden sm:inline">REFRESH</span>
            </button>
          )}
        </div>
      </header>

      {/* Carousel on phone (snap-scroll + chevron nav) — grid on lg+. */}
      <div className="relative">
        {/* Left chevron: hidden on lg+ where the grid fits everything. */}
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Previous rooms"
          className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10
                     w-9 h-9 grid place-items-center rounded-full bg-bg-2/90 border border-line
                     text-ink hover:border-accent/60 hover:text-accent shadow-card backdrop-blur-sm"
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
              className={`relative rounded-2xl p-3 sm:p-5 text-left border border-line bg-gradient-to-br ${t.bg}
                          hover:ring-1 ${t.ring} ${t.glow} transition-all
                          shrink-0 w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-auto
                          snap-start`}
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
              <div className="my-3 sm:my-5">
                <SeatStrip seats={r.seats} max={r.maxPlayers} />
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
                     w-9 h-9 grid place-items-center rounded-full bg-bg-2/90 border border-line
                     text-ink hover:border-accent/60 hover:text-accent shadow-card backdrop-blur-sm"
        >›</button>
      </div>
    </section>
  );
}
