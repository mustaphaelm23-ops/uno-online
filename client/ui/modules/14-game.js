  /* ═══ GAME ACTIONS ═══ */
  function playCard(cardId){
    if(!canIPlay())return toast("Not your turn!",'e');
    const card=S.g.myHand.find(c=>c.id===cardId);if(!card)return;
    if(card.isWild){S.pendingWild=cardId;document.getElementById('cmodal').classList.add('show');return;}
    const el=document.querySelector(`.hcard[onclick*="${cardId}"]`);
    if(el){
      el.classList.add('playing');
      el.style.pointerEvents='none';
      const rect=el.getBoundingClientRect();
      const top=document.getElementById('topcard').getBoundingClientRect();
      const dx=top.left-rect.left;
      const dy=top.top-rect.top;
      el.style.setProperty('--fly-x',dx+'px');
      el.style.setProperty('--fly-y',dy+'px');
    }
    setTimeout(()=>{
      S.socket.emit('game:play_card',{cardId},(res)=>{
        if(!res.success){toast(res.reason,'e');SFX.play('error');if(el){el.classList.remove('playing');el.style.pointerEvents='';}}
        else{
          document.getElementById('cancelArea').style.display='none';
          if(S.g.myHand.length!==1)S.calledUNO=false;
          const myCard=S.g?.myHand?.find(c=>c.id===cardId);
          const pileEl=document.getElementById('topCard');
          if(myCard)AnimLayer.play(myCard,el,pileEl);
          SFX.play('play');
        }
      });
    },300);
  }
  function pickColor(color){
    document.getElementById('cmodal').classList.remove('show');
    const cardId=S.pendingWild;S.pendingWild=null;if(!cardId)return;
    S.socket.emit('game:play_card',{cardId,chosenColor:color},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{document.getElementById('cancelArea').style.display='none';toast(`Color: ${color.toUpperCase()}!`,'s');SFX.play('play');}
    });
  }
  function doDraw(){
    if(!canIDraw())return toast(canIPlay()?'Already drew — play or cancel':'Not your turn!','e');
    if(S.g.stackDraw>0)toast(`Taking ${S.g.stackDraw} stacked cards!`,'w');
    S.socket.emit('game:draw_card',{},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{
        const deckEl=document.getElementById('drawPile');
        const handEl=document.getElementById('myHand');
        AnimLayer.draw(null,deckEl,handEl);
      }
    });
  }
  function doCancel(){
    document.getElementById('cancelArea').style.display='none';S.g.turnPhase='waiting';
    S.socket.emit('game:pass',{},(res)=>{if(res&&!res.success)toast(res.reason||'Error','e');});
  }
  function doUNO(){
    if(S.g.myHand.length!==1)return toast('Need exactly 1 card!','e');
    S.socket.emit('game:call_uno',{},(res)=>{
      if(res.success){S.calledUNO=true;toast('UNO! 🎉','s');SFX.play('uno');updateUNOButton();}
      else toast(res.reason,'e');
    });
  }
  function showCatchButton(targetId){
    document.querySelectorAll('.opanel').forEach(p=>{
      if(p.dataset.pid===targetId){
        p.querySelectorAll('.catch-btn').forEach(b=>b.remove());
        const btn=document.createElement('button');btn.className='catch-btn';btn.textContent='CATCH!';
        btn.onclick=(e)=>{e.stopPropagation();S.socket.emit('game:catch_uno',{targetId},(res)=>{
          if(res.success)toast('Caught them! +2 cards!','s');else toast(res.reason,'e');removeCatch();});};
        p.appendChild(btn);setTimeout(()=>btn.remove(),2500);
      }
    });
  }
  function removeCatch(){document.querySelectorAll('.catch-btn').forEach(b=>b.remove());}
  function toggleGameMenu(){document.getElementById('gameMenu').classList.toggle('show');}
  function gameMenuProfile(){
    document.getElementById('gameMenu').classList.remove('show');
    setTimeout(()=>showProfile(),120);
  }
  function gameMenuLogout(){
    document.getElementById('gameMenu').classList.remove('show');
    if(S.roomId){
      if(!confirm('You are in a game. Logging out will forfeit it. Continue?')) return;
      S.socket?.emit('room:leave',{},()=>{ S.roomId=null; doLogout(); });
    } else {
      doLogout();
    }
  }
  let soundOn=true;
  function refreshSoundLabel(){
    const el=document.getElementById('soundLabel');
    if(el) el.textContent=`${t('sound')}: ${soundOn?'ON':'OFF'}`;
  }
  function toggleSound(){
    soundOn=!soundOn;
    refreshSoundLabel();
  }
  function confirmLeave(){
    toggleGameMenu();
    if(S.isSpectator){ doLeaveSpectate(); return; }
    if(confirm('Are you sure? You will lose the bet and your opponent wins!')){doLeaveGame();}
  }
  function doLeaveGame(){
    S.socket.emit('room:leave',{},()=>{
      S.roomId=null;showChatFab(false);Chat.open=false;
      document.getElementById('chatPanel').classList.remove('open');
      document.getElementById('chatMsgs').innerHTML='';document.getElementById('activityMsgs').innerHTML='';
      Chat.unread=0;updateChatBadge();goLobby();
    });
  }

  /* P5.1 — Victory podium 1->4. Renders the 4 slots from data.stats
     ordered: winner first, then everyone else by ascending finalHand
     (fewer cards left = better position). Highlights 1st with gold
     ring + larger avatar; the local player gets a subtle "ME" pill so
     they can spot themselves at a glance. */
  function _renderWinPodium(data){
    const box = document.getElementById('winPodium');
    if(!box) return;
    const stats = Array.isArray(data.stats) ? data.stats.slice() : [];
    const winnerId = data.winnerId;
    stats.sort((a,b) => {
      if(a.id === winnerId) return -1;
      if(b.id === winnerId) return 1;
      return (a.finalHand || 0) - (b.finalHand || 0);
    });
    const medals = ['🥇','🥈','🥉','4️⃣'];
    const slots = stats.slice(0, 4).map((p, i) => {
      const isWinner = p.id === winnerId;
      const isMe     = p.id === S.user?.id;
      const img = _isImgAvatar(p.avatar);
      const face = img ? '' : esc(p.avatar || (p.username || '?').charAt(0).toUpperCase());
      const meta = isWinner ? 'WINNER' : `${p.finalHand || 0} cards left`;
      return `<div class="podium-slot ${isWinner?'podium-1st':''} ${isMe?'podium-me':''}" data-pos="${i+1}">
        <div class="podium-rank">${medals[i]||(i+1)}</div>
        <div class="podium-avatar" style="${img?`background-image:url('${p.avatar}')`:''}">${face}</div>
        <div class="podium-name">${esc(p.username || '—')}${isMe?' <span class="podium-me-pill">YOU</span>':''}</div>
        <div class="podium-meta">${meta}</div>
      </div>`;
    }).join('');
    box.innerHTML = slots;
  }

  /* P5.1 — Rewards row. Coins = the actual payout (winner-only; losers
     paid their entry up front and don't get coins back). XP = the BP XP
     the server actually grants (220 for win, 90 for loss — matches the
     value in attachGameListeners). */
  function _renderWinRewards(data, iWon, payout){
    const box = document.getElementById('winRewards');
    if(!box) return;
    const coinsGain = iWon ? payout : 0;
    const xpGain    = iWon ? 220 : 90;
    box.innerHTML = `
      <div class="reward-cell">
        <div class="reward-ic">🪙</div>
        <div class="reward-val">${coinsGain > 0 ? '+' : ''}${coinsGain.toLocaleString()}</div>
        <div class="reward-lbl">Coins</div>
      </div>
      <div class="reward-cell">
        <div class="reward-ic">⭐</div>
        <div class="reward-val">+${xpGain}</div>
        <div class="reward-lbl">XP</div>
      </div>`;
  }

  /* P5.1 — Play Again: closes the win modal, then routes the player back
     into the same room TYPE they just played (Classic/Fun/Ranked/Chill).
     Falls back to QUICK_MATCH if the type is unknown (legacy room, private,
     or league match). Reuses the existing quickJoin pipeline from 12-lobby.js
     so the cinematic radar transition kicks in for free. */
  function winPlayAgain(){
    const type = S.lastMatchType || 'QUICK_MATCH';
    document.getElementById('winov')?.classList.remove('show');
    if(typeof quickJoin === 'function'){
      quickJoin(type);
    } else if(typeof backLobby === 'function'){
      backLobby();
    }
  }

  /* ═══ WIN ═══ */
  function showWin(data){
    const iWon=data.winnerId===S.user?.id;
    if(data.eloChange) showEloPopup(data.eloChange, iWon);
    const bet=data.bet||0;
    const forfeit=data.forfeit||false;
    // P4 — coin updates now arrive via the dedicated match:debited /
    // match:payout socket events (server is authoritative). showWin no
    // longer mirrors S.user.coins locally; reading data.payout / data.pot
    // / data.houseCut here is for DISPLAY only.
    // P5.1 — remember the room type the match was played in so the
    // "Play Again" button can route back into the same pool.
    if(data.roomType) S.lastMatchType = data.roomType;
    const wt=document.getElementById('wtitle');
    wt.textContent=iWon?'🏆 VICTORY!':'💀 GAME OVER';
    wt.className=`wtitle ${iWon?'w':'l'}`;
    document.getElementById('wdet').textContent=iWon?(forfeit?`${data.quitter} left the game!`:`Score: ${data.score}`):`${data.username} won!`;
    // Display the actual payout for the winner; losers paid their entry at
    // match-start so their game-end "delta" is 0 (the loss already happened).
    const payout = (typeof data.payout === 'number') ? data.payout : 0;
    const finalCoins = iWon ? payout : 0;
    const coinsEl=document.getElementById('wcoins');
    const sign = finalCoins > 0 ? '+' : '';
    coinsEl.textContent = `${sign}${finalCoins.toLocaleString()} 🪙`;
    // P5.1 — render the 4-slot podium + rewards row.
    _renderWinPodium(data);
    _renderWinRewards(data, iWon, payout);
    // Pot summary line replaces the old "Bet was X per player" hint so the
    // player can see the math: total pot, house cut, what they got.
    const wbetEl = document.getElementById('wbet');
    if(wbetEl){
      if(data.pot){
        wbetEl.textContent = iWon
          ? `Pot 🪙${data.pot.toLocaleString()} − 🪙${(data.houseCut||0).toLocaleString()} house = 🪙${payout.toLocaleString()}`
          : `Pot was 🪙${data.pot.toLocaleString()} (entry 🪙${bet} per player)`;
      } else {
        wbetEl.textContent = bet ? `Bet was 🪙${bet} per player` : '';
      }
    }
    // Man of the Match
    const mvpBox=document.getElementById('mvpBadge');
    if(data.mvp && mvpBox){
      const av=document.getElementById('mvpAvatar');
      if(data.mvp.avatar){av.style.backgroundImage=`url('${data.mvp.avatar}')`;av.textContent='';}
      else{av.style.backgroundImage='';av.textContent=(data.mvp.username||'?').charAt(0).toUpperCase();}
      document.getElementById('mvpName').textContent=data.mvp.username||'—';
      document.getElementById('mvpReason').textContent=data.mvp.reason||'';
      mvpBox.style.display='flex';
    } else if(mvpBox){
      mvpBox.style.display='none';
    }
    // Crowd favorite — only shown when at least one spectator voted
    const cfBox=document.getElementById('crowdFav');
    if(data.crowdFavorite && cfBox){
      const cf=data.crowdFavorite;
      const av=document.getElementById('crowdFavAvatar');
      if(cf.avatar){av.style.backgroundImage=`url('${cf.avatar}')`;av.textContent='';}
      else{av.style.backgroundImage='';av.textContent=(cf.username||'?').charAt(0).toUpperCase();}
      document.getElementById('crowdFavName').textContent=cf.username||'—';
      const pct=cf.total?Math.round((cf.votes/cf.total)*100):0;
      document.getElementById('crowdFavMeta').textContent=`${cf.votes} of ${cf.total} watcher vote${cf.total===1?'':'s'} (${pct}%)`;
      cfBox.style.display='flex';
    } else if(cfBox){
      cfBox.style.display='none';
    }
    const rays=document.querySelector('.win-rays'), spot=document.querySelector('.win-spot');
    if(rays) rays.style.display=iWon?'':'none';
    if(spot) spot.style.display=iWon?'':'none';
    document.getElementById('winov').classList.add('show');
    const g=window.gsap, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(g && !reduced){
      _playWinSeq(iWon, finalCoins);
    } else {
      coinsEl.textContent=(finalCoins>=0?'+':'')+finalCoins+' 🪙';
      if(iWon){ confetti(); SFX.play('win'); } else SFX.play('error');
    }
  }
  // Cinematic victory sequence — anticipation, slam, shake, confetti, coins.
  function _playWinSeq(iWon, coins){
    const g=window.gsap;
    const ov=document.getElementById('winov'), content=document.getElementById('winContent');
    const wt=document.getElementById('wtitle'), coinsEl=document.getElementById('wcoins');
    const reward=['wdet','wcoins','wbet'].map(id=>document.getElementById(id))
      .concat([document.getElementById('mvpBadge'),document.getElementById('crowdFav'),ov.querySelector('.win-back')])
      .filter(el=>el && el.style.display!=='none');
    g.killTweensOf([ov,content,wt,'.win-rays','.win-spot']);
    const tl=g.timeline();
    tl.fromTo(ov,{opacity:0},{opacity:1,duration:.28,ease:'power1.out'});
    if(iWon){
      tl.fromTo('.win-spot',{scale:0,opacity:0},{scale:1,opacity:1,duration:.7,ease:'power2.out'},0)
        .fromTo('.win-rays',{scale:.4,opacity:0},{scale:1,opacity:1,duration:1,ease:'power2.out'},0)
        .fromTo(wt,{scale:2.7,opacity:0,filter:'blur(10px)'},
          {scale:1,opacity:1,filter:'blur(0px)',duration:.5,ease:'back.out(1.7)',
           onComplete:()=>g.set(wt,{clearProps:'transform,filter,opacity'})},.16)
        .call(()=>{ try{SFX.play('win');}catch(e){} confetti(); })
        .fromTo(content,{x:-11},{x:11,duration:.05,repeat:5,yoyo:true,ease:'none',clearProps:'x'},'>-0.03')
        .call(()=>{ _winCoinCount(coinsEl,coins); if(coins>0) _coinBurst(coinsEl); })
        .fromTo(reward,{y:26,opacity:0},{y:0,opacity:1,duration:.5,stagger:.09,ease:'power3.out'},'>-0.12');
    } else {
      coinsEl.textContent=(coins>=0?'+':'')+coins+' 🪙';
      tl.fromTo(content,{y:26,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},0);
      try{ SFX.play('error'); }catch(e){}
    }
  }
  function _winCoinCount(el,target){
    const g=window.gsap, sign=target<0?'-':'+', abs=Math.abs(target), o={v:0};
    g.to(o,{v:abs,duration:1.15,ease:'power2.out',
      onUpdate:()=>{ el.textContent=sign+Math.round(o.v).toLocaleString()+' 🪙'; },
      onComplete:()=>{ el.textContent=sign+abs.toLocaleString()+' 🪙'; }});
  }
  function _coinBurst(originEl){
    const g=window.gsap;
    const r=originEl.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<18;i++){
      const c=document.createElement('div');
      c.className='win-coin-particle'; c.textContent='🪙';
      c.style.left=cx+'px'; c.style.top=cy+'px';
      document.body.appendChild(c);
      const ang=Math.random()*Math.PI*2, dist=130+Math.random()*240;
      g.to(c,{x:Math.cos(ang)*dist,y:Math.sin(ang)*dist-60-Math.random()*120,
        rotation:(Math.random()-.5)*620,scale:.5+Math.random()*1.1,
        duration:.95+Math.random()*.5,ease:'power3.out'});
      g.to(c,{opacity:0,duration:.45,delay:.6+Math.random()*.3,onComplete:()=>c.remove()});
    }
  }

  /* ═══ CLUTCH MOMENTS ═══
     Triggered when any player goes from 2+ cards to 1 card. We watch
     player handSize across state updates and fire a quick cinematic
     (full-screen flash, dramatic sting, slow-mo on the board). */
  const Clutch = {
    lastHands: {},
    lastFiredAt: 0,
    check(players){
      if(!players || S.isSpectator===false && !S.roomId) return;
      const now = Date.now();
      players.forEach(p => {
        const prev = this.lastHands[p.id];
        if (prev !== undefined && prev > 1 && p.handSize === 1 && now - this.lastFiredAt > 1500) {
          this.lastFiredAt = now;
          this.fire(p);
        }
        this.lastHands[p.id] = p.handSize;
      });
    },
    reset(){ this.lastHands = {}; this.lastFiredAt = 0; },
    fire(player){
      const ov = document.getElementById('clutchOv');
      const nameEl = document.getElementById('clutchName');
      if (!ov || !nameEl) return;
      nameEl.textContent = (player.username || 'PLAYER').toUpperCase();
      // Dramatic synth sting (3-note rising chord)
      try {
        if (typeof soundOn === 'undefined' || soundOn) {
          SFX.init();
          const c = SFX.ctx, now = c.currentTime;
          [261.63, 392.00, 523.25].forEach((freq, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.value = freq;
            o.connect(g); g.connect(c.destination);
            const t = now + i * 0.08;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.16, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
            o.start(t); o.stop(t + 0.6);
          });
        }
      } catch(e) {}
      document.body.classList.add('clutch');
      ov.classList.add('show');
      const txt = document.getElementById('clutchTxt');
      txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = '';
      setTimeout(() => {
        ov.classList.remove('show');
        document.body.classList.remove('clutch');
      }, 1100);
    }
  };
  function backLobby(){
    document.getElementById('winov').classList.remove('show');
    // Tell the server we're leaving the (already finished) room so it stops
    // routing any lingering events to us, then go to lobby
    if(S.roomId && S.socket){
      S.socket.emit('room:leave',{},()=>{ S.roomId=null; goLobby(); });
    } else {
      S.roomId=null; goLobby();
    }
  }

  function confetti(){
    const cols=['#E8324A','#F59E0B','#16A34A','#2563EB','#7C3AED','#EC4899','#06B6D4','#fff'];
    const cvs=document.createElement('canvas');
    cvs.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:160';
    document.body.appendChild(cvs);cvs.width=innerWidth;cvs.height=innerHeight;
    const ctx=cvs.getContext('2d');
    const ps=Array.from({length:200},()=>{
      const type=Math.random();
      return{x:Math.random()*cvs.width,y:-30-Math.random()*200,
        w:type<.3?3:8+Math.random()*12,h:type<.3?12:4+Math.random()*8,
        c:cols[~~(Math.random()*cols.length)],
        r:Math.random()*Math.PI*2,rs:(Math.random()-.5)*.2,
        sp:1.5+Math.random()*4,dr:(Math.random()-.5)*2.5,
        swing:Math.random()*Math.PI*2,swingSpeed:.02+Math.random()*.03};
    });
    const t0=Date.now();
    (function draw(){ctx.clearRect(0,0,cvs.width,cvs.height);ps.forEach(p=>{
      p.y+=p.sp;p.x+=p.dr+Math.sin(p.swing)*1.5;p.swing+=p.swingSpeed;p.r+=p.rs;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);
      ctx.globalAlpha=Math.min(1,Math.max(0,1-(p.y/cvs.height)));
      ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });if(Date.now()-t0<6000)requestAnimationFrame(draw);else cvs.remove();})();
  }

  /* ═══ GAME PARTICLES ═══ */
  function initGameParticles(){
    AnimLayer.init();
    const c=document.getElementById('gameParticles');c.innerHTML='';
    for(let i=0;i<20;i++){
      const p=document.createElement('div');p.className='game-particle';
      p.style.cssText=`left:${Math.random()*100}%;animation-delay:${Math.random()*12}s;animation-duration:${10+Math.random()*8}s;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;`;
      c.appendChild(p);
    }
  }

  /* ═══ BACKGROUND ═══ */
  function buildBg(){
    const bg=document.getElementById('auth-bg');
    const cols=['#E8324A','#2563EB','#16A34A','#F59E0B','#7C3AED'];
    for(let i=0;i<16;i++){
      const d=document.createElement('div');d.className='auth-bg-card';
      d.style.cssText=`left:${Math.random()*90}%;top:${Math.random()*90}%;background:${cols[i%cols.length]};--r:${(Math.random()-.5)*40}deg;transform:rotate(var(--r));animation-delay:${Math.random()*5}s;animation-duration:${7+Math.random()*6}s;`;
      bg.appendChild(d);
    }
  }

