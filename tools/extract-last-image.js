/* extract-last-image.js — recover the most-recently pasted image from the
 * Claude Code session transcript (.jsonl), where pasted images are stored as
 * base64. Streams the (large) file line-by-line, keeps the LAST long base64
 * "data" blob, decodes it, and writes it to tools/_pasted_source.<ext>.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const JSONL = process.argv[2] ||
  'C:\\Users\\musta\\.claude\\projects\\c--Users-musta-OneDrive-Desktop-UNO-part-2\\3efdeac4-b17e-4507-8653-59c76e079efc.jsonl';

const MIN = 20000;                 // min base64 length to count as an image
const reData = /"data"\s*:\s*"([A-Za-z0-9+/=_-]{20000,})"/g;

(async () => {
  if(!fs.existsSync(JSONL)){ console.error('transcript not found:', JSONL); process.exit(1); }
  const rl = readline.createInterface({ input: fs.createReadStream(JSONL), crlfDelay: Infinity });
  let last = null, lastLine = -1, n = 0, count = 0;
  for await (const line of rl){
    n++;
    if(line.indexOf('"data"') === -1) continue;
    let m, localLast = null;
    reData.lastIndex = 0;
    while((m = reData.exec(line)) !== null){ localLast = m[1]; count++; }
    if(localLast){ last = localLast; lastLine = n; }
  }
  if(!last){ console.error('No base64 image blobs found.'); process.exit(2); }

  const buf = Buffer.from(last.replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  // sniff format
  let ext = 'png';
  if(buf[0]===0xFF && buf[1]===0xD8) ext = 'jpg';
  else if(buf[0]===0x52 && buf[1]===0x49 && buf[8]===0x57 && buf[9]===0x45) ext = 'webp';
  else if(buf[0]===0x89 && buf[1]===0x50) ext = 'png';
  const out = path.join(__dirname, '_pasted_source.' + ext);
  fs.writeFileSync(out, buf);
  console.log(`Scanned ${n} lines, found ${count} blobs. Last image on line ${lastLine}.`);
  console.log(`Wrote ${out}  (${Math.round(buf.length/1024)} KB)`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
