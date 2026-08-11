/**
 * slice-deck.js — slice client/cards/spanish-deck-full.jpg into 40 tiles
 * (4 suits × 10 cards each).
 *
 *   Row 0: oros    (coins/suns)
 *   Row 1: espadas (swords)
 *   Row 2: copas   (cups)
 *   Row 3: bastos  (clubs/batons)
 *
 *   Each row in the source image holds 12 cards (1..12). For traditional
 *   Moroccan / Spanish 40-card games the 8 and 9 are not used, so this
 *   script SKIPS those columns entirely — only cards 1-7 and 10-12 are
 *   written to disk.
 *
 * Output:
 *   client/cards/{suit}-{NN}.jpg   — original JPEG slice
 *   client/cards/{suit}-{NN}.webp  — optimized WebP (~30% smaller)
 */
'use strict';

const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'client', 'cards', 'spanish-deck-full.jpg');
const OUT = path.join(__dirname, '..', 'client', 'cards');

const SUITS = ['oros', 'espadas', 'copas', 'bastos'];
const COLS  = 12;
const ROWS  = 4;
// 40-card Spanish deck — skip 8 and 9.
const VALID_CARDS = new Set([1,2,3,4,5,6,7,10,11,12]);

(async () => {
  const meta = await sharp(SRC).metadata();
  const W = meta.width, H = meta.height;
  const cardW = Math.floor(W / COLS);
  const cardH = Math.floor(H / ROWS);
  console.log(`Source: ${W}x${H} · per card: ${cardW}x${cardH}`);

  let count = 0, skipped = 0;
  for (let r = 0; r < ROWS; r++) {
    const suit = SUITS[r];
    for (let c = 0; c < COLS; c++) {
      const value = c + 1;
      if (!VALID_CARDS.has(value)) { skipped++; continue; }
      const num = String(value).padStart(2, '0');
      const baseName = `${suit}-${num}`;

      // Use exact column/row boundaries so neighbour borders aren't trimmed.
      const left = c * cardW;
      const top  = r * cardH;
      // Last column / row absorbs the rounding remainder so nothing is lost.
      const w = (c === COLS - 1) ? (W - left) : cardW;
      const h = (r === ROWS - 1) ? (H - top)  : cardH;

      const region = { left, top, width: w, height: h };

      // JPEG slice — keeps the look of the original.
      await sharp(SRC)
        .extract(region)
        .jpeg({ quality: 92 })
        .toFile(path.join(OUT, `${baseName}.jpg`));

      // WebP slice — for the actual game UI (smaller, sharper at low size).
      await sharp(SRC)
        .extract(region)
        .webp({ quality: 88 })
        .toFile(path.join(OUT, `${baseName}.webp`));

      count++;
    }
  }
  console.log(`Wrote ${count} cards (× 2 formats) · skipped ${skipped} (8s & 9s) → ${OUT}`);
})().catch(err => { console.error(err); process.exit(1); });
