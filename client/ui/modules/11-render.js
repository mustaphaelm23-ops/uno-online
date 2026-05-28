  /* ═══ RENDER ═══ */
  function renderOpps(players){
    S.g.players=players;
    const row=document.getElementById('orow'),others=players.filter(p=>!isMe(p.id));
    const showMute = VoiceChat.isOn && players.length >= 3;
    // Render key includes `abandoned` so a player flipping to abandoned mid-
    // match re-renders the panel without waiting for some other state delta.
    const newKey=others.map(p=>`${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.isConnected?1:0}:${p.abandoned?1:0}:${p.id===S.g.currentTurn?1:0}:${p.avatar?'a':'n'}:${showMute?(VoiceChat.mutedPeers?.has(p.id)?'m':'u'):'-'}`).join('|');
    if(row._lastKey===newKey) return;
    row._lastKey=newKey;
    row.innerHTML=others.map(p=>{
      const max=Math.min(p.handSize,10);
      const cards=Array.from({length:max},(_,i)=>`
        <div style="width:44px;height:66px;border-radius:8px;
          background:linear-gradient(145deg,#E8324A 50%,#1A1D2E 50%);
          border:2px solid rgba(255,255,255,.25);
          display:inline-flex;align-items:center;justify-content:center;
          margin-left:${i===0?'0':'-22px'};position:relative;z-index:${i};
          box-shadow:3px 4px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.15);
          flex-shrink:0;overflow:hidden;
          transform:perspective(300px) rotateY(${-8+i*2}deg) rotateX(3deg);
          transition:transform .3s ease;">
          <div style="font-family:'Bangers',cursive;font-size:9px;color:rgba(255,255,255,.35);transform:rotate(-15deg);text-shadow:0 1px 2px rgba(0,0,0,.5)">UNO</div>
        </div>`).join('');
      const avatar = _isImgAvatar(p.avatar)
        ? `<div class="opp-avatar" style="background-image:url('${p.avatar}')"></div>`
        : `<div class="opp-avatar opp-avatar-letter">${esc(p.avatar||(p.username||'?').charAt(0).toUpperCase())}</div>`;
      const isMuted = VoiceChat.mutedPeers?.has(p.id);
      const muteBtn = showMute
        ? `<button class="mute-toggle ${isMuted?'muted':''}" onclick="VoiceChat.toggleMutePeer('${p.id}')" title="${isMuted?'Unmute':'Mute'} ${esc(p.username)}'s mic">${isMuted?'🔇':'🔊'}</button>`
        : '';
      // Panel state classes (P4-NEW.1a polish):
      //   .abandoned -> grace expired, bot is playing the seat (sticky for the match)
      //   .dc        -> disconnected but still in 30s grace window
      // Sub-line below the hand shows the matching status text. Avatar is
      // greyscale + dimmed via the class on the panel.
      const panelMod = p.abandoned ? ' abandoned' : (!p.isConnected ? ' dc' : '');
      const status = p.abandoned
        ? '<div class="opanel-status abandoned">💀 Abandoned — bot playing</div>'
        : (!p.isConnected
            ? '<div class="opanel-status dc">⏳ Reconnecting…</div>'
            : '');
      return`<div class="opanel ${p.id===S.g.currentTurn?'myturn':''}${panelMod}" data-pid="${p.id}">
          ${muteBtn}
          <div class="oname-row">${avatar}<div class="oname" style="color:${p.id===S.g.currentTurn?'var(--accent)':'var(--text)'}">${esc(p.username)}${p.saidUno?'<span class="ouno">UNO!</span>':''}</div></div>
          <div style="display:flex;align-items:center;height:70px;min-width:${Math.min(max*20+44,190)}px">${cards}${p.handSize>10?`<div style="font-size:11px;color:var(--muted);margin-left:6px;font-weight:700">+${p.handSize-10}</div>`:''}</div>
          ${status}
        </div>`;
    }).join('');
  }

  function renderTop(card){
    if(!card)return;S.g.topCard=card;
    const el=document.getElementById('topcard'),color=card.chosenColor||card.color;
    el.className=`ucard nohov ${color} topcard-land`;el.innerHTML=buildCardHTML(color,card.value);
    setTimeout(()=>el.classList.remove('topcard-land'),350);
  }

  function renderHand(){
    const g=S.g,playable=new Set(g.myPlayable),can=canIPlay(),c=document.getElementById('myhand');
    document.getElementById('mycnt').textContent=g.myHand.length;
    // Only re-render if hand actually changed
    const newKey = g.myHand.map(c=>c.id+(playable.has(c.id)?'p':'')).join(',')+'|'+g.turnPhase+'|'+g.currentTurn;
    if(c._lastKey === newKey) return;
    c._lastKey = newKey;
    c.innerHTML=g.myHand.map((card,i)=>{
      const color=card.chosenColor||card.color,ok=playable.has(card.id)&&can;
      const isDrawn=card.id===g.drawnCardId;
      return`<div class="hcard ${color} ${ok?'play':''} ${isDrawn?'drawn':''}"
        style="z-index:${i+1}${isDrawn?';box-shadow:0 0 20px var(--glow-yellow)':''}"
        onclick="${ok?`playCard('${card.id}')`:''}"
        title="${card.color} ${card.value}">
        ${buildCardHTML(color,card.value)}
      </div>`;
    }).join('');
  }

  function updateUNOButton(){
    const btn=document.getElementById('btnUNO');
    if(!btn)return;
    if(S.g.myHand.length===1&&!S.calledUNO&&myTurn()){btn.classList.remove('disabled');}
    else{btn.classList.add('disabled');if(S.g.myHand.length!==1)S.calledUNO=false;}
  }

  /* ═══ MATCH-START CARD-DEAL ANIMATION ═══
     P5.2. Fired by applyFullState when phase transitions lobby->playing
     (i.e. the host just clicked Start). Spawns face-down overlay cards at
     the deck position and flies one to each of MY hand-card slots, then a
     symbolic card per opponent to their panel. The actual #myhand cards
     are hidden during the fly so the overlay reads as the same card; on
     landing, the overlay removes and the real card is revealed. Pure
     additive layer — does NOT touch the deck logic or play/draw flow.

     Collision-safe with parallel gameplay work:
       - Reads ONLY #drawpile / .myhand .hcard / .opanel bounding rects.
       - Does NOT read data-card-id or modify any state.
       - Bails silently on missing rects, GSAP, or reduced-motion. */
  function animateMatchDeal(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    if(!window.gsap) return;
    const deck = document.getElementById('drawpile');
    if(!deck) return;
    const fromRect = deck.getBoundingClientRect();
    if(!fromRect.width) return;

    // Self hand: each .hcard slot is a deal target. We hide the real card
    // for the flight duration so the overlay reads as the same physical card.
    const handCards = Array.from(document.querySelectorAll('.myhand .hcard'));
    // Opponents: one symbolic deal-card per opp panel, fired after self's
    // deal so the human sees their own hand land first.
    const oppPanels = Array.from(document.querySelectorAll('.opanel'));

    const selfPerCard = 0.07;                     // stagger between self cards
    const selfDuration = 0.42;
    const oppPerCard   = 0.10;
    const oppDuration  = 0.50;
    const oppStartDelay = handCards.length * selfPerCard + 0.05;

    handCards.forEach((card, i) => {
      const toRect = card.getBoundingClientRect();
      if(!toRect.width) return;
      // Hide the real hand card until the overlay lands on it.
      card.style.visibility = 'hidden';

      const overlay = document.createElement('div');
      overlay.className = 'ucard ucard-deal cardback';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.position = 'fixed';
      overlay.style.left = (fromRect.left + fromRect.width/2) + 'px';
      overlay.style.top  = (fromRect.top  + fromRect.height/2) + 'px';
      overlay.style.zIndex = '9001';
      overlay.style.pointerEvents = 'none';
      document.body.appendChild(overlay);

      const dx = (toRect.left + toRect.width/2) - (fromRect.left + fromRect.width/2);
      const dy = (toRect.top  + toRect.height/2) - (fromRect.top  + fromRect.height/2);
      window.gsap.set(overlay, { xPercent: -50, yPercent: -50, scale: 0.65, rotation: 0 });
      window.gsap.to(overlay, {
        x: dx, y: dy,
        scale: 1.0,
        rotation: -180 + Math.random() * 360,
        duration: selfDuration,
        ease: 'power2.out',
        delay: i * selfPerCard,
        onComplete: () => {
          overlay.remove();
          card.style.visibility = '';
        },
      });
    });

    oppPanels.forEach((panel, i) => {
      const toRect = panel.getBoundingClientRect();
      if(!toRect.width) return;

      const overlay = document.createElement('div');
      overlay.className = 'ucard ucard-deal cardback';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.position = 'fixed';
      overlay.style.left = (fromRect.left + fromRect.width/2) + 'px';
      overlay.style.top  = (fromRect.top  + fromRect.height/2) + 'px';
      overlay.style.zIndex = '9001';
      overlay.style.pointerEvents = 'none';
      document.body.appendChild(overlay);

      const dx = (toRect.left + toRect.width/2) - (fromRect.left + fromRect.width/2);
      const dy = (toRect.top  + toRect.height/2) - (fromRect.top  + fromRect.height/2);
      window.gsap.set(overlay, { xPercent: -50, yPercent: -50, scale: 0.50, rotation: 0 });
      window.gsap.to(overlay, {
        x: dx, y: dy,
        scale: 0.65,                            // opp cards stay smaller (perspective)
        rotation: 180,
        duration: oppDuration,
        ease: 'power2.out',
        delay: oppStartDelay + i * oppPerCard,
        onComplete: () => overlay.remove(),
      });
    });
  }

  /* ═══ CARD-PLAY FLY ANIMATION ═══
     P3.4. When game:card_played fires, an overlay copy of the played card
     flies from the sender's seat (or .myhand for self) to the discard pile,
     spins, then dissolves into the (already-updated) topcard. Pure visual
     overlay: does NOT touch the play emit, server validation, or state
     update path — those run normally. The animation is purely additive.

     Collision-safe with parallel gameplay fixes:
       - Reads ONLY .myhand / .opanel[data-pid] / #topcard bounding rects.
       - Does NOT read data-card-id (intentionally — keeps the selector
         surface minimal so card-attr renames don't break it).
       - Bails silently if any rect is missing.
     Respects prefers-reduced-motion (skips entirely). */
  function animateCardPlay(card, playerId){
    if(!card || !playerId) return;
    // Don't animate during your own move? No — animate everyone for consistency.
    // Skip if reduced-motion is set.
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    // Skip if GSAP isn't available (graceful degradation).
    if(!window.gsap) return;

    const fromRect = (playerId === S.user?.id)
      ? document.querySelector('.myhand')?.getBoundingClientRect()
      : document.querySelector(`.opanel[data-pid="${playerId}"]`)?.getBoundingClientRect();
    const toRect = document.getElementById('topcard')?.getBoundingClientRect();
    if(!fromRect || !fromRect.width || !toRect || !toRect.width) return;

    // Build the overlay card with the same visual vocabulary as the rest of
    // the game (.ucard + color class + buildCardHTML inner).
    const overlay = document.createElement('div');
    overlay.className = `ucard ucard-flying ${card.color || ''}`;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = (typeof buildCardHTML === 'function')
      ? buildCardHTML(card.color, card.value)
      : '';
    overlay.style.position = 'fixed';
    overlay.style.left = (fromRect.left + fromRect.width/2) + 'px';
    overlay.style.top  = (fromRect.top  + fromRect.height/2) + 'px';
    overlay.style.zIndex = '9000';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);

    // xPercent/yPercent self-center the overlay on its left/top anchor point.
    // GSAP composes these with the animated x/y delta below.
    window.gsap.set(overlay, { xPercent: -50, yPercent: -50, scale: 0.85, rotation: 0 });
    const dx = (toRect.left + toRect.width/2) - (fromRect.left + fromRect.width/2);
    const dy = (toRect.top  + toRect.height/2) - (fromRect.top  + fromRect.height/2);
    window.gsap.to(overlay, {
      x: dx,
      y: dy,
      scale: 1.0,
      rotation: 540,                                   // 1.5 spins for satisfying whip
      duration: 0.45,
      ease: 'power2.in',                               // accelerates toward landing
      onComplete: ()=> overlay.remove(),
    });
  }

  /* ═══ TURN TIMER RING ═══
     Drives the SVG ring around the discard pile. Server pushes turnEndsAt
     (epoch ms) + turnTimeout (total ms) on every state update via S.g.
     sync() is called from applyFullState whenever new state lands; it
     starts / stops / re-anchors the rAF loop. The loop computes a smooth
     stroke-dashoffset (pathLength=100, so dashoffset = remaining% × 100)
     and toggles .urgent when remaining < 5s so the ring shifts red + pulses. */
  const TurnTimer = {
    raf: null,
    ringEl: null,
    fillEl: null,
    wrapEl: null,
    URGENT_MS: 5000,
    _last: { offset: -1, urgent: null, active: null },

    sync(){
      // Resolve DOM lazily — the game screen may not be mounted yet.
      if(!this.ringEl) this.ringEl = document.getElementById('turnRing');
      if(!this.fillEl) this.fillEl = this.ringEl?.querySelector('.turn-ring-fill');
      if(!this.wrapEl) this.wrapEl = document.getElementById('topcardWrap');
      if(!this.ringEl || !this.fillEl) return;

      const g = S.g || {};
      const hasDeadline = g.phase !== 'lobby'                              // game in motion
                       && g.turnEndsAt != null && g.turnTimeout > 0
                       && g.currentTurn;
      this._setActive(!!hasDeadline);
      if(!hasDeadline){
        this._stop();
        this._setOffset(100);                                              // empty ring
        this._setUrgent(false);
        return;
      }
      this._start();
    },

    _setActive(on){
      if(this._last.active === on) return;
      this._last.active = on;
      if(this.wrapEl) this.wrapEl.classList.toggle('turn-ring-on', on);
    },
    _setUrgent(on){
      if(this._last.urgent === on) return;
      this._last.urgent = on;
      if(this.wrapEl) this.wrapEl.classList.toggle('turn-ring-urgent', on);
    },
    // pathLength is 100 on the circle, so offset = remaining% * 100 fills CCW.
    // Going from full (100) → empty (0) as time elapses.
    _setOffset(o){
      if(Math.abs(o - this._last.offset) < 0.4) return;                    // skip redundant writes
      this._last.offset = o;
      this.fillEl.setAttribute('stroke-dashoffset', String(o));
    },

    _start(){
      if(this.raf) return;
      const tick = ()=>{
        this.raf = null;
        const g = S.g || {};
        if(g.turnEndsAt == null || !g.turnTimeout){ this._stop(); return; }
        const now = Date.now();
        const remaining = Math.max(0, g.turnEndsAt - now);
        const pct = Math.min(1, Math.max(0, remaining / g.turnTimeout));
        this._setOffset((1 - pct) * 100);                                  // dashoffset grows as time drains
        this._setUrgent(remaining > 0 && remaining < this.URGENT_MS);
        if(remaining <= 0){ this._stop(); return; }                        // server will push the next deadline
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },
    _stop(){
      if(this.raf){ cancelAnimationFrame(this.raf); this.raf = null; }
    },
  };

