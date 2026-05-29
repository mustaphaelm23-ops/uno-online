import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

// Backdrop modal. Closes on Esc + backdrop click. Body is scrollable so a
// long form (Create Room with many fields) doesn't blow out the viewport.

export default function Modal({ open, onClose, title, children, width = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }[width] || 'max-w-md';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] grid place-items-center px-2 sm:px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
          <motion.div
            className={`relative w-full ${widthClass} panel-card overflow-hidden`}
            initial={{ y: 16, scale: 0.96, opacity: 0 }}
            animate={{ y: 0,  scale: 1,    opacity: 1 }}
            exit={{    y: 16, scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between p-4 border-b border-line">
              <h3 className="font-bold text-lg">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose transition"
              >✕</button>
            </header>
            <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
            {footer && (
              <footer className="p-4 border-t border-line bg-bg/40">{footer}</footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
