#!/usr/bin/env node
/**
 * Fix the misnamed Spanish-deck card files.
 *
 * The original upload-order script assumed each suit was uploaded in
 * rank order (1, 2, 3, …) but for copas, bastos, and parts of oros the
 * source photos were uploaded in a different order. Spot-checking the
 * printed rank in each file revealed the real mapping below.
 *
 * Strategy: two-pass rename via a `.tmp` intermediate so cycles and
 * swaps can't clobber a file mid-pass.
 */
'use strict';
const fs   = require('fs/promises');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');

// current filename rank → actual printed rank (only entries that differ)
const FIXES = {
  oros: {
    '07': '12',   // oros-07.jpg currently shows rank 12
    '12': '07',
    '10': '11',
    '11': '10',
  },
  copas: {
    '02': '04',
    '04': '02',
    '03': '05',
    '05': '03',
  },
  bastos: {
    // Single 9-element cycle: 02→03→04→05→06→07→10→11→12→02
    '02': '03',
    '03': '04',
    '04': '05',
    '05': '06',
    '06': '07',
    '07': '10',
    '10': '11',
    '11': '12',
    '12': '02',
  },
  espadas: {},      // already correct
};

async function exists(p){
  try { await fs.access(p); return true; } catch { return false; }
}

(async () => {
  // Pass 1 — move every file that needs to change into a .tmp name.
  // Pass 2 — move every .tmp back to its final correct name.
  const stageMoves = [];   // [{ from, tmp, to }]

  for (const [suit, map] of Object.entries(FIXES)){
    for (const [oldRank, newRank] of Object.entries(map)){
      for (const ext of ['jpg', 'webp']){
        const from = path.join(CARDS_DIR, `${suit}-${oldRank}.${ext}`);
        const tmp  = path.join(CARDS_DIR, `__tmp_${suit}-${oldRank}.${ext}`);
        const to   = path.join(CARDS_DIR, `${suit}-${newRank}.${ext}`);
        stageMoves.push({ from, tmp, to, label: `${suit}-${oldRank}→${suit}-${newRank}.${ext}` });
      }
    }
  }

  // Pass 1
  console.log('Pass 1 — moving to .tmp …');
  for (const m of stageMoves){
    if (!(await exists(m.from))){
      console.warn(`  ! missing: ${path.basename(m.from)} (skipping)`);
      continue;
    }
    await fs.rename(m.from, m.tmp);
  }

  // Pass 2
  console.log('Pass 2 — moving .tmp to final names …');
  for (const m of stageMoves){
    if (!(await exists(m.tmp))){
      console.warn(`  ! missing tmp: ${path.basename(m.tmp)} (skipping)`);
      continue;
    }
    await fs.rename(m.tmp, m.to);
    console.log(`  ✓ ${m.label}`);
  }

  console.log(`\nDone — ${stageMoves.length / 2} card pairs renamed.`);
})().catch(e => { console.error(e); process.exit(1); });
