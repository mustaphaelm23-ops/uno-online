import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Lightweight toast system. Adds toasts to a stack; each toast auto-dismisses
// after `ttl` ms. Exposes a hook so any component can call toast.info/'s/e
// without wiring through props.

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((text, kind = 'i', ttl = 3200) => {
    const id = ++idRef.current;
    setItems((cur) => [...cur, { id, text, kind }]);
    setTimeout(() => dismiss(id), ttl);
  }, [dismiss]);

  const api = {
    info:    (t) => push(t, 'i'),
    success: (t) => push(t, 's'),
    error:   (t) => push(t, 'e'),
  };

  // Kind drives the colour ramp + the leading icon. Keeping the variants
  // tight on purpose — three semantic states only.
  const KIND = {
    i: { palette: 'from-violet to-violet-deep',  icon: 'ℹ',  ring: 'ring-violet-soft/40'  },
    s: { palette: 'from-emerald to-emerald',     icon: '✓', ring: 'ring-emerald/40'      },
    e: { palette: 'from-rose to-rose',           icon: '✕', ring: 'ring-rose/40'         },
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Top-right on desktop; top-center on phone so it isn't clipped
          under the hamburger button or hand of cards. */}
      <div className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-auto sm:right-4 z-[200] flex flex-col gap-2 pointer-events-none items-center sm:items-end">
        <AnimatePresence>
          {items.map((t) => {
            const k = KIND[t.kind] || KIND.i;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0,   scale: 1    }}
                exit={{    opacity: 0, y: -8,  scale: 0.95 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-white
                            bg-gradient-to-br ${k.palette} shadow-card-lg ring-1 ${k.ring}
                            max-w-xs sm:max-w-sm`}
              >
                <span className="text-base shrink-0 leading-none">{k.icon}</span>
                <span className="leading-snug">{t.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
