/**
 * Player.js - Player entity
 */
'use strict';

const { Card } = require('./Card');

class Player {
  constructor(id, username, coins = 100) {
    this.id       = id;
    this.username = username;
    this.coins    = coins;
    this.avatar   = null;
    this._hand    = [];
    this.isHost   = false;
    this.saidUno  = false;
    this.isConnected = true;
    this.socketId    = null;
    this.status      = 'waiting';
    // P4-NEW.1a — set true when a disconnected player exceeds the 30s grace
    // window. The bot keeps playing their seat, but they're excluded from
    // pot payouts at match-end (forfeit rule, GDD §5.5).
    this.abandoned   = false;
    this.stats = { cardsPlayed:0, cardsDrawn:0, gamesWon:0, gamesLost:0 };
  }

  addCards(cards) {
    const arr = Array.isArray(cards) ? cards : [cards];
    this._hand.push(...arr);
    this.stats.cardsDrawn += arr.length;
    if (this._hand.length > 1) this.saidUno = false;
    return this;
  }

  removeCard(id) {
    const i = this._hand.findIndex(c => c.id === id);
    if (i === -1) return null;
    const [c] = this._hand.splice(i, 1);
    this.stats.cardsPlayed++;
    return c;
  }

  setHand(cards) { this._hand = [...cards]; }

  hasCard(id) { return this._hand.some(c => c.id === id); }

  getPlayable(topCard) {
    return this._hand.filter(c => c.canPlayOn(topCard));
  }

  canPlay(topCard) { return this.getPlayable(topCard).length > 0; }

  handPoints() { return this._hand.reduce((s,c) => s + c.points, 0); }

  hasWon() { return this._hand.length === 0; }

  get hand()     { return [...this._hand]; }
  get handRaw()  { return this._hand; }
  get handSize() { return this._hand.length; }

  setConnected(socketId) {
    this.socketId = socketId; this.isConnected = true; this.status = 'active';
  }
  setDisconnected() { this.isConnected = false; this.status = 'disconnected'; }

  toJSON() {
    return {
      id:this.id, username:this.username, coins:this.coins, avatar:this.avatar,
      hand:this._hand.map(c=>c.toJSON()), handSize:this._hand.length,
      isHost:this.isHost, saidUno:this.saidUno,
      isConnected:this.isConnected, status:this.status,
      abandoned:this.abandoned||false,                 // P4-NEW.1a
      stats:{...this.stats},
    };
  }

  toPublicJSON() {
    return {
      id:this.id, username:this.username, avatar:this.avatar,
      handSize:this._hand.length, isHost:this.isHost, saidUno:this.saidUno,
      isConnected:this.isConnected, status:this.status,
      abandoned:this.abandoned||false,                 // P4-NEW.1a
      // Equipped card-back id so every client can paint THIS player's seat
      // with the design they bought (resolved to art via the local catalog).
      cardBackId:this.cardBackId || 'cb_default',
      isBot:this.isBot||false,
      // For bots: difficulty + derived level so the in-game profile sheet
      // can show "BOT — Easy/Medium/Hard, Lvl X" without an extra round-trip.
      botDifficulty:this.botDifficulty||null,
      accountLevel: this.accountLevel || 1,
      isElite: this.isElite || false,   // premium "pro" bot — client shows top look + rank
      tableFelt: this.tableFelt || null,
      // Ranked identity (set for high-stakes pro bots) so the in-game profile
      // reads as a genuine Master/Grandmaster opponent. Null for normal seats.
      rankPoints: this.rankPoints || null,
      rankedTier: this.rankedTier || null,
      peakRankPoints: this.peakRankPoints || null,
      team: (this.team === 0 || this.team === 1) ? this.team : null,   // 2v2 team index
    };
  }

  static fromJSON(d) {
    const p = new Player(d.id, d.username, d.coins);
    p.avatar      = d.avatar;
    p._hand       = (d.hand||[]).map(c=>Card.fromJSON(c));
    p.isHost      = d.isHost||false;
    p.saidUno     = d.saidUno||false;
    p.isConnected = d.isConnected!==undefined ? d.isConnected : true;
    p.status      = d.status||'waiting';
    p.stats       = {...p.stats,...(d.stats||{})};
    return p;
  }
}

module.exports = { Player };
