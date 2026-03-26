/**
 * Deck.js - UNO Deck (108 cards)
 */
'use strict';

const { Card, COLORS, VALUES } = require('./Card');

class Deck {
  constructor() {
    this._draw    = [];
    this._discard = [];
  }

  build() {
    this._draw = [];
    this._discard = [];
    const suits = [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW];

    for (const color of suits) {
      this._draw.push(new Card(color, VALUES.ZERO));
      for (let n = 1; n <= 9; n++) {
        this._draw.push(new Card(color, String(n)));
        this._draw.push(new Card(color, String(n)));
      }
      for (const a of [VALUES.SKIP, VALUES.REVERSE, VALUES.DRAW_TWO]) {
        this._draw.push(new Card(color, a));
        this._draw.push(new Card(color, a));
      }
    }
    for (let i = 0; i < 4; i++) this._draw.push(new Card(COLORS.WILD, VALUES.WILD));
    for (let i = 0; i < 4; i++) this._draw.push(new Card(COLORS.WILD, VALUES.WILD_DRAW_FOUR));
    return this;
  }

  shuffle() {
    for (let i = this._draw.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._draw[i], this._draw[j]] = [this._draw[j], this._draw[i]];
    }
    return this;
  }

  buildAndShuffle() { return this.build().shuffle(); }

  draw() {
    if (this._draw.length === 0) this._reshuffle();
    return this._draw.length > 0 ? this._draw.pop() : null;
  }

  drawMany(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const c = this.draw(); if (c) out.push(c); }
    return out;
  }

  dealHands(playerCount, size = 7) {
    const hands = Array.from({ length: playerCount }, () => []);
    for (let r = 0; r < size; r++)
      for (let p = 0; p < playerCount; p++) { const c = this.draw(); if (c) hands[p].push(c); }
    return hands;
  }

  // Place card on discard — NEVER reset chosenColor here
  discard(card) {
    this._discard.push(card);
  }

  top() {
    return this._discard.length > 0 ? this._discard[this._discard.length - 1] : null;
  }

  initFirst() {
    let card;
    do { card = this.draw(); } while (card && card.value === VALUES.WILD_DRAW_FOUR);
    if (card) this._discard.push(card);
    return card;
  }

  _reshuffle() {
    if (this._discard.length <= 1) return;
    const top = this._discard.pop();
    const rest = this._discard.splice(0);
    // Reset wild colors when going back to draw pile
    rest.forEach(c => { if (c.isWild) c.chosenColor = null; });
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this._draw = rest;
    this._discard = [top];
  }

  get drawSize()    { return this._draw.length; }
  get discardSize() { return this._discard.length; }

  toJSON() {
    return { draw: this._draw.map(c=>c.toJSON()), discard: this._discard.map(c=>c.toJSON()) };
  }

  static fromJSON(d) {
    const dk = new Deck();
    dk._draw    = d.draw.map(c=>Card.fromJSON(c));
    dk._discard = d.discard.map(c=>Card.fromJSON(c));
    return dk;
  }
}

module.exports = { Deck };
