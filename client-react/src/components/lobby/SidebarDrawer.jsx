import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import Avatar from '../ui/Avatar';
import Sidebar from './Sidebar';

// Mobile sidebar drawer. Wraps the same <Sidebar> component the desktop
// layout uses, plus the user pill that lives in the desktop TopBar
// (username + level + sign-out) so phone users can reach those too
// without a separate profile screen. Closes on Esc + backdrop tap.

const fmt = (n) => Number(n || 0).toLocaleString();

export default function SidebarDrawer({ open, onClose, user, onAction, onLogout }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] lg:hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

          <motion.aside
            initial={{ x: -360 }}
            animate={{ x: 0 }}
            exit={{ x: -360 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="absolute left-0 top-0 bottom-0 w-[280px] sm:w-[300px] panel-card rounded-none border-0 border-r border-line flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User pill — same info the desktop TopBar shows on the right */}
            <header className="p-4 border-b border-line flex items-center gap-3">
              <Avatar src={user?.avatar} name={user?.username} size="md" online />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{user?.username || 'Guest'}</div>
                <div className="text-[10px] text-ink-soft uppercase tracking-widest mt-0.5">
                  {user?.league?.name || 'Unranked'} · Lv {user?.accountLevel || 1}
                </div>
                <div className="text-[10px] text-ink-faint mt-0.5">
                  🪙 {fmt(user?.coins)} · 💎 {fmt(user?.diamonds)}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="w-8 h-8 grid place-items-center rounded-lg border border-line hover:border-rose hover:text-rose"
              >✕</button>
            </header>

            {/* Sidebar items — render the same component the desktop uses;
                tapping an item both fires onAction(id) and closes the
                drawer so the user lands on the modal directly. */}
            <nav className="flex-1 overflow-y-auto p-3">
              <Sidebar
                onAction={(id) => { onAction?.(id); onClose?.(); }}
                inDrawer
              />
            </nav>

            <footer className="p-3 border-t border-line">
              <button
                type="button"
                onClick={() => { onClose?.(); onLogout?.(); }}
                className="btn-ghost w-full text-sm"
              >⎋ Sign out</button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
