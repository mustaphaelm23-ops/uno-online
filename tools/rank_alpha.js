const sharp = require('sharp');
const names = ['bronze','silver','gold','platinum','diamond','master','grandmaster'];
const THRESH = 38;   // pixels dimmer than this, reachable from an edge → background

(async () => {
  for (const n of names) {
    const file = `client/ranks/${n}.png`;
    const { width: W, height: H } = await sharp(file).metadata();
    const rgba = await sharp(file).ensureAlpha().raw().toBuffer();   // RGBA
    const lum = i => (rgba[i*4]*0.299 + rgba[i*4+1]*0.587 + rgba[i*4+2]*0.114);
    const bg = new Uint8Array(W*H);          // 1 = background (flood-filled)
    const stack = [];
    const push = (x,y) => { if(x<0||y<0||x>=W||y>=H) return; const i=y*W+x; if(bg[i]) return; if(lum(i) > THRESH) return; bg[i]=1; stack.push(i); };
    for (let x=0;x<W;x++){ push(x,0); push(x,H-1); }
    for (let y=0;y<H;y++){ push(0,y); push(W-1,y); }
    while (stack.length){
      const i = stack.pop(); const x = i%W, y = (i/W)|0;
      push(x-1,y); push(x+1,y); push(x,y-1); push(x,y+1);
    }
    // Apply: background → alpha 0. Soft-feather a 1px edge for cleanliness.
    for (let i=0;i<W*H;i++){
      if (bg[i]) rgba[i*4+3] = 0;
    }
    // Light feather: any kept pixel touching a transparent one gets its alpha
    // scaled by local brightness so the cut isn't hard.
    await sharp(rgba, { raw:{ width:W, height:H, channels:4 } }).png().toFile(file);
    const kept = rgba.reduce((c,_,i)=> (i%4===3 && rgba[i]>0)?c+1:c, 0);
    console.log(`${n.padEnd(12)} ${W}x${H}  opaque≈${Math.round(kept/(W*H)*100)}%`);
  }
})();
