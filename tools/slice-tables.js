/* slice-tables.js — slice a 3×3 grid of table images into 9 clean felts.
 *
 *   node tools/slice-tables.js [path-to-source-image]
 *
 * If no path is given, it grabs the NEWEST image in the user's Downloads.
 * Each grid cell is auto-trimmed (the dark surround is removed) so only the
 * table itself is kept — no labels, no text added. Output overwrites
 * client/tables/<id>.webp using the row-major colour mapping below.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'client', 'tables');

// Row-major positions (3 cols × 3 rows) → catalog ids, matched by colour.
//   row0: green        | black+gold   | wood
//   row1: red          | blue glow    | desert/stone
//   row2: seaside blue | lava/inferno | purple
const MAP = [
  ['tf_classic', 'tf_gold',   'tf_wood'   ],
  ['tf_royal',   'tf_ranked', 'tf_oasis'  ],
  ['tf_seaside', 'tf_inferno','tf_diamond'],
];

function newestDownload(){
  const dl = path.join(os.homedir(), 'Downloads');
  const imgs = fs.readdirSync(dl)
    .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(dl, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if(!imgs.length) throw new Error('No images found in Downloads.');
  return path.join(dl, imgs[0].f);
}

(async () => {
  const src = process.argv[2] || newestDownload();
  if(!fs.existsSync(src)) throw new Error('Source not found: ' + src);
  console.log('Source:', src);

  const meta = await sharp(src).metadata();
  const W = meta.width, H = meta.height;
  const cw = Math.floor(W / 3), ch = Math.floor(H / 3);
  console.log(`Image ${W}×${H} → cells ${cw}×${ch}`);
  if(!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  for(let r = 0; r < 3; r++){
    for(let c = 0; c < 3; c++){
      const id = MAP[r][c];
      const left = c * cw, top = r * ch;
      // Extract the cell, then trim the dark border so only the table remains.
      let buf;
      try {
        buf = await sharp(src)
          .extract({ left, top, width: cw, height: ch })
          .trim({ threshold: 22 })
          .toBuffer();
      } catch(e){
        // Trim can throw if it trims everything (uniform cell) — fall back to
        // a fixed 4% inset crop.
        const mx = Math.round(cw * 0.04), my = Math.round(ch * 0.04);
        buf = await sharp(src)
          .extract({ left: left + mx, top: top + my, width: cw - 2*mx, height: ch - 2*my })
          .toBuffer();
      }
      const tm = await sharp(buf).metadata();
      const outPath = path.join(OUT, id + '.webp');
      await sharp(buf)
        .resize({ width: 660, withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(outPath);
      const kb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`  ${id.padEnd(11)} ← cell(${r},${c})  trimmed ${tm.width}×${tm.height}  → ${kb}KB`);
    }
  }
  console.log('\nDone. 9 tables written to client/tables/.');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
