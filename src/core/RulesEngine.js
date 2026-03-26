/**
 * RulesEngine.js - UNO Rules
 */
'use strict';

const { VALUES, COLORS } = require('./Card');

const DIR = Object.freeze({ CW:1, CCW:-1 });

class RulesEngine {
  constructor(settings = {}) {
    this.settings = {
      challengeWD4: settings.challengeWD4 !== false,
      ...settings,
    };
  }

  // Is this card playable on topCard?
  isPlayable(card, topCard) {
    if (!topCard) return true;
    if (card.isWild) return true;

    // Get the color we need to match
    const needColor = topCard.chosenColor || topCard.color;

    if (card.color === needColor) return true;
    if (!topCard.isWild && card.value === topCard.value) return true;

    return false;
  }

  // Validate a play attempt
  validate(player, card, topCard, currentPlayerId) {
    if (player.id !== currentPlayerId) return { ok:false, reason:'Not your turn' };
    if (!player.hasCard(card.id))      return { ok:false, reason:'Card not in hand' };
    if (!this.isPlayable(card, topCard)) return { ok:false, reason:'Card not playable on ' + (topCard?.chosenColor||topCard?.color||'?') + ' ' + (topCard?.value||'') };
    return { ok:true };
  }

  // Resolve effect of played card — returns what to do next
  resolve(card, playerCount, direction, currentIdx) {
    const next = (steps=1, dir=direction) =>
      ((currentIdx + dir*steps) % playerCount + playerCount) % playerCount;

    switch(card.value) {
      case VALUES.SKIP:
        return { nextIdx: next(2), newDir: direction, draw:0, skip:1 };

      case VALUES.REVERSE:
        if (playerCount === 2) return { nextIdx: next(2), newDir: direction, draw:0, skip:1 };
        const nd = -direction;
        return { nextIdx: next(1, nd), newDir: nd, draw:0, dirChanged:true };

      case VALUES.DRAW_TWO:
        return { nextIdx: next(1), newDir: direction, draw:2, skip:1 };

      case VALUES.WILD:
      case VALUES.WILD_DRAW_FOUR:
        const drawAmt = card.value === VALUES.WILD_DRAW_FOUR ? 4 : 0;
        const skipAmt = card.value === VALUES.WILD_DRAW_FOUR ? 1 : 0;
        return { nextIdx: next(1), newDir: direction, draw:drawAmt, skip:skipAmt };

      default:
        return { nextIdx: next(1), newDir: direction, draw:0, skip:0 };
    }
  }

  nextIdx(current, count, direction, steps=1) {
    return ((current + direction*steps) % count + count) % count;
  }

  isValidColor(c) {
    return [COLORS.RED, COLORS.BLUE, COLORS.GREEN, COLORS.YELLOW].includes(c);
  }

  unoPenalty() { return 2; }

  calcScore(losers) {
    return losers.reduce((s, p) => s + p.handPoints(), 0);
  }

  calcCoins(score) {
    return Math.floor(score / 10) + 50;
  }
}

module.exports = { RulesEngine, DIR };
