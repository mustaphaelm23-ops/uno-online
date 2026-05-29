import { useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Settings + profile modal. Backend currently exposes only the avatar
// mutation; display name + email are immutable post-signup, so this is
// primarily an avatar picker + sign-out + meta info surface.

const AVATAR_PRESETS = [
  '🦊','🐺','🐲','🦄','🐯','🦁','🐸','🐼','🐻','🐨','🦉','🐧',
  '🤖','👽','👻','🎭','🎩','🦸','🥷','🧙','🧛','🎯','⭐','🔥',
];

function AvatarPicker({ current, onPick, busy }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-ink-faint mb-2">Avatar</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        {AVATAR_PRESETS.map((a) => (
          <motion.button
            key={a}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => !busy && onPick(a)}
            disabled={busy}
            className={`w-11 h-11 rounded-xl text-2xl grid place-items-center border transition
              ${a === current
                ? 'bg-violet text-white border-violet shadow-glow'
                : 'bg-bg-3/50 border-line hover:border-violet/60'}`}
            aria-label={`Pick ${a}`}
          >{a}</motion.button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({ open, onClose }) {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pickAvatar = async (a) => {
    if (a === user?.avatar) return;
    setBusy(true);
    try {
      await api.post('/api/profile/avatar', { avatar: a });
      await refreshUser();
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err.message || 'Avatar failed');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    if (!confirm('Sign out?')) return;
    onClose?.();
    logout();
  };

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="lg">
      <div className="flex flex-col gap-6">
        {/* Profile header */}
        <div className="flex items-center gap-4 panel-card p-4">
          <Avatar src={user.avatar} name={user.username} size="xl" ring />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-faint">Signed in as</div>
            <div className="font-display text-2xl tracking-wider text-accent leading-tight truncate">
              {user.username}
            </div>
            <div className="mt-1.5 flex gap-2">
              <span className="chip bg-bg-3 border border-line">🏅 {user.league?.name || 'Unranked'}</span>
              <span className="chip bg-bg-3 border border-line">⭐ Lv {user.accountLevel || 1}</span>
            </div>
          </div>
        </div>

        {/* Avatar picker */}
        <AvatarPicker current={user.avatar} onPick={pickAvatar} busy={busy} />

        {/* Stats summary */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-ink-faint mb-2">Stats</label>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="panel-card p-3"><div className="text-lg font-extrabold text-accent">{Number(user.coins || 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Coins</div></div>
            <div className="panel-card p-3"><div className="text-lg font-extrabold text-sky">{Number(user.diamonds || 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Diamonds</div></div>
            <div className="panel-card p-3"><div className="text-lg font-extrabold text-violet-soft">{user.elo || 1000}</div><div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Rating</div></div>
            <div className="panel-card p-3"><div className="text-lg font-extrabold text-emerald">{user.wins || 0}</div><div className="text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">Wins</div></div>
          </div>
        </div>

        {/* Preferences (display-only for now; sound is intentionally absent —
            the React build ships without audio at all per product direction). */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-ink-faint mb-2">Preferences</label>
          <div className="panel-card p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Sound</span><span className="text-ink-faint">Disabled</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Language</span><span className="text-ink-faint">English</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Theme</span><span className="text-ink-faint">Cyber Casino (default)</span></div>
          </div>
        </div>

        {/* Account actions */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleLogout} className="btn-ghost text-sm">⎋ Sign out</button>
        </div>
      </div>
    </Modal>
  );
}
