#!/usr/bin/env node
/**
 * Build a contact sheet of all WhatsApp card images so we can identify
 * each card's rank + suit in a single Read call instead of 40.
 *
 * Output: scripts/contact-sheet.jpg — an 8×5 grid of 200×280 thumbs
 * with the filename overlaid on each tile. Files appear in upload
 * order (base file, then (1), (2), (3), ... numerically).
 */
'use strict';
const fs    = require('fs/promises');
const path  = require('path');
const sharp = require('sharp');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');

function uploadOrder(a, b){
  // Extract the numeric suffix in the (N).jpeg pattern; missing = -1 (base)
  const n = (s) => {
    const m = s.match(/\((\d+)\)\.jpeg$/);
    return m ? Number(m[1]) : -1;
  };
  // Group by timestamp prefix first.
  const ts = (s) => s.match(/at (\d{2}\.\d{2}\.\d{2})/)[1];
  const ta = ts(a), tb = ts(b);
  if (ta !== tb) return ta < tb ? -1 : 1;
  return n(a) - n(b);
}

(async () => {
  const all = (await fs.readdir(CARDS_DIR))
    .filter(f => f.startsWith('WhatsApp Image'))
    .sort(uploadOrder);

  console.log(`Found ${all.length} WhatsApp files. Building contact sheet…`);

  const COLS = 8, TW = 180, TH = 252, GAP = 6, LBL = 22;
  const CELL_W = TW + GAP, CELL_H = TH + LBL + GAP;
  const ROWS = Math.ceil(all.length / COLS);
  const W = COLS * CELL_W + GAP;
  const H = ROWS * CELL_H + GAP;

  const composites = [];
  for (let i = 0; i < all.length; i++){
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = GAP + col * CELL_W;
    const y = GAP + row * CELL_H;

    const thumb = await sharp(path.join(CARDS_DIR, all[i]))
      .resize(TW, TH, { fit: 'contain', background: '#fff' })
      .toBuffer();
    composites.push({ input: thumb, left: x, top: y });

    // SVG label under each thumbnail showing the upload index (1-based).
    const svg = Buffer.from(`<svg width="${TW}" height="${LBL}">
      <rect width="100%" height="100%" fill="#000"/>
      <text x="50%" y="16" font-family="Arial" font-size="14" font-weight="900"
            text-anchor="middle" fill="#FBBF24">#${i + 1}</text>
    </svg>`);
    composites.push({ input: svg, left: x, top: y + TH });
  }

  await sharp({
    create: { width: W, height: H, channels: 3, background: '#1a1a1a' }
  })
    .composite(composites)
    .jpeg({ quality: 85 })
    .toFile(path.join(__dirname, 'contact-sheet.jpg'));

  // Print the upload-order list so we can map index → original filename.
  console.log('\nUpload order:');
  all.forEach((f, i) => console.log(`  #${i + 1}\t${f}`));

  console.log('\nWrote scripts/contact-sheet.jpg');
})().catch(e => { console.error(e); process.exit(1); });
