import { useState } from 'react';
import Modal from '../ui/Modal';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

// Create Room modal. Lets the host pick: theme (CLASSIC/FUN/RANKED/CHILL —
// each pre-sets entry fee per backend ROOM_TYPES table), max players,
// public/private + password. Submits to POST /api/rooms; on success calls
// onCreated(roomId, code) so the parent can navigate or auto-invite.
// We deliberately don't auto-set bet for private rooms — host adjusts it
// with a slider when they pick 'PRIVATE'.

const THEMES = [
  { id: 'CLASSIC', label: 'Classic', accent: 'border-emerald/40 hover:border-emerald', entryFee: 100, ranked: false },
  { id: 'FUN',     label: 'Fun',     accent: 'border-orange-500/40 hover:border-orange-500', entryFee: 200, ranked: false },
  { id: 'RANKED',  label: 'Ranked',  accent: 'border-accent/40 hover:border-accent', entryFee: 300, ranked: true,
                   hint: 'Affects ELO + queue ban on abandon' },
  { id: 'CHILL',   label: 'Chill',   accent: 'border-sky/40 hover:border-sky', entryFee: 100, ranked: false },
  { id: 'PRIVATE', label: 'Private', accent: 'border-violet/40 hover:border-violet', entryFee: 100, ranked: false,
                   hint: 'Friends-only with a code' },
];

export default function CreateRoomModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [theme, setTheme] = useState('CLASSIC');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [bet, setBet] = useState(100);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const pickTheme = (id) => {
    const cfg = THEMES.find((t) => t.id === id);
    setTheme(id);
    setBet(cfg.entryFee);
    if (id === 'PRIVATE') setIsPrivate(true);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const body = {
        settings: {
          maxPlayers,
          bet,
          isPrivate,
          password: isPrivate && password ? password : null,
        },
      };
      const data = await api.post('/api/rooms', body);
      toast.success(`Room created — code ${data.code}`);
      onCreated?.(data.roomId, data.code);
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Failed to create room');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Create a Room"
      width="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost text-[12px] tracking-wider w-full sm:w-auto"
          >CANCEL</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn-primary text-[12px] tracking-wider w-full sm:w-auto disabled:opacity-50"
          >
            {busy ? 'CREATING…' : 'CREATE & OPEN'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* Theme */}
        <div>
          <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2">Room type</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTheme(t.id)}
                className={`p-2 sm:p-3 rounded-xl text-[12px] sm:text-sm font-extrabold tracking-wider border transition
                  ${theme === t.id ? `bg-bg-3 ${t.accent.replace('hover:', '')} ring-2 ring-violet/40`
                                   : `bg-bg-2/60 border-line ${t.accent}`}`}
              >
                {t.label.toUpperCase()}
                {t.ranked && <div className="text-[9px] uppercase tracking-widest text-accent mt-0.5 sm:mt-1">RANKED</div>}
              </button>
            ))}
          </div>
          {THEMES.find((t) => t.id === theme)?.hint && (
            <p className="text-[11px] sm:text-xs text-ink-faint mt-2 leading-snug">{THEMES.find((t) => t.id === theme).hint}</p>
          )}
        </div>

        {/* Max players + bet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2">Max players</label>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-2 sm:py-2.5 rounded-xl text-sm font-extrabold tabular-nums border transition
                    ${maxPlayers === n
                      ? 'bg-violet text-white border-violet shadow-glow'
                      : 'bg-bg-2/60 border-line hover:border-violet/40'}`}
                >{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-widest text-ink-faint mb-2 flex items-center justify-between">
              <span>Entry fee</span>
              <span className="text-accent font-extrabold tabular-nums">🪙 {bet}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={bet}
              onChange={(e) => setBet(parseInt(e.target.value, 10))}
              className="w-full accent-violet"
            />
            <div className="flex justify-between text-[9px] uppercase tracking-widest text-ink-faint mt-1">
              <span>0</span><span>500</span><span>1000</span>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="rounded-xl border border-line bg-bg-2/60 p-3 sm:p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-5 h-5 accent-violet shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">Private room</div>
              <div className="text-[11px] text-ink-faint leading-snug">Only friends with the code (or invited) can join.</div>
            </div>
          </label>
          {isPrivate && (
            <input
              className="input mt-3"
              type="text"
              maxLength={20}
              placeholder="Optional password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
