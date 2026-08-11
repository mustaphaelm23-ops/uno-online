#!/usr/bin/env node
/**
 * Build a labelled contact sheet of every current card file so we can
 * spot-check rank/suit at a glance and find any mis-named files.
 *
 * Output: scripts/verify-sheet.jpg  — 10 cols × 4 rows, big enough to
 *         read the card's printed rank.
 */
'use strict';
const fs    = require('fs/promises');
const path  = require('path');
const sharp = require('sharp');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');
const SUITS = ['oros', 'copas', 'bastos', 'espadas'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

(async () => {
  const TW = 220, TH = 320, GAP = 6, LBL = 28;
  const COLS = 10, ROWS = 4;
  const CELL_W = TW + GAP, CELL_H = TH + LBL + GAP;
  const W = COLS * CELL_W + GAP;
  const H = ROWS * CELL_H + GAP;

  const composites = [];
  for (let r = 0; r < ROWS; r++){
    for (let c = 0; c < COLS; c++){
      const suit = SUITS[r];
      const rank = RANKS[c];
      const num  = String(rank).padStart(2, '0');
      const file = path.join(CARDS_DIR, `${suit}-${num}.jpg`);
      const x = GAP + c * CELL_W;
      const y = GAP + r * CELL_H;

      const thumb = await sharp(file)
        .resize(TW, TH, { fit: 'contain', background: '#fff' })
        .toBuffer();
      composites.push({ input: thumb, left: x, top: y });

      const svg = Buffer.from(`<svg width="${TW}" height="${LBL}">
        <rect width="100%" height="100%" fill="#000"/>
        <text x="50%" y="20" font-family="Arial" font-size="16" font-weight="900"
              text-anchor="middle" fill="#FBBF24">${suit}-${num}</text>
      </svg>`);
      composites.push({ input: svg, left: x, top: y + TH });
    }
  }

  await sharp({
    create: { width: W, height: H, channels: 3, background: '#1a1a1a' }
  })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toFile(path.join(__dirname, 'verify-sheet.jpg'));

  console.log(`Wrote scripts/verify-sheet.jpg  (${W}×${H})`);
})().catch(e => { console.error(e); process.exit(1); });
