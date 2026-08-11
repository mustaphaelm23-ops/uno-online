#!/usr/bin/env node
/**
 * Replace oros-01..04 card images with user-supplied photos.
 *
 * Source files (in client/cards/, named by WhatsApp):
 *   "WhatsApp Image 2026-06-05 at 18.04.54.jpeg"        → oros-01 (As)
 *   "WhatsApp Image 2026-06-05 at 18.04.54 (1).jpeg"    → oros-02
 *   "WhatsApp Image 2026-06-05 at 18.04.54 (2).jpeg"    → oros-03
 *   "WhatsApp Image 2026-06-05 at 18.04.54 (3).jpeg"    → oros-04
 *
 * Pipeline per file:
 *   1. trim — strip the white photo background (threshold 25)
 *   2. resize to 61×95 (matching existing card thumbnails) with cover
 *      fit so the card fills the frame
 *   3. emit .webp (lossy q80) + .jpg (q88) variants
 *
 * After the conversion succeeds, the source WhatsApp files are deleted
 * to keep client/cards/ clean.
 */
'use strict';

const path  = require('path');
const fs    = require('fs/promises');
const sharp = require('sharp');

const CARDS_DIR = path.join(__dirname, '..', 'client', 'cards');

const MAP = [
  { src: 'WhatsApp Image 2026-06-05 at 18.04.54.jpeg',     rank: 1 },
  { src: 'WhatsApp Image 2026-06-05 at 18.04.54 (1).jpeg', rank: 2 },
  { src: 'WhatsApp Image 2026-06-05 at 18.04.54 (2).jpeg', rank: 3 },
  { src: 'WhatsApp Image 2026-06-05 at 18.04.54 (3).jpeg', rank: 4 },
];

(async () => {
  for (const { src, rank } of MAP) {
    const srcPath = path.join(CARDS_DIR, src);
    const num     = String(rank).padStart(2, '0');
    const webpOut = path.join(CARDS_DIR, `oros-${num}.webp`);
    const jpgOut  = path.join(CARDS_DIR, `oros-${num}.jpg`);

    // Pre-trim sample so we can log what got trimmed.
    const raw = sharp(srcPath);
    const meta = await raw.metadata();
    console.log(`\n→ ${src}  (${meta.width}×${meta.height})`);
    console.log(`  target: oros-${num}.{webp,jpg}  (61×95)`);

    // Pipeline.
    const buf = await sharp(srcPath)
      .trim({ threshold: 25 })          // strip outer white
      .resize(61, 95, { fit: 'cover' }) // match existing card thumb size
      .toBuffer();

    await sharp(buf).webp({ quality: 80 }).toFile(webpOut);
    await sharp(buf).jpeg({ quality: 88 }).toFile(jpgOut);

    console.log(`  ✓ wrote ${path.basename(webpOut)} + ${path.basename(jpgOut)}`);

    // Cleanup the WhatsApp source.
    await fs.unlink(srcPath);
    console.log(`  ✓ deleted source`);
  }
  console.log('\nDone.');
})().catch(err => {
  console.error('replace-oros failed:', err);
  process.exit(1);
});
