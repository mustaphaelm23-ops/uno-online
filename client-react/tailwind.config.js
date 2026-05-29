/** @type {import('tailwindcss').Config} */
// Palette + tokens distilled from the lobby mockups: deep navy/violet bg,
// orange-gold accents, vibrant per-theme room colors. Glow + neon shadows
// are pre-composed as shadow tokens so component code stays terse.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:     { DEFAULT: '#0a0e27', 2: '#13183a', 3: '#1d2447' },
        ink:    { DEFAULT: '#e5e7f0', soft: '#9ca3af', faint: '#6b7280' },
        line:   '#1f2547',
        accent: { DEFAULT: '#f59e0b', soft: '#fbbf24', deep: '#d97706' },
        violet: { DEFAULT: '#7c3aed', soft: '#a78bfa', deep: '#5b21b6' },
        emerald:{ DEFAULT: '#10b981' },
        rose:   { DEFAULT: '#f43f5e' },
        sky:    { DEFAULT: '#0ea5e9' },
        // Per-theme room accents (matches the 4 carousel cards in mockup):
        room: {
          classic: '#10b981',
          fun:     '#f97316',
          ranked:  '#f59e0b',
          chill:   '#0ea5e9',
        },
      },
      fontFamily: {
        sans:    ['Outfit', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        glow:        '0 8px 24px rgba(124, 58, 237, .35)',
        'glow-gold': '0 8px 24px rgba(245, 158, 11, .35)',
        card:        '0 16px 40px rgba(0, 0, 0, .55)',
        'card-lg':   '0 22px 60px rgba(0, 0, 0, .65)',
        innerline:   'inset 0 0 0 1px rgba(255, 255, 255, .04)',
      },
      backgroundImage: {
        'lobby-vignette': 'radial-gradient(ellipse at top, rgba(124,58,237,.22), transparent 60%)',
        'panel':          'linear-gradient(180deg, #13183a, #0a0e27)',
        'panel-soft':     'linear-gradient(180deg, rgba(29,36,71,.6), rgba(19,24,58,.6))',
      },
      animation: {
        'fade-in': 'fadeIn .25s ease-out',
        'pop':     'pop .25s cubic-bezier(.34,1.56,.64,1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        pop:    { '0%': { opacity: 0, transform: 'scale(.92)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
