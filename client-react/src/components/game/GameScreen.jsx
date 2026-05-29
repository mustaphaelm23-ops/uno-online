import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { gameApi } from '../../api/game';
import useRoomSocial from '../../hooks/useRoomSocial';
import useEquippedBack from '../../hooks/useEquippedBack';
import CenterTable from './CenterTable';
import MyHand from './MyHand';
import OpponentPanel from './OpponentPanel';
import TurnTimer from './TurnTimer';
import ActionBar from './ActionBar';
import ColorPicker from './ColorPicker';
import SocialBar from './SocialBar';
import ChatPanel from './ChatPanel';
import SpeechBubble from './SpeechBubble';
import ReactionFly from './ReactionFly';
import FlyingCard from './FlyingCard';

// In-game assembly. Reads from a `state` snapshot (per-player game:state
// from the server) and routes player actions back via gameApi. Owns the
// social stream so bubbles/reactions land on the right opponent panels
// without each component subscribing separately.

export default function GameScreen({ state, onLeave }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pendingWildId, setPendingWildId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { messages, bubbles, reactions, echoReaction, echoBubble } = useRoomSocial();
  const back = useEquippedBack();

  // Card-fly state — when state.topCard.id changes (someone played), we
  // dispatch a transient FlyingCard animation from the source player's
  // panel to the discard pile. Source = the player whose turn it WAS
  // before the change (currentTurn rolls forward after each play).
  const prevTopRef     = useRef(null);
  const prevTurnRef    = useRef(null);
  const [flyingCard, setFlyingCard] = useState(null);

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

  // Detect plays and infer the source for the fly animation. We compare
  // against the PREVIOUS topCard.id to know a card was played; the
  // PREVIOUS currentTurn tells us by whom. Skipping the first state
  // (no previous) and any state where the topCard didn't change.
  useEffect(() => {
    const topId = state?.topCard?.id;
    if (!topId) return;
    if (prevTopRef.current && prevTopRef.current !== topId) {
      const sourceId = prevTurnRef.current;
      const idx = players.findIndex((p) => p.id === sourceId);
      let from = 'top';
      if (idx >= 0) {
        if (sourceId === meId)               from = 'me';
        else {
          // Reuse the same rotated-opponent ordering used for layout.
          const rotated = [...players.slice(myIdx + 1), ...players.slice(0, myIdx)];
          const oIdx = rotated.findIndex((p) => p.id === sourceId);
          if (rotated.length === 1)            from = 'top';
          else if (rotated.length === 2)       from = oIdx === 0 ? 'left' : 'top';
          else if (rotated.length >= 3)        from = ['left', 'top', 'right'][oIdx] || 'top';
        }
      }
      const flyKey = `${topId}_${Date.now()}`;
      setFlyingCard({ key: flyKey, from, card: state.topCard });
      // Auto-clear after the animation window so it doesn't pile up.
      setTimeout(() => {
        setFlyingCard((cur) => (cur?.key === flyKey ? null : cur));
      }, 700);
    }
    prevTopRef.current  = topId;
    prevTurnRef.current = state?.currentTurn;
  }, [state?.topCard?.id, state?.currentTurn, players, myIdx, meId]);

  const canDraw     = myTurn && turnPhase !== 'after_draw';
  const canPass     = myTurn && turnPhase === 'after_draw';
  const canUno      = myTurn && me?.handSize === 2;

  const handlePlay = async (card) => {
    if (card.isWild) { setPendingWildId(card.id); return; }
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

  const handleQuickChat = async (preset) => {
    // Local echo so the bubble fires the instant the user taps — server
    // will also echo back via chat:quick, the hook dedupes by id.
    if (meId) echoBubble(meId, preset.text, preset.id, user?.username);
    const res = await gameApi.quickChat(preset.id);
    if (res?.success === false && res.reason === 'rate_limit') {
      toast.info('Slow down — quick chat throttled');
    }
  };

  const handleReaction = (emoji) => {
    // Server EXCLUDES sender from the broadcast (by design — sender already
    // animates locally), so we echo locally here.
    if (meId) echoReaction(meId, emoji);
    gameApi.reaction(emoji);
  };

  const handleChatSend = async (text) => {
    const res = await gameApi.chatSend(text);
    if (res?.success === false) toast.error(res.reason || 'Chat failed');
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

  // Position opponents around the table.
  const leftOpp   = opponents.length >= 2 ? opponents[0] : null;
  const topOpp    = opponents.length === 1 ? opponents[0]
                  : opponents.length >= 2 ? opponents[1] : null;
  const rightOpp  = opponents.length >= 3 ? opponents[2] : null;

  const reactionsFor = (pid) => reactions.filter((r) => r.playerId === pid);
  const bubbleFor    = (pid) => bubbles[pid] || null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Header strip */}
      <header className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-20">
        <TurnTimer endsAt={state.turnEndsAt} totalMs={state.turnTimeout || 30000} label="Turn" />
        <button type="button" aria-label="Leave" onClick={handleLeave}
                className="w-9 h-9 rounded-full bg-bg-2/80 border border-line grid place-items-center hover:border-rose">
          ≡
        </button>
      </header>

      {topOpp && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          <OpponentPanel
            player={topOpp}
            isCurrent={state.currentTurn === topOpp.id}
            onCatchUno={handleCatchUno}
            position="top"
            bubble={bubbleFor(topOpp.id)}
            reactions={reactionsFor(topOpp.id)}
            back={back}
          />
        </div>
      )}
      {leftOpp && (
        <div className="absolute top-1/2 left-4 sm:left-8 -translate-y-1/2 z-10">
          <OpponentPanel
            player={leftOpp}
            isCurrent={state.currentTurn === leftOpp.id}
            onCatchUno={handleCatchUno}
            position="left"
            bubble={bubbleFor(leftOpp.id)}
            reactions={reactionsFor(leftOpp.id)}
            back={back}
          />
        </div>
      )}
      {rightOpp && (
        <div className="absolute top-1/2 right-4 sm:right-8 -translate-y-1/2 z-10">
          <OpponentPanel
            player={rightOpp}
            isCurrent={state.currentTurn === rightOpp.id}
            onCatchUno={handleCatchUno}
            position="right"
            bubble={bubbleFor(rightOpp.id)}
            reactions={reactionsFor(rightOpp.id)}
            back={back}
          />
        </div>
      )}

      {/* Center */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative">
          <CenterTable
            topCard={state.topCard}
            drawPileSize={state.drawPileSize}
            direction={state.direction}
            pot={state.pot}
            onDraw={handleDraw}
            canDraw={canDraw}
            back={back}
          />
          <AnimatePresence>
            {flyingCard && (
              <FlyingCard key={flyingCard.key} from={flyingCard.from} card={flyingCard.card} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom: hand + action bar */}
      <div className="absolute bottom-0 inset-x-0 z-10 p-3 sm:p-5 flex items-end gap-3">
        <div className="flex-1 min-w-0 relative">
          {me && (
            <div className="flex items-center justify-center gap-2 mb-1.5 relative">
              <div className="chip bg-bg-2/80 border border-line">
                <span className="text-accent">●</span>
                {me.username}
                {myTurn && <span className="text-accent font-bold ml-1">— Your turn</span>}
              </div>
              {/* My own bubble + reactions float above the chip */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-10">
                <AnimatePresence>
                  {bubbleFor(meId) && <SpeechBubble key={bubbleFor(meId).id} text={bubbleFor(meId).text} />}
                </AnimatePresence>
                <AnimatePresence>
                  {reactionsFor(meId).map((r, i) => (
                    <ReactionFly key={r.id} emoji={r.emoji} seed={i + 1} />
                  ))}
                </AnimatePresence>
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
        <div className="flex flex-col gap-3 items-end">
          <ActionBar
            myTurn={myTurn}
            canUno={canUno}
            canDraw={canDraw}
            canPass={canPass}
            onUno={handleUno}
            onDraw={handleDraw}
            onPass={handlePass}
          />
          <SocialBar
            onOpenChat={() => setChatOpen(true)}
            onQuickChat={handleQuickChat}
            onReaction={handleReaction}
          />
        </div>
      </div>

      <ColorPicker
        open={!!pendingWildId}
        onPick={handleWildPick}
        onCancel={() => setPendingWildId(null)}
      />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        myId={meId}
        onSend={handleChatSend}
      />
    </div>
  );
}
