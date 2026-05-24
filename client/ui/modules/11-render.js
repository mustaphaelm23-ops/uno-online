  /* ═══ RENDER ═══ */
  function renderOpps(players){
    S.g.players=players;
    const row=document.getElementById('orow'),others=players.filter(p=>!isMe(p.id));
    const showMute = VoiceChat.isOn && players.length >= 3;
    const newKey=others.map(p=>`${p.id}:${p.handSize}:${p.saidUno?1:0}:${p.isConnected?1:0}:${p.id===S.g.currentTurn?1:0}:${p.avatar?'a':'n'}:${showMute?(VoiceChat.mutedPeers?.has(p.id)?'m':'u'):'-'}`).join('|');
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
      return`<div class="opanel ${p.id===S.g.currentTurn?'myturn':''}" data-pid="${p.id}">
          ${muteBtn}
          <div class="oname-row">${avatar}<div class="oname" style="color:${p.id===S.g.currentTurn?'var(--accent)':'var(--text)'}">${esc(p.username)}${p.saidUno?'<span class="ouno">UNO!</span>':''}</div></div>
          <div style="display:flex;align-items:center;height:70px;min-width:${Math.min(max*20+44,190)}px">${cards}${p.handSize>10?`<div style="font-size:11px;color:var(--muted);margin-left:6px;font-weight:700">+${p.handSize-10}</div>`:''}</div>
          ${!p.isConnected?'<div style="font-size:9px;color:var(--red);margin-top:2px">⚠ Offline</div>':''}
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

