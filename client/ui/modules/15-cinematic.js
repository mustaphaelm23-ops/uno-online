  /* ═══ CINEMATIC LOBBY — 3D cards, parallax, UI sounds ═══ */
  // GSAP cinematic lobby intro — camera zoom, lights, orchestrated panels.
  function playLobbyIntro(){
    const g=window.gsap;
    const scr=document.getElementById('lobby-screen');
    if(!g||!scr) return;                       // no GSAP → CSS entrance plays
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    // Skip the lobby intro animation on phones — the orchestrated GSAP
    // timeline runs ~10 simultaneous tweens with stagger, which murders
    // first-paint perf on mid-range mobile. Snap straight to the rest
    // state and let the user start interacting.
    if(document.body.classList.contains('mobile-lite')) return;
    scr.classList.add('intro-gsap');           // hand entrance over to GSAP
    g.killTweensOf([scr,'.lhdr','.lobby-hero','.lside-section','.lrail .rail-panel','.lnav','.lobby-bg-img','.lobby-3d','.lobby-fx']);
    const tl=g.timeline({defaults:{ease:'power3.out'},
      onComplete:()=>g.set(scr,{clearProps:'transform'})});
    tl.fromTo(scr,{scale:1.05},{scale:1,duration:1.2,ease:'power2.out'},0)
      .fromTo(['.lobby-bg-img','.lobby-3d','.lobby-fx'],{opacity:0},{opacity:1,duration:.9,stagger:.08},0)
      .fromTo('.lhdr',{y:-54,opacity:0},{y:0,opacity:1,duration:.6,ease:'back.out(1.4)'},.12)
      .fromTo('.lobby-hero',{y:34,opacity:0,scale:.96},{y:0,opacity:1,scale:1,duration:.7},.28)
      .fromTo('.lside-section',{x:-34,opacity:0},{x:0,opacity:1,duration:.5,stagger:.09},.4)
      .fromTo(['.lmain .public-title','.lmain .public-info'],{y:18,opacity:0},{y:0,opacity:1,duration:.5,stagger:.07},.5)
      .fromTo('.lrail .rail-panel',{x:40,opacity:0},{x:0,opacity:1,duration:.55,stagger:.1},.55)
      .fromTo('.lnav',{y:64,opacity:0},{y:0,opacity:1,duration:.6,ease:'back.out(1.5)'},.7);
  }

  function buildLobby3D(){
    const host=document.getElementById('lobby3d');
    if(!host||host.childElementCount) return;
    const cols=[['#FF5577','#9B1B2E'],['#FBBF24','#92400E'],['#34D399','#14532D'],
                ['#60A5FA','#1E3A8A'],['#A78BFA','#4C1D95'],['#F472B6','#9D174D']];
    const vals=['7','+2','★','4','↺','+4','9','3','6'];
    const X=[7,23,41,61,81,91,15,49,73], Y=[15,63,29,71,19,52,84,8,42];
    const rot=[-18,22,-12,16,-26,12,-8,28,-15];
    const rx=[10,-8,14,-12,8,-14,12,-6,10], ry=[-16,20,-10,18,-22,14,-12,24,-14];
    for(let i=0;i<9;i++){
      const c=cols[i%cols.length];
      const card=document.createElement('div');
      card.className='l3d-card';
      card.style.cssText=`left:${X[i]}%;top:${Y[i]}%;`+
        `--rot:${rot[i]}deg;--rx:${rx[i]}deg;--ry:${ry[i]}deg;`+
        `--dur:${19+i*2.3}s;--delay:${(i*-2.7).toFixed(1)}s;`+
        `--op:${(0.30+(i%3)*0.16).toFixed(2)};`;
      card.innerHTML=`<div class="l3d-inner" style="--c1:${c[0]};--c2:${c[1]}"><span>${vals[i]}</span><div class="l3d-shine"></div></div>`;
      host.appendChild(card);
    }
  }
  let _lobbyFxInit=false;
  function initLobbyFx(){
    if(_lobbyFxInit) return; _lobbyFxInit=true;
    const layer=document.getElementById('lobby3d');
    const scr=document.getElementById('lobby-screen');
    // keep the floating-dock pill aligned when the viewport resizes
    let _lnavRz; window.addEventListener('resize',()=>{ clearTimeout(_lnavRz); _lnavRz=setTimeout(_initLnav,120); },{passive:true});
    // Mouse parallax — soft camera drift on the floating cards
    if(layer&&scr&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
      let tx=0,ty=0,cx=0,cy=0,raf=null;
      const loop=()=>{
        cx+=(tx-cx)*0.07; cy+=(ty-cy)*0.07;
        layer.style.transform=`translate3d(${(-cx*32).toFixed(1)}px,${(-cy*30).toFixed(1)}px,0)`;
        raf=(Math.abs(tx-cx)>5e-4||Math.abs(ty-cy)>5e-4)?requestAnimationFrame(loop):null;
      };
      scr.addEventListener('pointermove',e=>{
        tx=e.clientX/innerWidth-0.5; ty=e.clientY/innerHeight-0.5;
        if(!raf) raf=requestAnimationFrame(loop);
      },{passive:true});
    }
    // World chat — send on Enter
    const wi=document.getElementById('worldInput');
    if(wi) wi.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); sendWorld(); } });
    // UI hover / click sounds — soft and debounced
    const SEL='.lbtn,.btnA,.btnP,.btnS,.btnI,.rcard,.rtable,.cat-opt,.coin-pill-hdr,#huser,.game-menu-item';
    document.addEventListener('pointerover',e=>{
      const el=e.target.closest&&e.target.closest(SEL);
      if(el&&!el._hv){ el._hv=1; SFX.play('hover'); setTimeout(()=>{el._hv=0;},140); }
    },{passive:true});
    document.addEventListener('click',e=>{
      if(e.target.closest&&e.target.closest(SEL)) SFX.play('click');
    },{passive:true});
    // 3D pointer-tilt on room tables — real depth on hover
    if(!matchMedia('(pointer:coarse)').matches){
      document.addEventListener('pointermove',e=>{
        const card=e.target.closest&&e.target.closest('.rcard,.rtable');
        if(!card) return;
        const r=card.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-0.5, py=(e.clientY-r.top)/r.height-0.5;
        card.style.transform=`perspective(820px) rotateX(${(-py*9).toFixed(2)}deg) rotateY(${(px*12).toFixed(2)}deg) translateY(-10px)`;
      },{passive:true});
      document.addEventListener('pointerout',e=>{
        const card=e.target.closest&&e.target.closest('.rcard,.rtable');
        if(card&&!card.contains(e.relatedTarget)) card.style.transform='';
      },{passive:true});
    }
  }

  /* ═══ CARD ANIMATIONS ENGINE ═══ */
  const AnimLayer = {
    el: null,
    init(){ this.el = document.getElementById('cardAnimLayer'); },

    _cardColor(card){
      if(!card) return 'back';
      if(card.color === 'wild' || !card.color) return 'wild';
      return card.color;
    },

    _cardLabel(card){
      if(!card) return '';
      const v = card.value||'';
      const map = {skip:'⊘',reverse:'↺',draw_two:'+2',wild_draw_four:'+4',wild:'★'};
      return map[v] || v.toUpperCase();
    },

    // Deal: cards arc from the deck into the player's hand with impact.
    deal(count = 7, targetEl){
      if(!this.el || !targetEl) return;
      const g = window.gsap;
      const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
      const tr = targetEl.getBoundingClientRect();
      const deck = document.getElementById('drawpile');
      const dr = deck ? deck.getBoundingClientRect()
                      : {left:innerWidth/2-37,top:innerHeight/2-55,width:74,height:110};
      const sx = dr.left + dr.width/2, sy = dr.top + dr.height/2;
      const n = Math.min(count, 12);
      if(g && !reduced){
        for(let i=0;i<n;i++){
          const c = document.createElement('div');
          c.className = 'anim-card back';
          c.style.cssText = `left:${sx-37}px;top:${sy-55}px;opacity:0;will-change:transform,opacity;`;
          this.el.appendChild(c);
          const slotX = tr.left + tr.width * (n>1 ? 0.16 + 0.68*(i/(n-1)) : 0.5);
          const tx = slotX - sx;
          const ty = (tr.top + tr.height*0.42) - sy;
          const apexY = ty - (88 + Math.random()*54);     // arc apex above the hand
          const rot = Math.random()*26 - 13;
          // Bigger stagger + a flick sound on EVERY card → a deliberate,
          // one-card-at-a-time deal (the "tfri9a" feel from Ronda) instead of
          // a quick fan-out.
          g.timeline({delay:i*0.13})
            .set(c,{opacity:1})
            .to(c,{keyframes:[
              {x:tx*0.5, y:apexY, rotation:rot*0.5, scale:1.14, duration:0.22, ease:'power2.out'},
              {x:tx, y:ty+9, rotation:rot, scale:0.99, duration:0.2, ease:'power2.in'}
            ]},0)
            .to(c,{y:ty, scale:1, duration:0.22, ease:'back.out(3)',
              onStart:()=>{ try{SFX.play('draw');}catch(e){} }})
            .to(c,{opacity:0, duration:0.16, delay:0.06, onComplete:()=>c.remove()});
        }
        if(deck) g.fromTo(deck,{scale:1},{scale:0.93,duration:0.1,yoyo:true,repeat:1,
          ease:'power1.inOut',transformOrigin:'50% 100%',clearProps:'scale'});
        return;
      }
      // Fallback (no GSAP / reduced motion): simple flight
      for(let i=0;i<n;i++){
        setTimeout(()=>{
          const c=document.createElement('div');
          c.className='anim-card back';
          c.style.cssText=`left:${sx-37}px;top:${sy-55}px;`;
          const tx=tr.left+tr.width/2-sx, ty=tr.top+tr.height/2-sy;
          c.animate([
            {transform:'translate(0,0) scale(.6)',opacity:0},
            {transform:`translate(${tx}px,${ty}px) scale(1)`,opacity:1,offset:.75},
            {transform:`translate(${tx}px,${ty}px) scale(1)`,opacity:0}
          ],{duration:600,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
          this.el.appendChild(c);
          setTimeout(()=>c.remove(),650);
        }, i*55);
      }
    },

    // Play: card flies from hand to center pile
    play(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight*.8,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${this._cardColor(card)}`;
      c.textContent = this._cardLabel(card);
      c.style.cssText=`left:${from.left+from.width/2-37}px;top:${from.top+from.height/2-55}px;box-shadow:0 16px 34px rgba(0,0,0,.55),0 3px 8px rgba(0,0,0,.4);will-change:transform,opacity;`;
      // Deliberate "pick up → carry → set down": a clear lift off the hand,
      // a smooth glide to the pile, then a settle onto it — so the play reads
      // as a real, physical move instead of a quick flick.
      c.animate([
        {transform:'translate(0,0) scale(1) rotate(0)',opacity:1},
        {transform:'translate(0,-56px) scale(1.42) rotate(-6deg)',opacity:1,offset:.30},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1.06) rotate(3deg)`,opacity:1,offset:.84},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.97) rotate(0)`,opacity:1}
      ],{duration:600,easing:'cubic-bezier(.34,1.04,.4,1)',fill:'forwards'});
      this.el.appendChild(c);
      setTimeout(()=>c.remove(),720);
      // float label
      this._floatLabel(card, to);
    },

    // Draw: card pops into hand from deck
    draw(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight*.85,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${card?this._cardColor(card):'back'} draw-anim-card`;
      c.textContent = card ? this._cardLabel(card) : '';
      c.style.cssText=`left:${from.left+from.width/2-37}px;top:${from.top+from.height/2-55}px;`;
      c.animate([
        {transform:'scale(.6) rotate(15deg)',opacity:0},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1.1) rotate(-3deg)`,opacity:1,offset:.7},
        {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(1) rotate(0)`,opacity:1}
      ],{duration:500,easing:'cubic-bezier(.34,1.56,.64,1)',fill:'forwards'});
      this.el.appendChild(c);
      setTimeout(()=>c.remove(),650);
    },

    // Draw many: stagger N face-down cards flying from deck to target panel/hand
    drawMany(count, fromEl, toEl, opts = {}){
      if(!this.el || !count) return;
      const stagger = opts.stagger ?? 110;
      const duration = opts.duration ?? 720;
      const total = Math.min(count, 12);
      try{ SFX?.play && SFX.play('draw'); }catch(e){}
      // Resolve the DRAWING player's equipped card-back design, so the flying
      // cards show THEIR back (premium/default) — not a generic random one.
      // NOTE: S is a lexical const (not on window) — must reference it bare.
      let cbArt = '';
      try{
        if(opts.cardBackArt){
          cbArt = opts.cardBackArt;
        } else {
          const St = (typeof S!=='undefined') ? S : null;
          let cbId = opts.cardBackId || '';
          if(!cbId && opts.playerId && St){
            cbId = (St.g?.players||[]).find(p=>p.id===opts.playerId)?.cardBackId
                || (St.user && opts.playerId===St.user.id ? (St.user.equippedCardBack || St.user.cardBackId) : '')
                || 'cb_default';
          }
          if(cbId) cbArt = (window.Cosmetics?.cardBacks||[]).find(c=>c.id===cbId)?.art || '';
        }
      }catch(e){}
      const from0 = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:window.innerHeight/2,width:80,height:120};
      const to0   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight*.5,width:80,height:120};
      for(let i=0;i<total;i++){
        setTimeout(()=>{
          const fromEl2 = fromEl?.getBoundingClientRect ? fromEl.getBoundingClientRect() : from0;
          const toEl2 = toEl?.getBoundingClientRect ? toEl.getBoundingClientRect() : to0;
          const c = document.createElement('div');
          c.className = 'anim-card back' + (cbArt?' has-cb':'');
          const startX = fromEl2.left + fromEl2.width/2 - 37;
          const startY = fromEl2.top + fromEl2.height/2 - 55;
          c.style.cssText = `left:${startX}px;top:${startY}px;` + (cbArt?`background:${cbArt};`:'');
          const dx = toEl2.left + toEl2.width/2 - (startX+37);
          const dy = toEl2.top + toEl2.height/2 - (startY+55);
          // Tilt TOWARD the player (direction of travel) instead of at random,
          // so the cards clearly glide "his way" — tidy, not scattered.
          const rot = Math.max(-13, Math.min(13, dx/22));
          // Card lifts off the deck and GROWS as it glides — big + clear, right
          // in front of the eye — then settles into the target. Slower + more
          // prominent so you actually SEE the pick-up.
          c.animate([
            {transform:'translate(0,0) scale(.5) rotate(0deg)',                              opacity:0, offset:0},
            {transform:`translate(${dx*.26}px,${dy*.26}px) scale(1.32) rotate(${rot*.35}deg)`, opacity:1, offset:.30},
            {transform:`translate(${dx*.7}px,${dy*.7}px) scale(1.24) rotate(${rot*.7}deg)`,     opacity:1, offset:.64},
            {transform:`translate(${dx}px,${dy}px) scale(1.02) rotate(${rot}deg)`,            opacity:1, offset:.9},
            {transform:`translate(${dx}px,${dy}px) scale(.9) rotate(${rot}deg)`,              opacity:0, offset:1}
          ],{duration,easing:'cubic-bezier(.3,.74,.3,1)',fill:'forwards'});
          this.el.appendChild(c);
          setTimeout(()=>c.remove(), duration + 100);
          if(opts.onLand) try{opts.onLand(i,total)}catch(e){}
        }, i*stagger);
      }
    },

    // Opponent plays: a clean, realistic glide from the player's hand
    // straight to the discard pile. No bouncy scale, no rotation spin —
    // just a smooth slide with a subtle lift so the eye can follow it.
    opponentPlay(card, fromEl, toEl){
      if(!this.el) return;
      const from = fromEl?.getBoundingClientRect() || {left:window.innerWidth/2,top:80,width:0,height:0};
      const to   = toEl?.getBoundingClientRect()   || {left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
      const c = document.createElement('div');
      c.className = `anim-card ${this._cardColor(card)}`;
      c.textContent = this._cardLabel(card);
      const startX = from.left + from.width / 2 - 37;
      const startY = from.top  + from.height/ 2 - 55;
      const dx = (to.left + to.width / 2) - (startX + 37);
      const dy = (to.top  + to.height/ 2) - (startY + 55);
      c.style.cssText = `left:${startX}px;top:${startY}px;
        box-shadow:0 10px 24px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.35);
        will-change:transform,opacity;`;
      c.animate([
        { transform:'translate(0,0) scale(.92)',          opacity:0 },
        { transform:'translate(0,-18px) scale(1.05)',     opacity:1, offset:.22 },
        { transform:`translate(${dx}px,${dy}px) scale(.99)`, opacity:1 },
      ], { duration:560, easing:'cubic-bezier(.2,.7,.3,1)', fill:'forwards' });
      this.el.appendChild(c);
      setTimeout(()=>c.remove(), 600);
      this._floatLabel(card, to);
    },

    _floatLabel(card, pos){
      if(!card||!this.el) return;
      const v = card.value||'';
      const special = {skip:'⊘ SKIP',reverse:'↺ REVERSE',draw_two:'⚡ +2',wild_draw_four:'💥 +4',wild:'★ WILD'};
      const txt = special[v];
      if(!txt) return;
      const lbl = document.createElement('div');
      lbl.className='float-label';
      lbl.style.cssText=`left:${pos.left+pos.width/2-60}px;top:${pos.top-10}px;color:#F59E0B;`;
      lbl.textContent=txt;
      this.el.appendChild(lbl);
      setTimeout(()=>lbl.remove(),950);
    }
  };
