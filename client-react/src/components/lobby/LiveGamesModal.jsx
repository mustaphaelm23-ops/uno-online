import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

// Live games modal — surfaces rooms with status 'playing' so any
// authenticated user can spectate. Server already returns these via
// GET /api/rooms as the `liveGames` array. Tap "Watch" → navigate to
// /watch/:roomId where the spectator socket handshake runs.

const fmt = (n) => Number(n || 0).toLocaleString();

function LiveCard({ g, idx, onWatch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="rounded-xl p-3 bg-bg-3/40 border border-line hover:border-violet/50 transition"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="chip bg-rose/15 text-rose border border-rose/40">● LIVE</span>
        <span className="text-[10px] text-ink-faint uppercase tracking-widest">
          🪙 {fmt(g.bet)} pot
        </span>
      </div>
      <div className="flex -space-x-2 justify-center mb-3">
        {g.seats?.map((s, i) => (
          <Avatar key={i} src={s.avatar} name={s.name} size="sm" className="ring-2 ring-bg-2" />
        ))}
      </div>
      <div className="text-center mb-3">
        <div className="text-[11px] text-ink-soft truncate">
          {g.playerNames?.join(' · ')}
        </div>
        <div className="text-[10px] text-ink-faint mt-0.5">
          {g.players}/{g.maxPlayers} · 👁 {g.spectators}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onWatch(g.id)}
        className="btn-violet w-full text-[11px] tracking-wider"
      >📺 WATCH</button>
    </motion.div>
  );
}

export default function LiveGamesModal({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/rooms');
      setGames(data.liveGames || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load live games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open]);

  // Soft refresh every 6 s while open so a finished game drops off and a
  // new one shows up without manual refresh.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
    /* eslint-disable-next-line */
  }, [open]);

  const watch = (roomId) => {
    onClose?.();
    navigate(`/watch/${roomId}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="Live Games" width="xl">
      {loading && games.length === 0 ? (
        <div className="text-ink-soft py-10 text-center animate-pulse">Looking for live matches…</div>
      ) : games.length === 0 ? (
        <div className="text-ink-faint py-10 text-center text-sm">
          No games in progress right now. Check back in a few seconds.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {games.map((g, i) => (
            <LiveCard key={g.id} g={g} idx={i} onWatch={watch} />
          ))}
        </div>
      )}
    </Modal>
  );
}
