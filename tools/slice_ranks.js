const sharp = require('sharp');
const fs = require('fs');
const SRC = 'client/f46550eb-cc8a-462b-b660-faf17bf7cc03.png';

(async () => {
  const { width: W, height: H } = await sharp(SRC).metadata();
  const data = await sharp(SRC).greyscale().raw().toBuffer();
  const lum = (x,y)=> data[y*W + x];
  const TH = 45;                       // bright threshold (bg ~ 10-25)
  // column projection within a y-band
  const colProj = (y0,y1)=>{
    const p = new Array(W).fill(0);
    for(let x=0;x<W;x++){ let c=0; for(let y=y0;y<y1;y++) if(lum(x,y)>TH) c++; p[x]=c; }
    return p;
  };
  // segment runs where proj > minRun into [start,end] groups, merge gaps < gapMax
  const segments = (proj, minCount, gapMax)=>{
    const on = proj.map(v=>v>minCount);
    const segs=[]; let s=-1;
    for(let i=0;i<on.length;i++){
      if(on[i] && s<0) s=i;
      else if(!on[i] && s>=0){ segs.push([s,i-1]); s=-1; }
    }
    if(s>=0) segs.push([s,on.length-1]);
    // merge close
    const merged=[];
    for(const seg of segs){
      if(merged.length && seg[0]-merged[merged.length-1][1] <= gapMax) merged[merged.length-1][1]=seg[1];
      else merged.push(seg.slice());
    }
    return merged;
  };
  // find vertical extent of bright content within an x-band (to trim label)
  const rowProj = (x0,x1,y0,y1)=>{
    const p=[]; for(let y=y0;y<y1;y++){ let c=0; for(let x=x0;x<x1;x++) if(lum(x,y)>TH) c++; p.push([y,c]); }
    return p;
  };

  // Bands: top badges y ~ [30,430]; bottom badges y ~ [540,960]
  const bands = [
    { y0: 30,  y1: 440,  names: ['bronze','silver','gold','platinum'] },
    { y0: 540, y1: 970,  names: ['diamond','master','grandmaster'] },
  ];

  fs.mkdirSync('client/ranks', { recursive: true });
  const out = [];
  for(const band of bands){
    const proj = colProj(band.y0, band.y1);
    let segs = segments(proj, 4, 40).filter(s => (s[1]-s[0]) > 60);  // ignore tiny
    // keep the N widest
    segs.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));
    segs = segs.slice(0, band.names.length).sort((a,b)=>a[0]-b[0]);
    band.names.forEach((name, i)=>{
      const [xs,xe] = segs[i];
      // trim vertical extent (badge cluster, drop the thin label strip below)
      const rp = rowProj(xs, xe, band.y0, band.y1);
      const ys = rp.find(([y,c])=>c>3)?.[0] ?? band.y0;
      // badge ends where there's a vertical gap (>18 dark rows) after the main mass
      let ye = band.y1, gap=0, started=false;
      for(const [y,c] of rp){
        if(c>3){ started=true; gap=0; ye=y; }
        else if(started){ gap++; if(gap>18) break; }
      }
      const pad = 8;
      const left = Math.max(0, xs-pad), top = Math.max(0, ys-pad);
      const w = Math.min(W-left, (xe-xs)+pad*2), h = Math.min(H-top, (ye-ys)+pad*2);
      out.push({ name, left, top, w, h });
    });
  }
  for(const o of out){
    await sharp(SRC).extract({ left:o.left, top:o.top, width:o.w, height:o.h })
      .png().toFile(`client/ranks/${o.name}.png`);
    console.log(`${o.name.padEnd(12)} left=${o.left} top=${o.top} w=${o.w} h=${o.h}`);
  }
})();
