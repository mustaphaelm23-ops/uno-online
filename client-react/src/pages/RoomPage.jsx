import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Avatar from '../components/ui/Avatar';
import FriendsRail from '../components/lobby/FriendsRail';

// RoomPage is the lobby for a single room: shows the code, seated players,
// invite controls + a Start CTA for the host. Actual gameplay UI ships in a
// follow-up commit; for now we wire the join/leave plumbing so creating a
// room and inviting a friend produces a functional end-to-end loop:
//
//   Host:    Create Room → land here → click Invite on a friend in the rail
//   Friend:  Receive friend:invite toast in lobby → (manual /room/:id for now)
//
// We emit 'room:join' on mount so the server seats us; on unmount we emit
// 'room:leave' so the seat is freed.

export default function RoomPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get(`/api/rooms/${roomId}`);
      setRoom(data);
    } catch (err) {
      toast.error(err.message || 'Room load failed');
      navigate('/');
    }
  }, [roomId, navigate, toast]);

  useEffect(() => {
    const sk = getSocket();
    if (!sk) return;

    sk.emit('room:join', { roomId }, (res) => {
      if (res?.success === false) {
        toast.error(res.reason || 'Failed to join');
        navigate('/');
      } else {
        refresh();
      }
    });

    const onChanged = () => refresh();
    sk.on('room:player_change', onChanged);
    sk.on('room:state',         onChanged);
    sk.on('game:start',         () => toast.info('Game starting — UI ships in a follow-up commit'));

    return () => {
      sk.emit('room:leave', {});
      sk.off('room:player_change', onChanged);
      sk.off('room:state',         onChanged);
    };
  }, [roomId, refresh, navigate, toast]);

  const leave = () => navigate('/');

  const startMatch = () => {
    if (busy) return;
    setBusy(true);
    const sk = getSocket();
    sk?.emit('room:start', {}, (res) => {
      setBusy(false);
      if (res?.success === false) toast.error(res.reason || 'Cannot start yet');
    });
  };

  if (!room) {
    return <div className="h-full grid place-items-center text-ink-soft animate-pulse">Joining room…</div>;
  }

  const code     = room.code || room.settings?.code || '----';
  const seats    = room.players || room.seats || [];
  const isHost   = room.hostId === user?.id || seats[0]?.id === user?.id;
  const canStart = isHost && seats.length >= (room.settings?.minPlayers || 2);

  return (
    <div className="min-h-full max-w-[1480px] mx-auto px-3 sm:px-6 py-5 flex flex-col gap-4">
      <header className="panel-card p-4 sm:p-5 flex items-center gap-4">
        <button type="button" className="btn-ghost" onClick={leave}>← Lobby</button>
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-ink-faint">Room code</div>
          <div className="font-display text-3xl tracking-[0.4em] text-accent">{code}</div>
        </div>
        <div className="flex-1" />
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-widest text-ink-faint">Entry fee</div>
          <div className="font-bold text-accent">🪙 {room.settings?.bet ?? 0}</div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <main className="flex-1 panel-card p-6">
          <h2 className="font-display text-xl tracking-wider text-ink mb-4">Players ({seats.length}/{room.settings?.maxPlayers ?? 4})</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: room.settings?.maxPlayers ?? 4 }).map((_, i) => {
              const p = seats[i];
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2
                    ${p ? 'bg-bg-3/60 border-violet/40' : 'bg-bg-2/40 border-dashed border-line'}`}
                >
                  {p ? (
                    <>
                      <Avatar src={p.avatar} name={p.username || p.name} size="lg" />
                      <div className="text-sm font-bold truncate max-w-full">{p.username || p.name}</div>
                      {(p.id === room.hostId || (i === 0 && !room.hostId)) && (
                        <span className="chip bg-accent/15 text-accent border border-accent/30">HOST</span>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full grid place-items-center border-2 border-dashed border-line text-ink-faint text-2xl">+</div>
                      <div className="text-xs text-ink-faint">Empty seat</div>
                    </>
                  )}
                </motion.li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startMatch}
              disabled={!canStart || busy}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isHost ? (canStart ? 'Start Match' : 'Waiting for players…') : 'Waiting for host…'}
            </button>
            <button type="button" className="btn-ghost" onClick={leave}>Leave</button>
          </div>

          <p className="text-xs text-ink-faint mt-4">
            Game UI ships in the next commit. Once the host taps Start, the existing backend handles the match
            (cards, turns, payouts) but the React-rendered table will be wired in a follow-up.
          </p>
        </main>

        <aside className="w-full lg:w-72 shrink-0">
          <FriendsRail activeRoomId={roomId} />
        </aside>
      </div>
    </div>
  );
}
