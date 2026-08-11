#!/usr/bin/env node
/**
 * Build one labelled sheet per suit (oros, copas, bastos, espadas) so
 * each card is large enough to identify the printed rank.
 *
 * Output: scripts/sheet-{suit}.jpg  — 5 cols × 2 rows of 360px tiles.
 */
'use strict';
const path  = require('path');
const sharp = require('sharp');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');
const SUITS = ['oros', 'copas', 'bastos', 'espadas'];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

(async () => {
  for (const suit of SUITS){
    const TW = 280, TH = 410, GAP = 8, LBL = 32;
    const COLS = 5, ROWS = 2;
    const CELL_W = TW + GAP, CELL_H = TH + LBL + GAP;
    const W = COLS * CELL_W + GAP;
    const H = ROWS * CELL_H + GAP;

    const composites = [];
    for (let i = 0; i < RANKS.length; i++){
      const col = i % COLS, row = Math.floor(i / COLS);
      const num = String(RANKS[i]).padStart(2, '0');
      const file = path.join(CARDS_DIR, `${suit}-${num}.jpg`);
      const x = GAP + col * CELL_W;
      const y = GAP + row * CELL_H;

      const thumb = await sharp(file)
        .resize(TW, TH, { fit: 'contain', background: '#fff' })
        .toBuffer();
      composites.push({ input: thumb, left: x, top: y });

      const svg = Buffer.from(`<svg width="${TW}" height="${LBL}">
        <rect width="100%" height="100%" fill="#000"/>
        <text x="50%" y="22" font-family="Arial" font-size="20" font-weight="900"
              text-anchor="middle" fill="#FBBF24">${suit}-${num}</text>
      </svg>`);
      composites.push({ input: svg, left: x, top: y + TH });
    }

    await sharp({
      create: { width: W, height: H, channels: 3, background: '#1a1a1a' }
    })
      .composite(composites)
      .jpeg({ quality: 90 })
      .toFile(path.join(__dirname, `sheet-${suit}.jpg`));

    console.log(`Wrote sheet-${suit}.jpg`);
  }
})().catch(e => { console.error(e); process.exit(1); });
