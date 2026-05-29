// Tiny avatar primitive: shows image if provided, else a gradient initial
// disc. Size is a Tailwind size keyword we map to consistent diameters so
// callers don't have to remember the magic numbers. Optional `level`
// renders a small badge overlay (bottom-right) matching the mockup's
// account-level pip on the user pill.

const sizes = {
  xs: { box: 'w-7 h-7  text-xs',  level: 'w-4 h-4  text-[8px]' },
  sm: { box: 'w-9 h-9  text-sm',  level: 'w-5 h-5  text-[9px]' },
  md: { box: 'w-12 h-12 text-base', level: 'w-6 h-6 text-[10px]' },
  lg: { box: 'w-16 h-16 text-xl', level: 'w-7 h-7 text-[11px]' },
  xl: { box: 'w-20 h-20 text-2xl', level: 'w-8 h-8 text-xs' },
};

export default function Avatar({ src, name = '?', size = 'md', online, className = '', ring = false, level }) {
  const sz = sizes[size] || sizes.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`relative ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sz.box} rounded-full object-cover border border-line bg-bg-3 ${ring ? 'ring-2 ring-accent' : ''}`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className={`${sz.box} rounded-full grid place-items-center font-bold text-white
                         bg-gradient-to-br from-violet to-violet-deep border border-line
                         ${ring ? 'ring-2 ring-accent' : ''}`}>
          {initial}
        </div>
      )}
      {online !== undefined && !level && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg
                          ${online ? 'bg-emerald' : 'bg-ink-faint'}`} />
      )}
      {level !== undefined && level !== null && (
        // Level badge replaces the online dot when present — they share
        // the bottom-right slot. The mockup's "23" pill is gold + bold.
        <span className={`absolute -bottom-1 -right-1 ${sz.level} rounded-full grid place-items-center
                          font-extrabold tabular-nums leading-none border-2 border-bg
                          bg-gradient-to-br from-accent to-accent-deep text-bg shadow-card`}>
          {level > 99 ? '99' : level}
        </span>
      )}
    </div>
  );
}
