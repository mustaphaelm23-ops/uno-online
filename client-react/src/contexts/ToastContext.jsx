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

  const palette = {
    i: 'from-violet to-violet-deep',
    s: 'from-emerald to-emerald',
    e: 'from-rose to-rose',
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto px-4 py-3 rounded-xl text-sm font-semibold text-white
                          bg-gradient-to-br ${palette[t.kind]} shadow-card max-w-xs`}
            >
              {t.text}
            </motion.div>
          ))}
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
