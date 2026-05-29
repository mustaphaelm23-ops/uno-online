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
      <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2">Avatar</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 sm:gap-2">
        {AVATAR_PRESETS.map((a) => (
          <motion.button
            key={a}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => !busy && onPick(a)}
            disabled={busy}
            className={`aspect-square rounded-xl text-xl sm:text-2xl grid place-items-center border transition
              ${a === current
                ? 'bg-violet text-white border-violet shadow-glow ring-2 ring-violet/40'
                : 'bg-bg-3/50 border-line hover:border-violet/60 hover:bg-bg-3/80'}`}
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

  // Compact, abbreviated number format used in the 4-stat row so 10,000
  // and 1,050 don't crowd a phone viewport.
  const fmtCompact = (n) => {
    const num = Number(n || 0);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 10_000)    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  };

  const stats = [
    { label: 'Coins',    value: fmtCompact(user.coins),    color: 'text-accent' },
    { label: 'Diamonds', value: fmtCompact(user.diamonds), color: 'text-sky' },
    { label: 'Rating',   value: fmtCompact(user.elo || 1000), color: 'text-violet-soft' },
    { label: 'Wins',     value: fmtCompact(user.wins),     color: 'text-emerald' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="lg">
      <div className="flex flex-col gap-5 sm:gap-6">
        {/* Profile header */}
        <div className="flex items-center gap-3 sm:gap-4 panel-card p-3 sm:p-4">
          <Avatar src={user.avatar} name={user.username} size="lg" ring />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] sm:text-[11px] uppercase tracking-[0.3em] text-ink-faint">Signed in as</div>
            <div className="font-display text-xl sm:text-2xl tracking-wider text-accent leading-tight truncate">
              {user.username}
            </div>
            <div className="mt-1 sm:mt-1.5 flex flex-wrap gap-1.5">
              <span className="chip bg-bg-3 border border-line text-[10px]">🏅 {user.league?.name || 'Unranked'}</span>
              <span className="chip bg-bg-3 border border-line text-[10px]">⭐ LV {user.accountLevel || 1}</span>
            </div>
          </div>
        </div>

        {/* Avatar picker */}
        <AvatarPicker current={user.avatar} onPick={pickAvatar} busy={busy} />

        {/* Stats summary */}
        <div>
          <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2">Stats</label>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="panel-card p-2 sm:p-3">
                <div className={`text-base sm:text-lg font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-ink-faint mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences (display-only for now; sound is intentionally absent —
            the React build ships without audio at all per product direction). */}
        <div>
          <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2">Preferences</label>
          <div className="panel-card p-3 sm:p-4 space-y-2 text-[12px] sm:text-sm">
            <div className="flex justify-between"><span className="text-ink-soft">Sound</span><span className="text-ink-faint">Disabled</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Language</span><span className="text-ink-faint">English</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Theme</span><span className="text-ink-faint">Cyber Casino</span></div>
          </div>
        </div>

        {/* Account actions */}
        <div className="flex">
          <button
            type="button"
            onClick={handleLogout}
            className="btn-ghost w-full sm:w-auto text-[12px] tracking-wider"
          >⎋ SIGN OUT</button>
        </div>
      </div>
    </Modal>
  );
}
