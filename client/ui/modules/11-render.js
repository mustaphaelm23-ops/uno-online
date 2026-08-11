  /* ═══ RENDER ═══ */
  // Resolve an opponent's equipped card-back art (a CSS background string)
  // from the broadcast cardBackId, using the locally-loaded cosmetics
  // catalog. Returns '' if unknown (catalog not loaded / default) so the
  // seat tile falls back to its plain styled look.
  function _oppCardBackArt(id){
    if(!id) return '';
    try{ return (window.Cosmetics?.cardBacks || []).find(c => c.id === id)?.art || ''; }
    catch(_){ return ''; }
  }

  // 2v2 TEAM MODE — render my partner's hand FACE-UP as a small strip up top so
  // we can play as "2 players in 1". Only shown when the server sends
  // g.teammateHand (i.e. teamMode + I have a partner).
  const _TM_COLORS = { red:'#E8324A', blue:'#2563EB', green:'#16A34A', yellow:'#F59E0B', wild:'#26264a', black:'#26264a' };
  function _tmCardLabel(v){
    if(v==='skip') return '⊘';
    if(v==='reverse') return '⇄';
    if(v==='draw_two') return '+2';
    if(v==='wild') return '★';
    if(v==='wild_draw_four') return '+4';
    return String(v);
  }
  function renderTeammateHand(){
    const g = S.g;
    let box = document.getElementById('teammateHand');
    const show = g && g.teamMode && Array.isArray(g.teammateHand) && g.teammateId;
    if(!show){ if(box) box.style.display='none'; return; }
    if(!box){
      box = document.createElement('div'); box.id='teammateHand'; box.className='teammate-hand';
      (document.getElementById('game-screen') || document.body).appendChild(box);
    }
    box.style.display='flex';
    const name  = esc(g.teammateName || 'Partner');
    const cards = g.teammateHand.map(card=>{
      const color = card.chosenColor || card.color;
      const bg = _TM_COLORS[color] || '#26264a';
      return `<div class="tm-card" style="background:${bg}" title="${esc(color)} ${esc(card.value)}">${_tmCardLabel(card.value)}</div>`;
    }).join('');
    box.innerHTML = `<div class="tm-label">🤝 ${name} · your partner (${g.teammateHand.length})</div><div class="tm-cards">${cards}</div>`;
  }

  // Stamp a "SKIPPED" mark on a player who was jumped by a Skip card — so it's
  // clear who lost their turn and who plays next. Opponents get it on their
  // avatar; if it's me, a centered pill flashes so I notice.
  function _flashSkip(playerId){
    try{
      const isMe = (window.S && S.user && playerId === S.user.id);
      if(isMe){
        document.querySelectorAll('.skip-stamp-me').forEach(e=>e.remove());
        const b=document.createElement('div');
        b.className='skip-stamp skip-stamp-me';
        b.innerHTML='<span>⊘</span> SKIPPED';
        document.body.appendChild(b);
        setTimeout(()=>{ b.classList.add('out'); setTimeout(()=>b.remove(),320); }, 1300);
        return;
      }
      const host = document.querySelector(`.opanel[data-pid="${playerId}"]`);
      if(!host) return;
      host.querySelectorAll('.skip-stamp').forEach(e=>e.remove());
      const b=document.createElement('div');
      b.className='skip-stamp';
      b.innerHTML='<span>⊘</span>SKIP';
      host.appendChild(b);
      setTimeout(()=>{ b.classList.add('out'); setTimeout(()=>b.remove(),320); }, 1400);
    }catch(_){}
  }

  // Toggle a remote player's mic locally + update the button instantly (no
  // wait for the next state render), so the mute feels responsive.
  window._unoToggleMute = function(pid, btn){
    if(typeof VoiceChat !== 'undefined' && VoiceChat.toggleMutePeer) VoiceChat.toggleMutePeer(pid);
    const muted = (typeof VoiceChat !== 'undefined') && VoiceChat.mutedPeers?.has(pid);
    if(btn){
      btn.classList.toggle('muted', !!muted);
      btn.textContent = muted ? '🔇' : '🎤';
      btn.title = (muted ? 'Unmute' : 'Mute') + " mic";
    }
  };

  function renderOpps(players){
    S.g.players=players;
    const row=document.getElementById('orow'),others=players.filter(p=>!isMe(p.id));
    // Flag 4-player (2v2) games so the CSS can lay opponents out around
    // the felt — partner across the table, opponents on left + right —
    // instead of all three in a top row.
    row.classList.toggle('is-2v2', others.length === 3);
    // ALWAYS show the per-opponent mic toggle (was previously gated on
    // VoiceChat.isOn). Users want to see who's mutable at a glance and
    // be able to silence an opponent BEFORE joining the call.
    const showMute = players.length >= 2;
    // Render key includes `abandoned` so a player flipping to abandoned mid-
    // match re-renders the panel without waiting for some other state delta.
    const newKey=others.map(p=>`${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.isConnected?1:0}:${p.abandoned?1:0}:${p.id===S.g.currentTurn?1:0}:${p.avatar?'a':'n'}:${showMute?(VoiceChat.mutedPeers?.has(p.id)?'m':'u'):'-'}:${p.rankedTier?.name||''}:${p.cardBackId||''}:${p.profileBanner||''}`).join('|');
    if(row._lastKey===newKey) return;
    row._lastKey=newKey;
    row.innerHTML=others.map(p=>{
      // ── "Pro" opponent seat — round avatar + name + a FANNED hand of card
      //    backs, the count read from the fan like a real UNO table. ──
      const count   = p.handSize || 0;
      const isImg   = _isImgAvatar(p.avatar);
      const initial = esc((p.avatar || (p.username || '?')).charAt(0).toUpperCase());
      const isMuted = VoiceChat.mutedPeers?.has(p.id);
      const muteBtn = showMute
        ? `<button class="mute-toggle ${isMuted?'muted':''}" title="${isMuted?'Unmute':'Mute'} ${esc(p.username)}'s mic" onclick="event.stopPropagation();if(typeof _unoToggleMute==='function')_unoToggleMute('${esc(p.id)}',this)">${isMuted?'🔇':'🎤'}</button>`
        : '';
      const panelMod = p.abandoned ? ' abandoned' : (!p.isConnected ? ' dc' : '');
      const status = p.abandoned
        ? '<div class="opanel-status abandoned">💀 Abandoned</div>'
        : (!p.isConnected
            ? '<div class="opanel-status dc">⏳ Reconnecting…</div>'
            : '');
      const unoTag = p.saidUno ? '<span class="opp-pro-uno">Cardora!</span>' : '';
      // Fan of card backs — uses THIS opponent's equipped back (or red default).
      const cbArt = _oppCardBackArt(p.cardBackId);
      const fanN  = Math.max(1, Math.min(count, 6));
      const fan   = Array.from({ length: fanN }).map((_, i) =>
        `<span class="opp-fan-card${cbArt?' has-cb':''}" style="--i:${i};--n:${fanN}${cbArt?`;background:${cbArt}`:''}"></span>`
      ).join('');
      // Profile banner plaque behind the avatar + name (ranked reward, default
      // royal-gold). Shows each player's earned/equipped banner at the table.
      const _bIds  = ['royal-gold','sapphire','royal-crimson','amethyst','inferno'];
      const banner = _bIds.includes(p.profileBanner) ? p.profileBanner : 'royal-gold';
      return `<div class="opanel opanel-pro ${p.id===S.g.currentTurn?'myturn':''}${panelMod}" data-pid="${p.id}" title="View ${esc(p.username||'player')}'s profile" onclick="if(typeof showOpponentProfile==='function')showOpponentProfile('${esc(p.id)}')">
          ${muteBtn}
          <div class="opp-pro-fan" aria-label="${count} card${count===1?'':'s'}">${fan}</div>
          <div class="opp-pro-plaque banner-${banner}" style="background-image:url('/banners/${banner}.png')">
            <div class="opp-pro-avwrap">
              <div class="opp-pro-av${isImg?'':' opp-pro-av-letter'}"${isImg?` style="background-image:url('${esc(p.avatar)}')"`:''}>${isImg?'':initial}</div>
              <span class="opp-pro-cnt">${count}</span>
            </div>
            <div class="opp-pro-name">${esc(p.username)}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}${unoTag}</div>
          </div>
          ${status}
        </div>`;
    }).join('');

    // Wire the document-level CAPTURE click handler (idempotent). This is the
    // ONLY click mechanism — it fires before bubbling, so it works even on the
    // position:fixed side seats whose bubbled child events some mobile WebViews
    // drop. Panel → opens profile, mic chip → toggles mute.
    _ensureOpanelClickHandler();
  }

  // Idempotent — attaches the global opanel handler the first time it
  // runs, no-op every call after. Handles both `click` and `touchend`
  // so a mobile tap that doesn't synthesise a click event (some Android
  // WebViews under certain touch-action settings) still works.
  function _ensureOpanelClickHandler(){
    if(window._opanelClickWired) return;
    window._opanelClickWired = true;
    const handle = (ev) => {
      const path = (typeof ev.composedPath === 'function') ? ev.composedPath() : [];
      // Find the mic chip FIRST so a tap inside it always toggles mute,
      // never falls through to the profile sheet.
      let muteBtn = null, panel = null;
      for(const node of path){
        if(!muteBtn && node.classList?.contains('mute-toggle')) muteBtn = node;
        if(!panel   && node.classList?.contains('opanel'))      panel   = node;
        if(muteBtn && panel) break;
      }
      // Fallback to .closest() for older browsers without composedPath.
      if(!panel && ev.target?.closest) panel = ev.target.closest('.opanel');
      if(!muteBtn && ev.target?.closest) muteBtn = ev.target.closest('.mute-toggle');
      if(!panel) return;                       // not our click
      const pid = panel.dataset?.pid;
      if(!pid) return;
      if(muteBtn){
        ev.stopPropagation();
        if(typeof window._unoToggleMute === 'function') window._unoToggleMute(pid, muteBtn);
        else if(typeof VoiceChat !== 'undefined') VoiceChat.toggleMutePeer(pid);
        return;
      }
      // stopPropagation so the panel's inline onclick fallback doesn't ALSO fire
      // (it only runs when this capture handler somehow didn't — e.g. a webview
      // that drops the document-level listener).
      ev.stopPropagation();
      if(typeof showOpponentProfile === 'function') showOpponentProfile(pid);
    };
    // Capture phase — desktop mouse + most mobile taps come through here.
    document.addEventListener('click', handle, true);

    // TOUCH fallback — some mobile webviews don't synthesise a usable `click`
    // on these panels (especially the position:fixed side seats), which is why
    // tapping a profile/mic "did nothing". We detect a genuine TAP (finger
    // barely moved) that landed on a panel and route it through the same
    // handler. preventDefault() on that tap suppresses the synthetic click, so
    // it never double-fires — and it ONLY touches taps that hit a panel, so the
    // rest of the UI behaves normally.
    let _tx = 0, _ty = 0, _moved = false;
    document.addEventListener('touchstart', (e) => {
      const t = e.touches && e.touches[0]; if(!t) return;
      _tx = t.clientX; _ty = t.clientY; _moved = false;
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', (e) => {
      const t = e.touches && e.touches[0]; if(!t) return;
      if(Math.abs(t.clientX - _tx) > 12 || Math.abs(t.clientY - _ty) > 12) _moved = true;
    }, { capture: true, passive: true });
    document.addEventListener('touchend', (e) => {
      if(_moved) return;                                    // scroll/swipe, not a tap
      if(!e.target?.closest?.('.opanel')) return;           // not on a panel — ignore
      e.preventDefault();                                   // suppress the synthetic click
      handle(e);
    }, { capture: true, passive: false });
  }

  // Direction a played card should FLY IN FROM — toward the discard pile, from
  // the seat that threw it (their hand/panel). Mirrors RONDA's _getPlayerDirection
  // so the discard card lands the same realistic way.
  function _unoPlayDir(playerId){
    const pile = document.getElementById('topcard')?.getBoundingClientRect();
    if(!pile) return { sx:0, sy:-200, rot:-7 };
    const pcx = pile.left + pile.width/2, pcy = pile.top + pile.height/2;
    const srcEl = (playerId && playerId === S.user?.id)
      ? document.getElementById('myhand')
      : document.querySelector(`.opanel[data-pid="${playerId}"]`);
    const src = srcEl?.getBoundingClientRect();
    if(!src || !src.width) return { sx:0, sy:220, rot:-6 };   // default: from below (my hand)
    let dx = (src.left + src.width/2) - pcx;
    let dy = (src.top + src.height/2) - pcy;
    // Fly from the player's ACTUAL seat so it's clear WHO played the card; cap
    // the distance so it stays a believable toss. (No ghost pile now, so there
    // is nothing for the in-flight card to look detached from.)
    const mag = Math.hypot(dx, dy) || 1, cap = 260;
    if(mag > cap){ dx = dx/mag*cap; dy = dy/mag*cap; }
    return { sx:Math.round(dx), sy:Math.round(dy), rot:Math.max(-16, Math.min(16, Math.round(dx/16))) };
  }

  // Clone the current top card and leave it on the discard pile behind the new
  // one — slightly offset/rotated — so played cards build up into a real pile.
  function _pushDiscardGhost(topEl){
    const wrap = document.getElementById('topcardWrap'); if(!wrap) return;
    let stack = document.getElementById('discardStack');
    if(!stack){
      stack = document.createElement('div');
      stack.id = 'discardStack'; stack.className = 'discard-stack';
      stack.setAttribute('aria-hidden','true');
      wrap.insertBefore(stack, topEl);          // sits BEHIND #topcard
    }
    const g = document.createElement('div');
    const col = (topEl.className.match(/\b(red|blue|green|yellow|wild)\b/) || [''])[0];
    g.className = 'ucard nohov discard-ghost ' + col;
    g.innerHTML = topEl.innerHTML;
    // Slight, CENTERED offset so the previous card clearly peeks out behind the
    // live top — a tidy two-card pile, not a scattered mess.
    g.style.setProperty('--gx', (Math.random()*8  - 4 + 5).toFixed(1)+'px');  // ~+1..+9px (down-right)
    g.style.setProperty('--gy', (Math.random()*8  - 4 + 5).toFixed(1)+'px');
    g.style.setProperty('--gr', (Math.random()*12 - 6  - 7).toFixed(1)+'deg'); // ~-13..-1° tilt
    stack.appendChild(g);
    while(stack.children.length > 1) stack.removeChild(stack.firstChild);  // keep ONLY the previous (2 total)
  }

  // Brief colour-matched ripple that pops out of the discard pile the moment a
  // card lands (~0.95s into the 1.2s flight, so it coincides with the "drop").
  const _LAND_IC = { red:'rgba(232,50,74,.55)', blue:'rgba(37,99,235,.55)', green:'rgba(22,163,74,.55)', yellow:'rgba(245,158,11,.55)', wild:'rgba(255,255,255,.5)' };
  function _spawnLandImpact(color){
    const wrap = document.getElementById('topcardWrap'); if(!wrap) return;
    clearTimeout(wrap._impT);
    wrap._impT = setTimeout(()=>{
      const r = document.createElement('div');
      r.className = 'uno-land-impact';
      r.style.setProperty('--ic', _LAND_IC[color] || _LAND_IC.wild);
      wrap.appendChild(r);
      setTimeout(()=>{ try{ r.remove(); }catch(_){} }, 600);
    }, 940);
  }

  function renderTop(card, fromPlayerId){
    if(!card)return;
    const el=document.getElementById('topcard'); if(!el) return;
    const key = card.id || (card.color+'-'+card.value+'-'+(card.chosenColor||''));
    // Same card already shown + not a fresh play (e.g. turn:changed re-sync)
    // → leave it alone so an in-flight land animation isn't restarted/killed.
    if(!fromPlayerId && el._cardId === key){ S.g.topCard=card; return; }
    // Keep the LAST 2 plays on the table: slide the CURRENT top BEHIND as the
    // "previous" card before the new one lands. The 3rd play drops the 1st, so
    // exactly two cards are ever shown — the live top + one peeking behind it.
    if(el._cardId && el._cardId !== key && el.innerHTML){ _pushDiscardGhost(el); }
    S.g.topCard=card; el._cardId = key;
    const color=card.chosenColor||card.color;
    el.innerHTML=buildCardHTML(color,card.value);
    if(fromPlayerId){
      // A fresh play → the card flies in from the player who threw it (RONDA style).
      const d = _unoPlayDir(fromPlayerId);
      el.style.setProperty('--sx', d.sx+'px');
      el.style.setProperty('--sy', d.sy+'px');
      el.style.setProperty('--srot', d.rot+'deg');
      el.className=`ucard nohov ${color} uno-card-land`;
      clearTimeout(el._landT);
      el._landT = setTimeout(()=>el.classList.remove('uno-card-land'),1300);
      _spawnLandImpact(color);
    } else {
      // State sync / re-render — card is already there, no flight.
      el.className=`ucard nohov ${color}`;
    }
  }

  function renderHand(){
    const g=S.g,playable=new Set(g.myPlayable),can=canIPlay(),c=document.getElementById('myhand');
    document.getElementById('mycnt').textContent=g.myHand.length;

    // Split keys: ID key tracks card identity/order/drawn (when the DOM
    // must be rebuilt), state key tracks playable mask + turn (handled by
    // in-place class toggles so cards DON'T flicker every time the turn
    // moves around the table — that was the "jumping cards" bug).
    const idKey    = g.myHand.map(card=>card.id).join(',')+'|'+(g.drawnCardId||'');
    const stateKey = g.myHand.map(card=>playable.has(card.id)?'1':'0').join('')+'|'+(can?'y':'n');

    if(c._lastIdKey !== idKey){
      // Full rebuild — card set changed (played / drew / dealt).
      c._lastIdKey    = idKey;
      c._lastStateKey = stateKey;
      c.innerHTML=g.myHand.map((card,i)=>{
        const color=card.chosenColor||card.color,ok=playable.has(card.id)&&can;
        const isDrawn=card.id===g.drawnCardId;
        return`<div class="hcard ${color} ${ok?'play':''} ${isDrawn?'drawn':''}"
          data-cid="${card.id}"
          style="z-index:${i+1}${isDrawn?';box-shadow:0 0 20px var(--glow-yellow)':''}"
          onclick="${ok?`playCard('${card.id}')`:''}"
          title="${card.color} ${card.value}">
          ${buildCardHTML(color,card.value)}
        </div>`;
      }).join('');
      return;
    }

    if(c._lastStateKey === stateKey) return;
    c._lastStateKey = stateKey;

    // In-place state refresh — no DOM rebuild, no flicker, no animation reset.
    // Iterate the existing .hcard children and flip the `.play` class + onclick
    // to match the latest playable mask. Card order/ids are guaranteed stable
    // here (otherwise we'd have hit the rebuild branch above).
    const nodes = c.children;
    for(let i = 0; i < nodes.length; i++){
      const node = nodes[i];
      const card = g.myHand[i];
      if(!card) continue;
      const ok = playable.has(card.id) && can;
      node.classList.toggle('play', ok);
      node.onclick = ok ? () => playCard(card.id) : null;
    }
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
    // Skip the per-card flying-deal animation on mobile — spawns many GSAP
    // tweens at once which stalls the deal handoff into the game.
    if(document.body.classList.contains('mobile-lite')) return;
    const deck = document.getElementById('drawpile');
    if(!deck) return;
    const fromRect = deck.getBoundingClientRect();
    if(!fromRect.width) return;
    const fcx = fromRect.left + fromRect.width/2;
    const fcy = fromRect.top  + fromRect.height/2;

    const handCards = Array.from(document.querySelectorAll('.myhand .hcard'));
    const oppPanels = Array.from(document.querySelectorAll('.opanel'));

    // Build the seats and a ROTATING deal order — one card to each seat per
    // round (opponents first, then me), repeated, exactly like a real dealer
    // flicking cards around the table.
    const seats = oppPanels.map(panel => {
      const fanEl = panel.querySelector('.opp-pro-fan');
      const total = Math.min((fanEl?.children.length || 1), 5);
      return { type:'opp', panel, fanEl, total };
    });
    seats.push({ type:'self', total: handCards.length, cards: handCards });

    // Hide everything that's about to be dealt so it "appears" as it lands.
    handCards.forEach(c => c.style.visibility = 'hidden');
    seats.forEach(s => { if(s.fanEl) window.gsap.set(s.fanEl, { opacity:0 }); });

    const maxRounds = Math.max(0, ...seats.map(s => s.total));
    const order = [];
    for(let r=0; r<maxRounds; r++){
      seats.forEach(s => {
        if(r >= s.total) return;
        const isLast = r === s.total - 1;
        if(s.type === 'self') order.push({ kind:'self', card:s.cards[r] });
        else order.push({ kind:'opp', panel:s.panel, fanEl: isLast ? s.fanEl : null });
      });
    }

    const STAGGER = 0.065;
    order.forEach((deal, idx) => {
      const isSelf = deal.kind === 'self';
      const targetEl = isSelf ? deal.card : (deal.panel.querySelector('.opp-pro-avwrap') || deal.panel);
      const toRect = targetEl?.getBoundingClientRect();
      if(!toRect || !toRect.width){
        if(isSelf && deal.card) deal.card.style.visibility = '';
        if(deal.fanEl) window.gsap.set(deal.fanEl, { opacity:1 });
        return;
      }
      const dx = (toRect.left + toRect.width/2) - fcx;
      const dy = (toRect.top  + toRect.height/2) - fcy;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const tilt = Math.max(-20, Math.min(20, angle * 0.16));   // flick toward the seat

      const overlay = document.createElement('div');
      overlay.className = 'ucard ucard-deal cardback';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = `position:fixed;left:${fcx}px;top:${fcy}px;z-index:9001;pointer-events:none;`;
      document.body.appendChild(overlay);

      window.gsap.set(overlay, { xPercent:-50, yPercent:-50, scale:0.5, rotation:0, opacity:0 });
      const tl = window.gsap.timeline({ delay: idx * STAGGER });
      tl.to(overlay, { opacity:1, duration:0.07 }, 0);
      tl.to(overlay, {
        x:dx, y:dy,
        scale: isSelf ? 1.0 : 0.6,
        rotation: tilt,
        duration: 0.4, ease:'power3.out'
      }, 0);
      // little landing pop + settle so each card "lands" with weight.
      tl.to(overlay, { scale: isSelf ? 1.07 : 0.65, duration:0.08, ease:'power1.out' });
      tl.to(overlay, {
        scale: isSelf ? 1.0 : 0.6, duration:0.1, ease:'power1.inOut',
        onComplete: () => {
          overlay.remove();
          if(isSelf && deal.card) deal.card.style.visibility = '';
          if(deal.fanEl) window.gsap.to(deal.fanEl, { opacity:1, duration:0.18 });
        }
      });
    });

    // Safety net — guarantee everything is visible after the deal finishes,
    // even if a tween is interrupted (tab switch, etc.).
    const totalMs = order.length * STAGGER * 1000 + 900;
    setTimeout(() => {
      handCards.forEach(c => c.style.visibility = '');
      seats.forEach(s => { if(s.fanEl) window.gsap.set(s.fanEl, { opacity:1 }); });
    }, totalMs);
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
    // NOTE: the play tween runs on mobile too. It's a SINGLE overlay + one
    // timeline per play (cheap) — and players specifically want to see the
    // card placed slowly. (The heavier multi-card DEAL still skips mobile-lite.)

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
    // Realistic "place onto the pile" — the card slides in FROM the player's
    // direction and decelerates into the discard with a small, weighted tilt
    // (no helicopter spin), so it reads like a real card being set down — the
    // same grounded movement RONDA uses, then a tiny landing settle.
    const tilt = (Math.random() * 12 - 6);             // gentle final lean
    window.gsap.set(overlay, { xPercent: -50, yPercent: -50, scale: 0.8, rotation: tilt * 2.4 });
    const dx = (toRect.left + toRect.width/2) - (fromRect.left + fromRect.width/2);
    const dy = (toRect.top  + toRect.height/2) - (fromRect.top  + fromRect.height/2);
    // Hide the real discard card while the overlay travels, so you see ONE
    // card being deliberately placed (no double-image), then reveal on land.
    const topEl = document.getElementById('topcard');
    if(topEl) topEl.style.visibility = 'hidden';
    const revealTop = () => { if(topEl) topEl.style.visibility = ''; };
    const safety = setTimeout(revealTop, 2200);        // never leave the discard hidden
    // Real "toss onto the pile": the card LIFTS off the hand (rises + grows as
    // it comes toward the viewer), arcs over, then settles flat onto the
    // discard — slow + weighted so every seat clearly sees the play.
    window.gsap.timeline({ onComplete: () => { overlay.remove(); clearTimeout(safety); revealTop(); } })
      .to(overlay, {                                   // 1) lift + arc up toward the middle
        x: dx * 0.5, y: dy * 0.5 - 34, scale: 1.2, rotation: tilt * 1.5,
        duration: 0.62, ease: 'power1.out',
      })
      .to(overlay, {                                   // 2) come down and land on the pile
        x: dx, y: dy, scale: 1.05, rotation: tilt,
        duration: 0.62, ease: 'power2.inOut',
      })
      .to(overlay, { scale: 1.0, duration: 0.16, ease: 'power1.inOut' });   // tiny settle
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

