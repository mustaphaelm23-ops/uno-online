#!/usr/bin/env node
/**
 * Replace the full 40-card Spanish Ronda deck with the user's
 * high-resolution photo set.
 *
 * Upload order (verified by spot-checking against the contact sheet):
 *   #1..#10  → oros    (1, 2, 3, 4, 5, 6, 7, 10, 11, 12)
 *   #11..#20 → copas
 *   #21..#30 → bastos
 *   #31..#40 → espadas
 *
 * Per file:
 *   1. trim outer photo background (white) with threshold 25
 *   2. resize to 240×360 — high-res so cards stay crisp at any UI size
 *   3. emit .webp (q82) + .jpg (q90) variants under client/cards/
 *      overwriting the old thumbnails
 *
 * On success the WhatsApp source files are deleted.
 */
'use strict';
const fs    = require('fs/promises');
const path  = require('path');
const sharp = require('sharp');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');

// Ranks present in the Spanish 40-card deck used for Ronda (no 8 or 9).
const RANKS  = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const SUITS  = ['oros', 'copas', 'bastos', 'espadas'];

// Card output dimensions — bumped from 61×95 → 240×360 (~4×) so the
// art reads cleanly at the larger in-game sizes the user asked for.
const OUT_W = 240;
const OUT_H = 360;

function uploadOrder(a, b){
  const n = (s) => {
    const m = s.match(/\((\d+)\)\.jpeg$/);
    return m ? Number(m[1]) : -1;
  };
  const ts = (s) => s.match(/at (\d{2}\.\d{2}\.\d{2})/)[1];
  const ta = ts(a), tb = ts(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return n(a) - n(b);
}

(async () => {
  const all = (await fs.readdir(CARDS_DIR))
    .filter(f => f.startsWith('WhatsApp Image'))
    .sort(uploadOrder);

  if (all.length !== 40){
    console.error(`Expected 40 WhatsApp files, found ${all.length}. Aborting.`);
    process.exit(1);
  }

  // Build the mapping: index → (suit, rank)
  let written = 0;
  for (let i = 0; i < all.length; i++){
    const suit = SUITS[Math.floor(i / 10)];
    const rank = RANKS[i % 10];
    const num  = String(rank).padStart(2, '0');
    const src  = path.join(CARDS_DIR, all[i]);
    const webp = path.join(CARDS_DIR, `${suit}-${num}.webp`);
    const jpg  = path.join(CARDS_DIR, `${suit}-${num}.jpg`);

    const buf = await sharp(src)
      .trim({ threshold: 25 })
      .resize(OUT_W, OUT_H, { fit: 'cover', position: 'center' })
      .toBuffer();

    await sharp(buf).webp({ quality: 82 }).toFile(webp);
    await sharp(buf).jpeg({ quality: 90 }).toFile(jpg);

    console.log(`#${i+1}\t${suit}-${num}  ✓`);
    await fs.unlink(src);
    written++;
  }

  console.log(`\nDone — wrote ${written} cards (×2 formats = ${written*2} files).`);
  console.log(`Each card: ${OUT_W}×${OUT_H}px.`);
})().catch(e => { console.error(e); process.exit(1); });
