import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import QuickChatPanel from './QuickChatPanel';
import ReactionsPanel from './ReactionsPanel';

// Three-fab social bar on the bottom-right of the game screen:
//   💬  chat panel       — opens a slide-out chat aside
//   💭  quick-chat grid  — 12 server-vetted presets
//   😎  reactions grid   — 12 emoji reactions
//
// Local debounce per channel matches the server's throttle so honest play
// never trips the rate-limit. Parent supplies onChat/onQuick/onReaction
// async handlers; we close the popover on pick.

const QUICK_COOLDOWN_MS    = 2000;     // server: 2 s
const REACTION_COOLDOWN_MS = 1500;     // server: 1 s, +500 ms UX headroom

function Fab({ icon, onClick, active, label }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-label={label}
      className={`w-11 h-11 rounded-full grid place-items-center text-xl border transition
                  ${active ? 'bg-violet text-white border-violet shadow-glow'
                           : 'bg-bg-2/80 border-line hover:border-violet/60'}`}
    >{icon}</motion.button>
  );
}

export default function SocialBar({ onOpenChat, onQuickChat, onReaction }) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const quickAllowAt = useRef(0);
  const reactAllowAt = useRef(0);

  const handleQuick = (preset) => {
    const now = Date.now();
    if (now < quickAllowAt.current) return;
    quickAllowAt.current = now + QUICK_COOLDOWN_MS;
    onQuickChat?.(preset);
  };
  const handleReaction = (emoji) => {
    const now = Date.now();
    if (now < reactAllowAt.current) return;
    reactAllowAt.current = now + REACTION_COOLDOWN_MS;
    onReaction?.(emoji);
  };

  return (
    <div className="relative flex flex-col gap-2 items-end">
      <Fab icon="💬" label="Chat"        onClick={onOpenChat} />
      <Fab icon="💭" label="Quick chat"  active={quickOpen}
           onClick={() => { setQuickOpen((v) => !v); setReactOpen(false); }} />
      <Fab icon="😎" label="Reactions"   active={reactOpen}
           onClick={() => { setReactOpen((v) => !v); setQuickOpen(false); }} />

      <QuickChatPanel open={quickOpen} onPick={handleQuick} onClose={() => setQuickOpen(false)} />
      <ReactionsPanel open={reactOpen} onPick={handleReaction} onClose={() => setReactOpen(false)} />
    </div>
  );
}
