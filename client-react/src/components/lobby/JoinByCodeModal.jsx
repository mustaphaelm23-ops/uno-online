import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

// Join-by-code modal. Server's GET /api/rooms/code/:code returns
// { roomId, settings, players } for a code lookup; we then navigate to
// /room/:roomId which fires room:join via the existing socket lifecycle.
// Code is normalized to UPPERCASE and stripped of whitespace before
// the lookup so users can paste loosely-formatted codes.

export default function JoinByCodeModal({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const clean = code.replace(/\s+/g, '').toUpperCase();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const data = await api.get(`/api/rooms/code/${clean}`);
      if (!data.roomId) throw new Error('Room not found');
      toast.success('Joining room…');
      onClose?.();
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      toast.error(err.message || 'Room not found');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Join by Code" width="sm">
      <form onSubmit={submit} className="flex flex-col gap-4 sm:gap-5 py-2 sm:py-3">
        <div className="text-center">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-ink-faint">Room code</div>
          <input
            className="mt-2 w-full bg-bg/60 border border-line rounded-xl px-3 sm:px-4 py-3 sm:py-4 text-center
                       font-display text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.4em] text-accent uppercase
                       focus:outline-none focus:border-violet/60 focus:ring-2 focus:ring-violet/20 transition"
            placeholder="------"
            maxLength={8}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="btn-primary text-[12px] tracking-wider disabled:opacity-50"
        >
          {busy ? 'LOOKING UP…' : 'JOIN ROOM'}
        </button>
        <p className="text-[11px] sm:text-xs text-ink-faint text-center leading-snug">
          Ask the host for the 6-character room code on their game screen.
        </p>
      </form>
    </Modal>
  );
}
