import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { gameApi } from '../../api/game';
import CenterTable from './CenterTable';
import MyHand from './MyHand';
import OpponentPanel from './OpponentPanel';
import TurnTimer from './TurnTimer';
import ActionBar from './ActionBar';
import ColorPicker from './ColorPicker';

// In-game assembly. Reads from a `state` snapshot (per-player game:state
// from the server) and routes player actions back via gameApi.
//
// Layout:
//   ─ top:    timer + room/menu controls + the "top" opponent
//   ─ middle: left opponent | CenterTable | right opponent
//   ─ bottom: my hand + action bar
//
// Opponent placement is order-driven from the players array — we rotate
// the array so the current user sits at index 0, then position the rest
// at top/left/right based on remaining count (1→top, 2→left+right,
// 3→left+top+right). Symmetry beats correctness here; this is presentation
// only, the server doesn't care.

export default function GameScreen({ state, onLeave }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pendingWildId, setPendingWildId] = useState(null);

  const meId = user?.id;
  const players = state?.players || [];
  const myIdx   = players.findIndex((p) => p.id === meId);
  const me      = myIdx >= 0 ? players[myIdx] : null;
  const opponents = useMemo(() => {
    if (myIdx < 0) return players;
    return [...players.slice(myIdx + 1), ...players.slice(0, myIdx)];
  }, [players, myIdx]);

  const myTurn      = state?.currentTurn === meId;
  const turnPhase   = state?.turnPhase;
  const drawnCardId = state?.drawnCardId;
  // Server uses turnPhase: 'turn_start' | 'after_draw' | 'between_turns'
  // — after_draw is when the player has just drawn and may still play it.
  const canDraw     = myTurn && turnPhase !== 'after_draw';
  const canPass     = myTurn && turnPhase === 'after_draw';
  const canUno      = myTurn && me?.handSize === 2;        // about to drop to 1

  const handlePlay = async (card) => {
    if (card.isWild) {
      setPendingWildId(card.id);
      return;
    }
    const res = await gameApi.playCard(card.id, null);
    if (res?.success === false) toast.error(res.reason || 'Cannot play');
  };

  const handleWildPick = async (color) => {
    const id = pendingWildId;
    setPendingWildId(null);
    if (!id) return;
    const res = await gameApi.playCard(id, color);
    if (res?.success === false) toast.error(res.reason || 'Cannot play');
  };

  const handleDraw = async () => {
    const res = await gameApi.drawCard();
    if (res?.success === false) toast.error(res.reason || 'Cannot draw');
  };

  const handlePass = async () => {
    const res = await gameApi.pass();
    if (res?.success === false) toast.error(res.reason || 'Cannot pass');
  };

  const handleUno = async () => {
    const res = await gameApi.callUno();
    if (res?.success === false) toast.error(res.reason || 'Cannot call UNO');
  };

  const handleCatchUno = async (targetId) => {
    const res = await gameApi.catchUno(targetId);
    if (res?.success === false) toast.error(res.reason || 'Catch failed');
    else if (res?.success) toast.success('Caught! +2 to them.');
  };

  const handleLeave = async () => {
    if (!confirm('Leave the match? You forfeit the pot.')) return;
    await gameApi.leaveRoom();
    if (onLeave) onLeave();
    else navigate('/');
  };

  if (!state) {
    return <div className="h-full grid place-items-center text-ink-soft animate-pulse">Dealing cards…</div>;
  }

  // Position opponents around the table. We support up to 3 opponents
  // (4-player rooms) — the most populous configuration.
  const leftOpp   = opponents.length >= 2 ? opponents[0] : null;
  const topOpp    = opponents.length === 1 ? opponents[0]
                  : opponents.length >= 2 ? opponents[1] : null;
  const rightOpp  = opponents.length >= 3 ? opponents[2] : null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Header strip */}
      <header className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-20">
        <TurnTimer endsAt={state.turnEndsAt} totalMs={state.turnTimeout || 30000} label="Turn" />
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Chat" className="w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-violet/50">💬</button>
          <button type="button" aria-label="Menu" onClick={handleLeave} className="w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-rose">≡</button>
        </div>
      </header>

      {/* Top opponent */}
      {topOpp && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          <OpponentPanel player={topOpp} isCurrent={state.currentTurn === topOpp.id} onCatchUno={handleCatchUno} position="top" />
        </div>
      )}
      {/* Left opponent */}
      {leftOpp && (
        <div className="absolute top-1/2 left-4 sm:left-8 -translate-y-1/2 z-10">
          <OpponentPanel player={leftOpp} isCurrent={state.currentTurn === leftOpp.id} onCatchUno={handleCatchUno} position="left" />
        </div>
      )}
      {/* Right opponent */}
      {rightOpp && (
        <div className="absolute top-1/2 right-4 sm:right-8 -translate-y-1/2 z-10">
          <OpponentPanel player={rightOpp} isCurrent={state.currentTurn === rightOpp.id} onCatchUno={handleCatchUno} position="right" />
        </div>
      )}

      {/* Center */}
      <div className="absolute inset-0 grid place-items-center">
        <CenterTable
          topCard={state.topCard}
          drawPileSize={state.drawPileSize}
          direction={state.direction}
          pot={state.pot}
          onDraw={handleDraw}
          canDraw={canDraw}
        />
      </div>

      {/* Bottom: hand + action bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 p-3 sm:p-5 flex items-end gap-3">
        <div className="flex-1 min-w-0">
          {me && (
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <div className="chip bg-bg-2/80 border border-line">
                <span className="text-accent">●</span>
                {me.username}
                {myTurn && <span className="text-accent font-bold ml-1">— Your turn</span>}
              </div>
            </div>
          )}
          <MyHand
            hand={state.myHand || []}
            playable={state.myPlayable || []}
            myTurn={myTurn}
            onPlayCard={handlePlay}
          />
        </div>
        <ActionBar
          myTurn={myTurn}
          canUno={canUno}
          canDraw={canDraw}
          canPass={canPass}
          onUno={handleUno}
          onDraw={handleDraw}
          onPass={handlePass}
        />
      </div>

      <ColorPicker
        open={!!pendingWildId}
        onPick={handleWildPick}
        onCancel={() => setPendingWildId(null)}
      />
    </div>
  );
}
