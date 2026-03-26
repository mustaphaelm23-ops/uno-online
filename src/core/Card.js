/**
 * Card.js - UNO Card Entity
 */
'use strict';

const COLORS = Object.freeze({ RED:'red', BLUE:'blue', GREEN:'green', YELLOW:'yellow', WILD:'wild' });
const VALUES = Object.freeze({
  ZERO:'0',ONE:'1',TWO:'2',THREE:'3',FOUR:'4',FIVE:'5',SIX:'6',SEVEN:'7',EIGHT:'8',NINE:'9',
  SKIP:'skip',REVERSE:'reverse',DRAW_TWO:'draw_two',WILD:'wild',WILD_DRAW_FOUR:'wild_draw_four',
});
const POINTS = Object.freeze({
  '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
  'skip':20,'reverse':20,'draw_two':20,'wild':50,'wild_draw_four':50,
});

class Card {
  constructor(color, value, id = null) {
    this.id    = id || `card_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    this.color = color;
    this.value = value;
    this.points = POINTS[value] || 0;
    this.isWild = (color === COLORS.WILD);
    this.isAction = ['skip','reverse','draw_two','wild','wild_draw_four'].includes(value);
    this.chosenColor = null;
  }

  // The effective color to match against
  effectiveColor() {
    if (this.isWild && this.chosenColor) return this.chosenColor;
    return this.color;
  }

  // Can this card be played on top of topCard?
  canPlayOn(topCard) {
    if (!topCard) return true;
    if (this.isWild) return true;

    const topEffective = topCard.effectiveColor ? topCard.effectiveColor() : (topCard.chosenColor || topCard.color);

    // Same color
    if (this.color === topEffective) return true;

    // Same value (but not wild on wild unless matching color)
    if (!topCard.isWild && this.value === topCard.value) return true;

    return false;
  }

  toJSON() {
    return { id:this.id, color:this.color, value:this.value, points:this.points,
             isWild:this.isWild, isAction:this.isAction, chosenColor:this.chosenColor };
  }

  static fromJSON(d) {
    const c = new Card(d.color, d.value, d.id);
    c.chosenColor = d.chosenColor || null;
    return c;
  }

  clone() { return new Card(this.color, this.value); }
  toString() { return `[${this.chosenColor||this.color} ${this.value}]`; }
}

module.exports = { Card, COLORS, VALUES, POINTS };
