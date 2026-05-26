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
      turnTimeout: 10000,
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
    if (phase === TURN_PHASE.MUST_PLAY && this.current?.isBot) {
      if (this._botTimer) clearTimeout(this._botTimer);
      const me = this.current;
      // Harder bots react faster, easier bots feel more relaxed.
      const diff = this.settings.botDifficulty || 'medium';
      const base  = diff === 'hard' ? 900  : diff === 'easy' ? 1800 : 1500;
      const jitter = diff === 'hard' ? 700  : diff === 'easy' ? 1500 : 1200;
      this._botTimer = setTimeout(() => {
        if (this._phase === PHASE.PLAYING && this.current?.id === me.id && this.current?.isBot) {
          this._playBotTurn();
        }
      }, base + Math.random() * jitter);
    }
  }

  _startTurnTimer() {
    // Surface the deadline so the client can render a sync'd countdown ring.
    // The server stays authoritative on the timeout itself (this setTimeout);
    // the timestamp is purely informational for the UI.
    this._turnEndsAt = Date.now() + this.settings.turnTimeout;
    this._turnTimer = setTimeout(() => {
      if (this._phase !== PHASE.PLAYING) return;
      console.log(`[Timeout] ${this.current?.username} timed out — bot taking over`);
      if (this._turnPhase === TURN_PHASE.DREW_CARD) {
        this._drawnCard = null;
        this._drawnBy   = null;
        this._advance();
      } else {
        this._playBotTurn();
      }
    }, this.settings.turnTimeout);
  }

  _playBotTurn() {
    const player = this.current;
    if (!player || this._phase !== PHASE.PLAYING) return;
    const top = this._deck.top();

    if (this._stackDraw > 0) {
      const need = top?.value === VALUES.WILD_DRAW_FOUR
        ? [VALUES.WILD_DRAW_FOUR]
        : top?.value === VALUES.DRAW_TWO
          ? [VALUES.DRAW_TWO, VALUES.WILD_DRAW_FOUR]
          : [];
      const counter = player.handRaw.find(c => need.includes(c.value));
      const diff = this.settings.botDifficulty || 'medium';
      const counterChance = diff === 'hard' ? 1 : diff === 'easy' ? 0.25 : 0.5;
      if (counter && Math.random() < counterChance) {
        return this._botPlay(player, counter);
      }
      const cards = this._deck.drawMany(this._stackDraw);
      player.addCards(cards);
      this._log.unshift(`${player.username} (auto) took ${this._stackDraw} stack cards`);
      this._stackDraw = 0;
      this.emit('game:auto_played', {
        playerId: player.id, action: 'stack_taken', count: cards.length,
        players: this._players.map(p => p.toPublicJSON()),
      });
      this._advance();
      return;
    }

    const playable = player.getPlayable(top);
    if (playable.length > 0) {
      return this._botPlay(player, this._pickBotCard(player, playable));
    }

    const drawn = this._deck.draw();
    if (drawn) {
      player.addCards([drawn]);
      this._log.unshift(`${player.username} (auto) drew a card`);
      this.emit('game:auto_played', {
        playerId: player.id, action: 'drew', count: 1,
        players: this._players.map(p => p.toPublicJSON()),
      });
      if (this._rules.isPlayable(drawn, top)) {
        setTimeout(() => {
          if (this._phase === PHASE.PLAYING && this.current?.id === player.id) {
            this._botPlay(player, drawn);
          }
        }, 500);
        return;
      }
    }
    this._advance();
  }

  _botPlay(player, card) {
    if (card.isWild) card.chosenColor = this._pickBotColor(player);
    this._clearTimers();
    this._drawnCard = null;
    this._drawnBy   = null;

    player.removeCard(card.id);
    player.saidUno = false;
    this._deck.discard(card);
    this._log.unshift(`${player.username} (auto) played ${card.toString()}`);

    if (player.hasWon()) return this._handleWin(player, card);

    const eff = this._rules.resolve(card, this._players.length, this._dir, this._curIdx);
    if (eff.dirChanged) {
      this._dir = eff.newDir;
      this.emit(EV.DIR, { direction: this._dir });
    } else {
      this._dir = eff.newDir;
    }
    if (eff.draw > 0) this._stackDraw += eff.draw;
    this._curIdx = eff.nextIdx;

    this.emit('game:auto_played', {
      playerId: player.id,
      action: 'played',
      card: card.toJSON(),
      topCard: this._deck.top()?.toJSON(),
      players: this._players.map(p => p.toPublicJSON()),
    });

    this._setTurnPhase(TURN_PHASE.MUST_PLAY);
    this._startTurnTimer();
    this._broadcastState();
  }

  // Choose which playable card a bot plays, scaled by difficulty.
  //  easy   → fully random
  //  medium → sheds number cards, saves actions to punish a close opponent
  //  hard   → punishes a near-winning opponent hard, otherwise dumps the
  //           heaviest point load and hoards wilds for later
  _pickBotCard(player, playable) {
    const diff = this.settings.botDifficulty || 'medium';
    const rand = () => playable[Math.floor(Math.random() * playable.length)];
    if (diff === 'easy' || playable.length === 1) return rand();

    // Biggest threat = fewest cards among the other active players.
    const minOpp = this._players
      .filter(p => p.id !== player.id && p.status === 'active')
      .reduce((m, p) => Math.min(m, p.handRaw.length), 99);
    const threat = minOpp <= 2;

    const wildD4 = playable.filter(c => c.value === VALUES.WILD_DRAW_FOUR);
    const draw2  = playable.filter(c => c.value === VALUES.DRAW_TWO);
    const skips  = playable.filter(c => c.value === VALUES.SKIP || c.value === VALUES.REVERSE);
    const wilds  = playable.filter(c => c.value === VALUES.WILD);
    const nums   = playable.filter(c => !c.isWild && !c.isAction)
                           .sort((a, b) => b.points - a.points);

    if (diff === 'hard') {
      if (threat) {
        if (wildD4.length) return wildD4[0];
        if (draw2.length)  return draw2[0];
        if (skips.length)  return skips[0];
      }
      if (nums.length)   return nums[0];
      if (skips.length)  return skips[0];
      if (draw2.length)  return draw2[0];
      if (wilds.length)  return wilds[0];
      return wildD4[0] || rand();
    }

    // medium
    if (threat && (draw2.length || skips.length)) return draw2[0] || skips[0];
    if (nums.length) return nums[0];
    return rand();
  }

  _pickBotColor(player) {
    const counts = { red:0, blue:0, green:0, yellow:0 };
    player.handRaw.forEach(c => {
      if (counts[c.color] !== undefined) counts[c.color]++;
    });
    const max = Math.max(...Object.values(counts));
    if (max === 0) {
      const colors = ['red','blue','green','yellow'];
      return colors[Math.floor(Math.random() * 4)];
    }
    const best = Object.keys(counts).filter(k => counts[k] === max);
    return best[Math.floor(Math.random() * best.length)];
  }

  _clearTimers() {
    if (this._turnTimer) { clearTimeout(this._turnTimer); this._turnTimer = null; }
    if (this._drawTimer) { clearTimeout(this._drawTimer); this._drawTimer = null; }
    if (this._botTimer)  { clearTimeout(this._botTimer);  this._botTimer  = null; }
    this._turnEndsAt = null;
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
    const mvp = this._pickMVP(winner);
    const wd = {
      winnerId:winner.id, username:winner.username, lastCard:lastCard.toJSON(),
      score, coinsEarned:totalWin, bet,
      mvp,
      stats: this._players.map(p => ({
        id: p.id, username: p.username, avatar: p.avatar,
        cardsPlayed: p.stats?.cardsPlayed || 0,
        cardsDrawn:  p.stats?.cardsDrawn || 0,
        finalHand:   p.handSize,
      })),
    };
    this.emit(EV.WON, wd);
    this.emit(EV.OVER, { winners:this._winners.map(p=>p.toPublicJSON()), players:this._players.map(p=>p.toJSON()), mvp, stats: wd.stats });
    return { success:true, winner:wd };
  }

  // Man of the Match — picks the player with the best impact score.
  // The winner gets a fixed bonus, then we add efficiency (cards played
  // minus cards drawn) so an active winner beats a passive one, and a
  // cunning loser can still steal the honor.
  _pickMVP(winner) {
    let best = null;
    let bestScore = -Infinity;
    this._players.forEach(p => {
      const played = p.stats?.cardsPlayed || 0;
      const drawn  = p.stats?.cardsDrawn  || 0;
      const winnerBonus = p.id === winner.id ? 8 : 0;
      const score = played * 2 - drawn + winnerBonus;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (!best) return null;
    return {
      id: best.id,
      username: best.username,
      avatar: best.avatar,
      cardsPlayed: best.stats?.cardsPlayed || 0,
      cardsDrawn:  best.stats?.cardsDrawn  || 0,
      reason: best.id === winner.id
        ? `Won the game with ${best.stats?.cardsPlayed || 0} plays`
        : `Played ${best.stats?.cardsPlayed || 0} cards — most active`,
    };
  }

  _find(id) { return this._players.find(p => p.id === id) || null; }

  // Reset everything game-state-related so a fresh round can start in
  // the same room with the same players (used by League best-of-2).
  // Players keep their identities; deck, hands, turn, direction reset.
  resetForNextGame() {
    this._clearTimers();
    this._deck = new Deck();
    this._winners = [];
    this._phase = PHASE.LOBBY;
    this._curIdx = 0;
    this._dir = DIR.CW;
    this._turnPhase = TURN_PHASE.WAITING;
    this._stackDraw = 0;
    this._drawnCard = null;
    this._drawnBy = null;
    this._players.forEach(p => {
      p.setHand([]);
      p.saidUno = false;
      p.status = 'active';
    });
  }

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
      // Turn deadline (epoch ms) + the configured timeout total. Clients can
      // compute (turnEndsAt - Date.now()) / turnTimeout for the ring fill.
      // Server stays authoritative on the actual timeout; this is purely UI.
      turnEndsAt:   this._turnEndsAt || null,
      turnTimeout:  this.settings.turnTimeout,
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

  // Spectator state: public state + every player's full hand visible
  _spectatorState() {
    return {
      ...this._publicState(),
      isSpectator: true,
      hands: this._players.map(p => ({
        playerId: p.id,
        cards:    p.hand.map(c => c.toJSON()),
      })),
    };
  }

  get current()   { return this._players[this._curIdx] || null; }
  get phase()     { return this._phase; }
  get players()   { return this._players; }
  get direction() { return this._dir; }
  get isActive()  { return this._phase === PHASE.PLAYING; }
}

module.exports = { GameManager, PHASE, EV };
