// Fixed-position scattered UNO cards that drift in the background of the
// lobby. Matches the mockup's "casino full of cards" backdrop — small
// tilted card silhouettes anchored to the four corners + a couple in
// the middle distance, all at low opacity so the foreground stays
// readable. Pointer-events-none so they never intercept clicks.

const CARDS = [
  // [position, size, rotation, color gradient, face]
  { cls: 'top-[8%]   left-[3%]  w-12 h-16 rotate-[-18deg]',  grad: 'from-rose to-rose-deep',         face: '+2' },
  { cls: 'top-[20%]  left-[12%] w-10 h-14 rotate-[22deg]',   grad: 'from-amber-500 to-amber-700',    face: '8'  },
  { cls: 'top-[55%]  left-[5%]  w-11 h-15 rotate-[14deg]',   grad: 'from-rose to-rose-deep',         face: 'UNO' },
  { cls: 'bottom-[10%] left-[18%] w-10 h-14 rotate-[-10deg]', grad: 'from-rose-500 to-rose-700',     face: '6'  },
  { cls: 'top-[6%]   right-[12%] w-12 h-16 rotate-[16deg]',   grad: 'from-amber-500 to-amber-700',   face: 'UNO'},
  { cls: 'top-[40%]  right-[4%]  w-10 h-14 rotate-[-20deg]',  grad: 'from-rose to-rose-deep',        face: '9'  },
  { cls: 'bottom-[18%] right-[8%] w-11 h-15 rotate-[24deg]',  grad: 'from-rose-500 to-rose-700',     face: '+2' },
  { cls: 'bottom-[2%] right-[22%] w-10 h-14 rotate-[-8deg]',  grad: 'from-amber-500 to-amber-700',   face: '4'  },
];

export default function LobbyBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden -z-10">
      {CARDS.map((c, i) => (
        <div
          key={i}
          className={`absolute rounded-md border border-white/15
                      bg-gradient-to-br ${c.grad}
                      shadow-[0_8px_24px_rgba(0,0,0,0.5)]
                      grid place-items-center font-display text-white
                      opacity-[0.18]
                      ${c.cls}`}
        >
          <div className="absolute inset-1 rounded border border-white/15 pointer-events-none" />
          <span className="relative leading-none text-[10px] font-extrabold tracking-wide">
            {c.face}
          </span>
        </div>
      ))}
    </div>
  );
}
