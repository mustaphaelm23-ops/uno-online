'use strict';
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'cards');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// [sourceFile, [[row0ids],[row1ids],[row2ids]]]
const JOBS = [
  ['_card1.jpg', [
    ['cb_g1','cb_g2','cb_g3'],
    ['cb_g4','cb_g5','cb_g6'],
    ['cb_g7','cb_g8','cb_g9'],
  ]],
  ['_card2.jpg', [
    ['cb_f1','cb_f2','cb_f3'],
    ['cb_f4','cb_f5','cb_f6'],
    ['cb_f7','cb_f8','cb_f9'],
  ]],
  ['_card3.jpg', [
    ['cb_m1','cb_m2','cb_m3'],
    ['cb_m4','cb_m5','cb_m6'],
    ['cb_m7','cb_m8','cb_m9'],
  ]],
];

(async () => {
  for (const [file, map] of JOBS) {
    const src = path.join(__dirname, file);
    const meta = await sharp(src).metadata();
    const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 3);
    console.log(`${file}  ${meta.width}x${meta.height}  cell ${cw}x${ch}`);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const id = map[r][c];
        const left = c * cw, top = r * ch;
        let buf;
        try {
          buf = await sharp(src).extract({ left, top, width: cw, height: ch }).trim({ threshold: 18 }).toBuffer();
        } catch (e) {
          const mx = Math.round(cw * 0.05), my = Math.round(ch * 0.05);
          buf = await sharp(src).extract({ left: left + mx, top: top + my, width: cw - 2*mx, height: ch - 2*my }).toBuffer();
        }
        const tm = await sharp(buf).metadata();
        const out = path.join(OUT, id + '.webp');
        await sharp(buf).resize({ width: 360, withoutEnlargement: true }).webp({ quality: 90 }).toFile(out);
        console.log(`  ${id.padEnd(7)} cell(${r},${c}) trim ${tm.width}x${tm.height} -> ${Math.round(fs.statSync(out).size/1024)}KB`);
      }
    }
  }
  console.log('\nDone — 27 card backs in client/cards/');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
