import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../api/socket';
import useGameState from '../hooks/useGameState';
import { useToast } from '../contexts/ToastContext';
import SpectatorScreen from '../components/game/SpectatorScreen';

// WatchPage — emits room:spectate on mount, room:spectate_leave on
// unmount. Backend ships the initial state via game:spectator_state and
// continues pushing updates via game:spectator_state_update; both are
// already wired into useGameState, so this page is mostly lifecycle.
// Bounces to '/' on failure (game already finished, not running, etc.).

export default function WatchPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { state } = useGameState();

  useEffect(() => {
    const sk = getSocket();
    if (!sk) { navigate('/'); return; }

    sk.emit('room:spectate', { roomId }, (res) => {
      if (res?.success === false) {
        toast.error(res.reason || 'Cannot watch this room');
        navigate('/');
      }
    });

    return () => { sk.emit('room:spectate_leave', {}); };
  }, [roomId, navigate, toast]);

  return <SpectatorScreen state={state} onLeave={() => navigate('/')} />;
}
