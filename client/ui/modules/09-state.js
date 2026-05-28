  /* ═══ STATE ═══ */
  function applyFullState(state){
    const g=S.g;
    // P5.2 — detect lobby->playing transition for the card-deal animation.
    // Snapshotted BEFORE any other state mutation so the comparison is
    // against the previous render's phase, not the incoming one.
    const prevPhase = g.phase;
    if(state.phase!==undefined) g.phase=state.phase;
    if(state.players!==undefined)g.players=state.players;
    if(state.topCard!==undefined)g.topCard=state.topCard;
    if(state.currentTurn!==undefined)g.currentTurn=state.currentTurn;
    if(state.direction!==undefined)g.direction=state.direction;
    if(state.drawPileSize!==undefined)g.drawPileSize=state.drawPileSize;
    if(state.myHand!==undefined){
      if(S._skipNextSync){
      }else{
        g.myHand=state.myHand;
      }
    }
    if(state.myPlayable!==undefined)g.myPlayable=state.myPlayable;
    if(state.turnPhase!==undefined)g.turnPhase=state.turnPhase;
    if(state.drawnCardId!==undefined)g.drawnCardId=state.drawnCardId;
    if(state.stackDraw!==undefined)g.stackDraw=state.stackDraw||0;
    if(state.turnEndsAt!==undefined)g.turnEndsAt=state.turnEndsAt;
    if(state.turnTimeout!==undefined)g.turnTimeout=state.turnTimeout;
    if(state.pot!==undefined){
      g.pot=state.pot||0;
      const pn=document.getElementById('hpotn'); if(pn) pn.textContent=g.pot.toLocaleString();
      const pp=document.getElementById('hpot');  if(pp) pp.style.display=g.pot>0?'':'none';
    }
    if(g.topCard)renderTop(g.topCard);
    renderOpps(g.players);renderHand();
    document.getElementById('dcnt').textContent=g.drawPileSize;
    document.getElementById('myname').textContent=S.user?.username||'You';
    document.getElementById('mycnt').textContent=g.myHand.length;
    if(g.turnPhase==='drew_card'&&isMe(g.currentTurn))document.getElementById('cancelArea').style.display='block';
    else document.getElementById('cancelArea').style.display='none';
    updateTurnUI();
    if(typeof TurnTimer!=='undefined') TurnTimer.sync();
    // P5.2 — card-deal animation fires ONLY on the actual lobby->playing
    // transition. Reconnects (where prevPhase is undefined because we
    // just joined the socket) don't trigger it — cards aren't being dealt
    // fresh, the game's already in progress.
    if(prevPhase==='lobby' && g.phase==='playing' && typeof animateMatchDeal==='function'){
      // Defer one frame so renderHand's DOM is settled before we read rects.
      requestAnimationFrame(()=>animateMatchDeal());
    }
  }

  // Spectator: render full game state with every player's hand visible
  function applySpectatorState(state){
    const g = S.g;
    g.players = state.players || [];
    g.topCard = state.topCard;
    g.currentTurn = state.currentTurn;
    g.direction = state.direction;
    g.drawPileSize = state.drawPileSize;
    g.turnPhase = state.turnPhase;
    g.stackDraw = state.stackDraw || 0;
    g.pot = state.pot || 0;
    {
      const pn=document.getElementById('hpotn'); if(pn) pn.textContent=g.pot.toLocaleString();
      const pp=document.getElementById('hpot');  if(pp) pp.style.display=g.pot>0?'':'none';
    }
    g.myHand = []; g.myPlayable = []; g.drawnCardId = null;
    g.spectatorHands = (state.hands || []).reduce((acc, h) => { acc[h.playerId] = h.cards; return acc; }, {});
    if (g.topCard) renderTop(g.topCard);
    renderSpectatorOpps(g.players);
    document.getElementById('dcnt').textContent = g.drawPileSize;
    document.getElementById('myhand').innerHTML = '';
    document.getElementById('cancelArea').style.display = 'none';
    document.getElementById('myname').textContent = '👁️ Spectating';
    document.getElementById('mycnt').textContent = `${g.players.length} players`;
    updateSpectatorTurnUI();
  }

  // Same opponent row, but every player is shown with face-up cards
  function renderSpectatorOpps(players){
    const row = document.getElementById('orow');
    if (!row) return;
    const tally = S.g.voteTally || {};
    const myVote = S.g.myVote || null;
    const newKey = players.map(p => `${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.id===S.g.currentTurn?1:0}:${tally[p.id]||0}:${myVote===p.id?'v':''}`).join('|') + '|spec';
    if (row._lastKey === newKey) return;
    row._lastKey = newKey;
    const hands = S.g.spectatorHands || {};
    row.innerHTML = players.map(p => {
      const cards = (hands[p.id] || []).slice(0, 12);
      const cardsHtml = cards.map((c,i) => {
        const color = c.chosenColor || c.color || 'wild';
        const v = fmtV(c.value);
        return `<div class="spec-card ${color}" style="margin-left:${i===0?'0':'-18px'};z-index:${i}">
          <span class="spec-card-num">${v}</span>
        </div>`;
      }).join('');
      const more = (hands[p.id]?.length || 0) > 12 ? `<div style="font-size:11px;color:rgba(255,255,255,.6);margin-left:6px;font-weight:700">+${hands[p.id].length - 12}</div>` : '';
      const avatar = _isImgAvatar(p.avatar)
        ? `<div class="opp-avatar" style="background-image:url('${p.avatar}')"></div>`
        : `<div class="opp-avatar opp-avatar-letter">${esc(p.avatar||(p.username||'?').charAt(0).toUpperCase())}</div>`;
      const votes = tally[p.id] || 0;
      const isMyVote = myVote === p.id;
      const voteBtn = `<button class="vote-btn ${isMyVote?'active':''}" onclick="voteFor('${p.id}')" title="${isMyVote?'Your pick':'Cheer for this player'}">${isMyVote?'⭐':'🗳️'} ${isMyVote?'Voted':'Vote'}</button>`;
      const voteCount = votes > 0 ? `<div class="vote-count">${votes} vote${votes===1?'':'s'}</div>` : '';
      return `<div class="opanel ${p.id===S.g.currentTurn?'myturn':''}" data-pid="${p.id}">
        <div class="oname-row">${avatar}<div class="oname" style="color:${p.id===S.g.currentTurn?'var(--accent)':'var(--text)'}">${esc(p.username)} ${p.saidUno?'<span class="ouno">UNO!</span>':''}</div></div>
        <div style="display:flex;align-items:center;height:64px">${cardsHtml}${more}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">${voteBtn}${voteCount}</div>
      </div>`;
    }).join('');
  }
  function voteFor(playerId){
    if(!S.isSpectator) return;
    if(!S.socket?.connected) return;
    S.socket.emit('vote:spectator',{playerId},(res)=>{
      if(!res?.success) toast(res?.reason||'Vote failed','e');
    });
  }
  function comingSoon(title, body){
    toast(`🚧 ${title} — ${body}`,'i');
  }

