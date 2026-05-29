import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CenterTable from './CenterTable';
import OpponentPanel from './OpponentPanel';
import TurnTimer from './TurnTimer';
import Card from './Card';
import useEquippedBack from '../../hooks/useEquippedBack';

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
        <button type="button" onClick={leave}
                className="w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-rose">≡</button>
      </header>

      {topOpp && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
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
            <span className="text-accent font-bold">— On the clock</span>
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
    </div>
  );
}
