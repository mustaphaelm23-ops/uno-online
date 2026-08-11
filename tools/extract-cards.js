/* Recover the last N pasted images from the Claude Code session transcript.
 *   node tools/extract-cards.js [N] [jsonlPath]
 * Writes tools/_card1.<ext> ... tools/_cardN.<ext> in chat order (oldest→newest
 * among the last N). */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const N = parseInt(process.argv[2] || '3', 10);
const JSONL = process.argv[3] ||
  'C:\\Users\\musta\\.claude\\projects\\c--Users-musta-OneDrive-Desktop-UNO-part-2\\3efdeac4-b17e-4507-8653-59c76e079efc.jsonl';

const reData = /"data"\s*:\s*"([A-Za-z0-9+/=_-]{20000,})"/g;

(async () => {
  if(!fs.existsSync(JSONL)){ console.error('transcript not found'); process.exit(1); }
  const rl = readline.createInterface({ input: fs.createReadStream(JSONL), crlfDelay: Infinity });
  const blobs = [];                        // keep only the tail to bound memory
  for await (const line of rl){
    if(line.indexOf('"data"') === -1) continue;
    let m; reData.lastIndex = 0;
    while((m = reData.exec(line)) !== null){
      blobs.push(m[1]);
      if(blobs.length > N + 4) blobs.shift();
    }
  }
  const last = blobs.slice(-N);
  console.log(`found ${blobs.length}+ blobs; writing last ${last.length}`);
  last.forEach((b64, i) => {
    const buf = Buffer.from(b64.replace(/-/g,'+').replace(/_/g,'/'), 'base64');
    let ext = 'png';
    if(buf[0]===0xFF && buf[1]===0xD8) ext = 'jpg';
    else if(buf[0]===0x89 && buf[1]===0x50) ext = 'png';
    else if(buf[0]===0x52 && buf[8]===0x57) ext = 'webp';
    const out = path.join(__dirname, `_card${i+1}.${ext}`);
    fs.writeFileSync(out, buf);
    console.log(`  _card${i+1}.${ext}  ${Math.round(buf.length/1024)}KB`);
  });
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
