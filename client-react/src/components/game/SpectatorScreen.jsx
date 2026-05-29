import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CenterTable from './CenterTable';
import OpponentPanel from './OpponentPanel';
import TurnTimer from './TurnTimer';
import Card from './Card';
import ChatPanel from './ChatPanel';
import useEquippedBack from '../../hooks/useEquippedBack';
import useSpectatorChat from '../../hooks/useSpectatorChat';
import useSpectatorVote from '../../hooks/useSpectatorVote';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

// Read-only "watching" view of an in-progress match. Backend ships
// game:spectator_state which includes EVERY player's full hand under
// state.hands. We render hand-of-the-current-turn fanned at the bottom
// (since that's what the spectator most wants to see); everyone else
// shows as a regular OpponentPanel around the table.
//
// No actions — no MyHand interactivity, no ColorPicker, no ActionBar.

export default function SpectatorScreen({ state, onLeave }) {
  const navigate = useNavigate();
  const back = useEquippedBack();
  const { user } = useAuth();
  const toast = useToast();
  const { messages, send } = useSpectatorChat();
  const { tally, my: votedFor, castVote } = useSpectatorVote();
  const [chatOpen, setChatOpen] = useState(false);

  const handleSend = async (text) => {
    const res = await send(text);
    if (res?.success === false) toast.error(res.reason || 'Chat failed');
  };

  const handleVote = async (playerId) => {
    const res = await castVote(playerId);
    if (res?.success === false) toast.error(res.reason || 'Vote failed');
  };

  const totalVotes = Object.values(tally).reduce((s, n) => s + n, 0);
  if (!state) {
    return <div className="h-full grid place-items-center text-ink-soft animate-pulse">Joining as spectator…</div>;
  }

  const players = state.players || [];
  const handsById = new Map((state.hands || []).map((h) => [h.playerId, h.cards]));
  const currentId = state.currentTurn;
  const current   = players.find((p) => p.id === currentId);
  const others    = players.filter((p) => p.id !== currentId);
  const currentHand = handsById.get(currentId) || [];

  // Layout: featured player (current turn) at bottom, others at top/left/right.
  const leftOpp  = others.length >= 2 ? others[0] : null;
  const topOpp   = others.length === 1 ? others[0]
                 : others.length >= 2 ? others[1] : null;
  const rightOpp = others.length >= 3 ? others[2] : null;

  const leave = () => {
    if (onLeave) onLeave();
    else navigate('/');
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-20">
        <div className="flex items-center gap-2">
          <TurnTimer endsAt={state.turnEndsAt} totalMs={state.turnTimeout || 30000} label="Turn" />
          <span className="chip bg-rose/20 border border-rose/40 text-rose">📺 SPECTATING</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setChatOpen(true)}
                  aria-label="Watchers chat"
                  className="relative w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-violet/50">
            💬
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose text-white rounded-full
                               min-w-[16px] h-[16px] px-1 text-[9px] font-bold grid place-items-center">
                {messages.length > 99 ? '99+' : messages.length}
              </span>
            )}
          </button>
          <button type="button" onClick={leave} aria-label="Leave watching"
                  className="w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-rose">≡</button>
        </div>
      </header>

      {/* Prediction bar — read-only when player count is 0, tap-to-vote
          otherwise. Each tile shows the vote share so spectators can see
          consensus form in real time. Server enforces one vote per
          spectator (last wins). */}
      <div className="absolute top-16 inset-x-0 z-20 pointer-events-none">
        <div className="flex flex-wrap justify-center gap-2 px-4 pointer-events-auto">
          <span className="chip bg-bg-2/80 border border-line text-ink-soft">
            🎯 Predict winner {totalVotes > 0 && <span className="ml-1 text-ink-faint">· {totalVotes} vote{totalVotes === 1 ? '' : 's'}</span>}
          </span>
          {players.map((p) => {
            const count = tally[p.id] || 0;
            const isMine = votedFor === p.id;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleVote(p.id)}
                disabled={p.abandoned}
                className={`chip border transition
                  ${isMine ? 'bg-violet text-white border-violet shadow-glow' :
                            'bg-bg-3/60 border-line hover:border-violet/50'}
                  ${p.abandoned ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={`Vote for ${p.username}`}
              >
                {p.username}
                {count > 0 && (
                  <span className={`ml-1.5 ${isMine ? 'text-white/80' : 'text-ink-faint'}`}>
                    {count}{totalVotes > 0 ? ` · ${pct}%` : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {topOpp && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-10">
          <OpponentPanel player={topOpp} isCurrent={false} back={back} />
        </div>
      )}
      {leftOpp && (
        <div className="absolute top-1/2 left-4 sm:left-8 -translate-y-1/2 z-10">
          <OpponentPanel player={leftOpp} isCurrent={false} back={back} />
        </div>
      )}
      {rightOpp && (
        <div className="absolute top-1/2 right-4 sm:right-8 -translate-y-1/2 z-10">
          <OpponentPanel player={rightOpp} isCurrent={false} back={back} />
        </div>
      )}

      <div className="absolute inset-0 grid place-items-center">
        <CenterTable
          topCard={state.topCard}
          drawPileSize={state.drawPileSize}
          direction={state.direction}
          pot={state.pot}
          canDraw={false}
          back={back}
        />
      </div>

      {/* Featured player (current turn) hand, face-up so spectators can
          follow the strategy. Shows the player's name + UNO badge in a chip. */}
      <div className="absolute bottom-0 inset-x-0 z-10 p-3 sm:p-5">
        <div className="flex justify-center mb-2">
          <div className="chip bg-bg-2/80 border border-line flex items-center gap-2">
            <span className="text-accent">●</span>
            {current?.username || '—'}
            <span className="text-accent font-extrabold tracking-wider uppercase">· On The Clock</span>
            {current?.saidUno && <span className="chip bg-accent text-bg shadow-glow-gold">UNO</span>}
          </div>
        </div>
        <div className="flex justify-center">
          <motion.div layout className="flex items-end -space-x-3">
            {currentHand.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                style={{ zIndex: i }}
              >
                <Card card={c} size="md" />
              </motion.div>
            ))}
            {currentHand.length === 0 && (
              <div className="text-ink-faint text-xs italic py-6">No hand info — waiting for state…</div>
            )}
          </motion.div>
        </div>
      </div>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        myId={user?.id}
        onSend={handleSend}
        title="📺 Watchers"
      />
    </div>
  );
}
