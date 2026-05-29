// Tiny avatar primitive: shows image if provided, else a gradient initial
// disc. Size is a Tailwind size keyword we map to consistent diameters so
// callers don't have to remember the magic numbers.

const sizes = {
  xs: 'w-7 h-7  text-xs',
  sm: 'w-9 h-9  text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ src, name = '?', size = 'md', online, className = '', ring = false }) {
  const cls = sizes[size] || sizes.md;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`relative ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${cls} rounded-full object-cover border border-line bg-bg-3 ${ring ? 'ring-2 ring-accent' : ''}`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className={`${cls} rounded-full grid place-items-center font-bold text-white
                         bg-gradient-to-br from-violet to-violet-deep border border-line
                         ${ring ? 'ring-2 ring-accent' : ''}`}>
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-bg
                          ${online ? 'bg-emerald' : 'bg-ink-faint'}`} />
      )}
    </div>
  );
}
