'use strict';

const EventEmitter = require('events');
const { Deck }     = require('./Deck');
const { Player }   = require('./Player');
const { RulesEngine, DIR } = require('./RulesEngine');
const { Card, VALUES, COLORS } = require('./Card');

const PHASE = Object.freeze({
  LOBBY:'lobby', PLAYING:'playing', FINISHED:'finished',
});

const EV = Object.freeze({
  STARTED:'game:started', CARD_PLAYED:'card:played',
  TURN:'turn:changed', COLOR:'color:chosen',
  UNO:'uno:called', CAUGHT:'uno:caught',
  WON:'player:won', OVER:'game:over',
  JOINED:'player:joined', LEFT:'player:left',
  DIR:'direction:changed',
});

const TURN_PHASE = Object.freeze({
  MUST_PLAY: 'must_play',
  DREW_CARD: 'drew_card',
  WAITING:   'waiting',
});

class GameManager extends EventEmitter {
  constructor(roomId, settings = {}) {
    super();
    this.roomId   = roomId;
    this.settings = {
      maxPlayers:  4,
      minPlayers:  2,
      handSize:    7,
      turnTimeout: 30000,
      ...settings
    };
    this._deck      = new Deck();
    this._rules     = new RulesEngine(settings);
    this._players   = [];
    this._phase     = PHASE.LOBBY;
    this._dir       = DIR.CW;
    this._curIdx    = 0;
    this._winners   = [];
    this._log       = [];
    this._turnTimer = null;
    this._drawTimer = null;
    this._drawnCard = null;
    this._drawnBy   = null;
    this._turnPhase = TURN_PHASE.WAITING;
    this._stackDraw = 0;
  }

  // ── Players ──

  addPlayer(player) {
    if (this._phase !== PHASE.LOBBY)                      return { success:false, reason:'Game started' };
    if (this._players.length >= this.settings.maxPlayers) return { success:false, reason:'Room full' };
    if (this._players.find(p => p.id === player.id))      return { success:false, reason:'Already in room' };
    if (this._players.length === 0) player.isHost = true;
    this._players.push(player);
    this.emit(EV.JOINED, { player:player.toPublicJSON() });
    return { success:true };
  }

  removePlayer(id) {
    const idx = this._players.findIndex(p => p.id === id);
    if (idx === -1) return;
    const p = this._players[idx];
    if (this._phase === PHASE.LOBBY) {
      this._players.splice(idx, 1);
      if (p.isHost && this._players.length > 0) this._players[0].isHost = true;
    } else {
      p.setDisconnected();
      // FIX: if it's their turn, clear timers and advance
      if (this._curIdx === idx) {
        this._clearTimers();
        this._drawnCard = null;
        this._drawnBy   = null;
        this._forceAdvance();
      }
    }
    this.emit(EV.LEFT, { playerId:id, username:p.username });
  }

  // ── Start ──

  startGame(requesterId) {
    const host = this._players.find(p => p.id === requesterId);
    if (!host?.isHost)                                    return { success:false, reason:'Only host can start' };
    if (this._players.length < this.settings.minPlayers) return { success:false, reason:`Need ${this.settings.minPlayers}+ players` };
    if (this._phase !== PHASE.LOBBY)                      return { success:false, reason:'Already started' };

    this._deck.buildAndShuffle();
    const hands = this._deck.dealHands(this._players.length, this.settings.handSize);
    this._players.forEach((p,i) => {
      p.setHand(hands[i].map(c => Card.fromJSON(c.toJSON())));
      p.status = 'active';
    });

    const first = this._deck.initFirst();
    this._dir    = DIR.CW;
    this._curIdx = 0;
    this._applyFirstCard(first);
    this._phase  = PHASE.PLAYING;
    this._setTurnPhase(TURN_PHASE.MUST_PLAY);
    this._startTurnTimer();
    this.emit(EV.STARTED, this._publicState());
    return { success:true };
  }

  _applyFirstCard(card) {
    if (!card) return;
    switch(card.value) {
      case VALUES.SKIP:
        this._curIdx = this._rules.nextIdx(this._curIdx, this._players.length, this._dir, 1);
        break;
      case VALUES.REVERSE:
        this._dir = DIR.CCW;
        if (this._players.length === 2) {
          this._curIdx = this._rules.nextIdx(this._curIdx, this._players.length, this._dir, 1);
        }
        break;
      case VALUES.DRAW_TWO:
        // First player draws 2 and turn passes
        const firstPlayer = this._players[this._curIdx];
        if (firstPlayer) firstPlayer.addCards(this._deck.drawMany(2));
        this._curIdx = this._rules.nextIdx(this._curIdx, this._players.length, this._dir, 1);
        break;
      case VALUES.WILD:
        card.chosenColor = COLORS.RED;
        break;
      // WILD_DRAW_FOUR is re-drawn in Deck.initFirst()
    }
  }

  // ── Play Card ──

  playCard(playerId, cardId, chosenColor = null) {
    if (this._phase !== PHASE.PLAYING)         return { success:false, reason:'Game not active' };
    if (playerId !== this.current?.id)          return { success:false, reason:'Not your turn' };
    if (this._turnPhase === TURN_PHASE.WAITING) return { success:false, reason:'Not your turn' };

    const player = this._find(playerId);
    if (!player) return { success:false, reason:'Player not found' };

    const card = player.handRaw.find(c => c.id === cardId);
    if (!card) return { success:false, reason:'Card not in hand' };

    const top = this._deck.top();

    // Draw stacking
    if (this._stackDraw > 0) {
      const canStack = card.value === 'draw_two' || card.value === 'wild_draw_four';
      if (!canStack) {
        return { success:false, reason:`Stack active! Play +2 or +4 to counter, or draw ${this._stackDraw} cards` };
      }
    } else {
      const v = this._rules.validate(player, card, top, this.current.id);
      if (!v.ok) return { success:false, reason:v.reason };
    }

    if (card.isWild) {
      if (!chosenColor || !this._rules.isValidColor(chosenColor)) {
        return { success:false, reason:'Choose a color for wild card' };
      }
      card.chosenColor = chosenColor;
    }

    this._clearTimers();
    this._drawnCard = null;
    this._drawnBy   = null;

    player.removeCard(cardId);
    player.saidUno = false;
    this._deck.discard(card);
    this._log.unshift(`${player.username} played ${card.toString()}`);

    if (player.hasWon()) return this._handleWin(player, card);

    const eff = this._rules.resolve(card, this._players.length, this._dir, this._curIdx);

    if (eff.dirChanged) {
      this._dir = eff.newDir;
      this.emit(EV.DIR, { direction:this._dir });
    } else {
      this._dir = eff.newDir;
    }

    if (eff.draw > 0) {
      this._stackDraw += eff.draw;
      this._curIdx = eff.nextIdx;
    } else {
      this._curIdx = eff.nextIdx;
    }

    this._setTurnPhase(TURN_PHASE.MUST_PLAY);
    this._startTurnTimer();
    this._broadcastState();

    return {
      success: true,
      eventData: {
        playerId,
        card: card.toJSON(),
        topCard: this._deck.top()?.toJSON(),
        players: this._players.map(p => p.toPublicJSON()),
      }
    };
  }

  // ── Draw Card ──

  drawCard(playerId) {
    if (this._phase !== PHASE.PLAYING)            return { success:false, reason:'Game not active' };
    if (playerId !== this.current?.id)             return { success:false, reason:'Not your turn' };
    if (this._turnPhase !== TURN_PHASE.MUST_PLAY)  return { success:false, reason:'Already drew a card' };

    const player = this._find(playerId);
    if (!player) return { success:false, reason:'Player not found' };

    // If stack active — take all stacked draws
    if (this._stackDraw > 0) {
      const amount    = this._stackDraw;
      this._stackDraw = 0;
      const cards     = this._deck.drawMany(amount);
      player.addCards(cards);
      this._log.unshift(`${player.username} drew ${amount} stacked cards`);
      this._advance();
      // FIX: return proper data for stack draw
      return { success:true, card:null, cards, count:amount, canPlay:false, wasStack:true };
    }

    // Normal single draw
    const card = this._deck.draw();
    if (!card) return { success:false, reason:'No cards left' };

    player.addCards([card]);
    const canPlay = this._rules.isPlayable(card, this._deck.top());
    this._log.unshift(`${player.username} drew a card`);

    if (!canPlay) {
      this._clearTimers();
      this._advance();
      return { success:true, card, canPlay:false, wasStack:false };
    }

    this._clearTimers();
    this._drawnCard = card;
    this._drawnBy   = playerId;
    this._setTurnPhase(TURN_PHASE.DREW_CARD);

    this._drawTimer = setTimeout(() => {
      if (this._drawnBy === playerId && this._phase === PHASE.PLAYING) {
        this._forceAdvance();
      }
    }, 10000);

    this._broadcastState(true);
    return { success:true, card, canPlay:true, wasStack:false };
  }

  // ── Pass Turn ──
  // FIX: now checks if it's actually the player's turn

  passTurn(playerId) {
    if (this._phase !== PHASE.PLAYING) return { success:false, reason:'Not active' };
    if (playerId !== this.current?.id) return { success:false, reason:'Not your turn' };

    this._clearTimers();
    this._drawnCard = null;
    this._drawnBy   = null;
    this._advance();
    return { success:true };
  }

  // ── UNO ──

  callUno(playerId) {
    const player = this._find(playerId);
    if (!player) return { success:false, reason:'Not found' };
    if (player.handSize !== 1) return { success:false, reason:'Need 1 card' };
    player.saidUno = true;
    this.emit(EV.UNO, { playerId, username:player.username });
    return { success:true };
  }

  catchUno(catcherId, targetId) {
    const target = this._find(targetId);
    if (!target || target.handSize !== 1 || target.saidUno) return { success:false, reason:'Cannot catch' };
    target.addCards(this._deck.drawMany(2));
    this.emit(EV.CAUGHT, { catcherId, targetId, penaltyCards:2, targetPublic:target.toPublicJSON() });
    this._broadcastState();
    return { success:true, penaltyCards:2 };
  }

  chooseColor(playerId, color) {
    const player = this._find(playerId);
    if (!player || !this._rules.isValidColor(color)) return { success:false };
    const top = this._deck.top();
    if (top?.isWild) top.chosenColor = color;
    this.emit(EV.COLOR, { playerId, color, topCard:top?.toJSON() });
    return { success:true };
  }

  // ── Internal ──

  _advance() {
    this._clearTimers();
    // Skip disconnected players
    let attempts = 0;
    do {
      this._curIdx = this._rules.nextIdx(this._curIdx, this._players.length, this._dir, 1);
      attempts++;
    } while (
      this._players[this._curIdx] &&
      !this._players[this._curIdx].isConnected &&
      attempts < this._players.length
    );
    this._setTurnPhase(TURN_PHASE.MUST_PLAY);
    this._startTurnTimer();
    this._broadcastState();
  }

  _forceAdvance() {
    this._clearTimers();
    this._drawnCard = null;
    this._drawnBy   = null;
    this._stackDraw = 0;
    this._advance();
  }

  _setTurnPhase(phase) {
    this._turnPhase = phase;
    console.log(`[Turn] ${this.current?.username} → ${phase}`);
  }

  _startTurnTimer() {
    this._turnTimer = setTimeout(() => {
      if (this._phase !== PHASE.PLAYING) return;
      console.log(`[Timeout] ${this.current?.username} timed out`);
      if (this._turnPhase === TURN_PHASE.DREW_CARD) {
        this._drawnCard = null;
        this._drawnBy   = null;
        this._advance();
      } else {
        const p = this.current;
        if (p) {
          const c = this._deck.draw();
          if (c) p.addCards([c]);
        }
        this._advance();
      }
    }, this.settings.turnTimeout);
  }

  _clearTimers() {
    if (this._turnTimer) { clearTimeout(this._turnTimer); this._turnTimer = null; }
    if (this._drawTimer) { clearTimeout(this._drawTimer); this._drawTimer = null; }
  }

  _broadcastState(afterDraw = false) {
    this.emit(EV.TURN, {
      currentPlayerId: this.current?.id,
      direction:       this._dir,
      drawPileSize:    this._deck.drawSize,
      topCard:         this._deck.top()?.toJSON(),
      turnPhase:       this._turnPhase,
      drawnCardId:     this._drawnCard?.id || null,
      stackDraw:       this._stackDraw,
      afterDraw,
    });
  }

  _handleWin(winner, lastCard) {
    this._clearTimers();
    this._winners.push(winner);
    const losers = this._players.filter(p => p.id !== winner.id);
    const score  = this._rules.calcScore(losers);
    const bet = this.settings.bet || 0;
    const totalWin = bet * losers.length + this._rules.calcCoins(score);
    // Don't modify coins here — server game:over handler does it
    this._phase = PHASE.FINISHED;
    const wd = { winnerId:winner.id, username:winner.username, lastCard:lastCard.toJSON(), score, coinsEarned:totalWin, bet };
    this.emit(EV.WON, wd);
    this.emit(EV.OVER, { winners:this._winners.map(p=>p.toPublicJSON()), players:this._players.map(p=>p.toJSON()) });
    return { success:true, winner:wd };
  }

  _find(id) { return this._players.find(p => p.id === id) || null; }

  _publicState() {
    return {
      roomId:       this.roomId,
      phase:        this._phase,
      direction:    this._dir,
      currentTurn:  this.current?.id,
      topCard:      this._deck.top()?.toJSON(),
      drawPileSize: this._deck.drawSize,
      players:      this._players.map(p => p.toPublicJSON()),
      turnPhase:    this._turnPhase,
      drawnCardId:  this._drawnCard?.id || null,
      stackDraw:    this._stackDraw,
    };
  }

  _playerState(player) {
    const top      = this._deck.top();
    const playable = player.getPlayable(top).map(c => c.id);
    return {
      ...this._publicState(),
      myHand:     player.hand.map(c => c.toJSON()),
      myPlayable: playable,
    };
  }

  get current()   { return this._players[this._curIdx] || null; }
  get phase()     { return this._phase; }
  get players()   { return this._players; }
  get direction() { return this._dir; }
  get isActive()  { return this._phase === PHASE.PLAYING; }
}

module.exports = { GameManager, PHASE, EV };
