import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Leaderboard modal with two tabs:
//   Ranked — top 20 by ELO (GET /api/leaderboard/ranked) with league badge
//   Rich   — top 20 by coins (GET /api/leaderboard)
// Highlight the row matching the current user so they can spot themselves
// without scanning. Top 3 ranks get a podium glow.

const fmt = (n) => Number(n || 0).toLocaleString();

const TABS = [
  { id: 'ranked', label: 'Ranked', icon: '🏆', url: '/api/leaderboard/ranked' },
  { id: 'rich',   label: 'Rich',   icon: '🪙', url: '/api/leaderboard' },
];

const RANK_ACCENT = {
  1: 'border-accent shadow-glow-gold text-accent',
  2: 'border-ink-soft text-ink-soft',
  3: 'border-orange-400 text-orange-400',
};

function RankBadge({ rank }) {
  const cls = RANK_ACCENT[rank] || 'border-line text-ink-faint';
  return (
    <div className={`w-8 h-8 rounded-full border grid place-items-center font-extrabold text-sm shrink-0 ${cls}`}>
      {rank}
    </div>
  );
}

function RankedRow({ row, isMe, idx }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.015 }}
      className={`flex items-center gap-3 p-2.5 rounded-xl border
        ${isMe ? 'bg-violet/20 border-violet shadow-glow'
              : row.rank <= 3 ? 'bg-bg-3/60 border-line'
                              : 'bg-bg-2/40 border-line'}`}
    >
      <RankBadge rank={row.rank} />
      <Avatar src={row.avatar} name={row.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate flex items-center gap-2">
          {row.username}
          {isMe && <span className="chip bg-violet text-white text-[9px]">YOU</span>}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-ink-faint">
          {row.league || '—'} {row.badge ? `· ${row.badge}` : ''}
        </div>
      </div>
      <div className="text-right">
        <div className="font-extrabold text-violet-soft">{fmt(row.elo)}</div>
        <div className="text-[9px] text-ink-faint uppercase tracking-widest">Rating</div>
      </div>
    </motion.li>
  );
}

function RichRow({ row, isMe, idx }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.015 }}
      className={`flex items-center gap-3 p-2.5 rounded-xl border
        ${isMe ? 'bg-violet/20 border-violet shadow-glow'
              : row.rank <= 3 ? 'bg-bg-3/60 border-line'
                              : 'bg-bg-2/40 border-line'}`}
    >
      <RankBadge rank={row.rank} />
      <Avatar src={row.avatar} name={row.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate flex items-center gap-2">
          {row.username}
          {isMe && <span className="chip bg-violet text-white text-[9px]">YOU</span>}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-ink-faint">
          {fmt(row.gamesWon)}W / {fmt(row.gamesPlayed)} played
        </div>
      </div>
      <div className="text-right">
        <div className="font-extrabold text-accent flex items-center gap-1 justify-end">
          🪙 {fmt(row.coins)}
        </div>
        <div className="text-[9px] text-ink-faint uppercase tracking-widest">Coins</div>
      </div>
    </motion.li>
  );
}

export default function LeaderboardModal({ open, onClose, initialTab = 'ranked' }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab]   = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setLoading(true);
    const url = TABS.find((t) => t.id === tab)?.url;
    api.get(url)
      .then(setData)
      .catch((e) => toast.error(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, tab, toast]);

  const rows = data?.leaderboard || [];

  return (
    <Modal open={open} onClose={onClose} title="Leaderboard" width="lg">
      <div className="flex flex-col gap-5">
        <div className="flex gap-1 p-1 bg-bg/60 rounded-xl border border-line self-start">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition
                ${tab === t.id ? 'bg-violet text-white shadow-glow' : 'text-ink-soft hover:text-ink'}`}
            >{t.icon} {t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-ink-soft py-10 text-center animate-pulse">Loading rankings…</div>
        ) : rows.length === 0 ? (
          <div className="text-ink-faint py-10 text-center text-sm">No rankings yet. Be the first.</div>
        ) : (
          <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {rows.map((row, i) => {
              const isMe = row.username === user?.username;
              return tab === 'ranked'
                ? <RankedRow key={`${row.rank}_${row.username}`} row={row} isMe={isMe} idx={i} />
                : <RichRow   key={`${row.rank}_${row.username}`} row={row} isMe={isMe} idx={i} />;
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
