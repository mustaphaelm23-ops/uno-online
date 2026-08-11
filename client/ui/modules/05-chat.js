
  /* ═══════════════════════════════════════════
    CHAT SYSTEM
    ═══════════════════════════════════════════ */
  const Chat={open:false,activeTab:'chat',unread:0,lastSent:0,spamCount:0,history:[]};

  function toggleChat(){
    Chat.open=!Chat.open;
    document.getElementById('chatPanel').classList.toggle('open',Chat.open);
    if(Chat.open){Chat.unread=0;updateChatBadge();scrollChatBottom();}
  }
  function showChatFab(show){
    document.getElementById('emojiBtn').classList.toggle('visible', show);
    // Floating corner #micBtn is now superseded by each game's dedicated
    // mic button (UNO actbar, Ronda corner, Dama action bar). Keep it
    // hidden to avoid two mic controls on screen.
    document.getElementById('micBtn')?.classList.remove('visible');
    if(!show){
      document.getElementById('emojiPicker').classList.remove('show');
      document.getElementById('friendsPanel').classList.remove('open'); Friends.open=false;
      if (typeof VoiceChat !== 'undefined' && VoiceChat.connected) VoiceChat.leave();
    }
    document.getElementById('chatFab').classList.toggle('visible',show);
    document.getElementById('qcFab')?.classList.toggle('visible',show);
    if(!show) document.getElementById('qcPanel')?.classList.remove('show');
  }
  function switchChatTab(tab){
    Chat.activeTab=tab;
    document.getElementById('chatMsgs').style.display=tab==='chat'?'flex':'none';
    document.getElementById('activityMsgs').style.display=tab==='activity'?'flex':'none';
    const sm=document.getElementById('specMsgs'); if(sm) sm.style.display=tab==='spec'?'flex':'none';
    // Spectators chat in their own channel; players can only read it
    const inputAreaVisible = tab==='chat' || (tab==='spec' && S.isSpectator);
    document.getElementById('chatInputArea').style.display=inputAreaVisible?'flex':'none';
    document.getElementById('tabChat').classList.toggle('active',tab==='chat');
    document.getElementById('tabActivity').classList.toggle('active',tab==='activity');
    const ts=document.getElementById('tabSpec'); if(ts) ts.classList.toggle('active',tab==='spec');
    scrollChatBottom();
  }
  function addSpectatorMsg(msg){
    const c=document.getElementById('specMsgs'); if(!c) return;
    const isMe=msg.userId===S.user?.id;
    const d=document.createElement('div');d.className=`chat-msg ${isMe?'mine':'other'}`;
    d.innerHTML=`<div class="chat-name" style="color:#c4b5fd">👁️ ${esc(msg.username)}</div><div class="chat-text">${esc(msg.text)}</div><div class="chat-time">${fmtTime(msg.createdAt)}</div>`;
    c.appendChild(d);
    while(c.children.length>80)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='spec')scrollChatBottom();
    else if(!isMe&&S.isSpectator){Chat.unread++;updateChatBadge();}
  }
  function updateChatBadge(){
    const b=document.getElementById('chatBadge');
    if(Chat.unread>0){b.textContent=Chat.unread>9?'9+':Chat.unread;b.classList.add('show');}
    else b.classList.remove('show');
  }
  function scrollChatBottom(){
    const el=Chat.activeTab==='chat'?document.getElementById('chatMsgs'):document.getElementById('activityMsgs');
    setTimeout(()=>{el.scrollTop=el.scrollHeight;},50);
  }
  function fmtTime(ts){return new Date(ts||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
  function addChatMsg(msg){
    Chat.history.push(msg);if(Chat.history.length>50)Chat.history.shift();
    const c=document.getElementById('chatMsgs'),isMe=msg.userId===S.user?.id;
    const d=document.createElement('div');d.className=`chat-msg ${isMe?'mine':'other'}`;
    d.innerHTML=`${!isMe?`<div class="chat-name">${esc(msg.username)}${verifiedBadgeHTML(msg.username,{size:'xs'})}</div>`:''}<div class="chat-text">${esc(msg.text)}</div><div class="chat-time">${fmtTime(msg.createdAt)}</div>`;
    c.appendChild(d);
    while(c.children.length>50)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='chat')scrollChatBottom();
    else if(!isMe){Chat.unread++;updateChatBadge();}
  }
  function addActivityMsg(text,type='game'){
    const c=document.getElementById('activityMsgs'),d=document.createElement('div');
    d.className=`activity-msg ${type}`;
    d.innerHTML=`${text} <span style="float:right;font-size:9px;color:var(--muted)">${fmtTime()}</span>`;
    c.appendChild(d);
    while(c.children.length>50)c.removeChild(c.firstChild);
    if(Chat.open&&Chat.activeTab==='activity')scrollChatBottom();
  }
  function checkSpam(){
    const now=Date.now();
    if(now-Chat.lastSent<1500){Chat.spamCount++;if(Chat.spamCount>=3){document.getElementById('spamWarn').classList.add('show');setTimeout(()=>{document.getElementById('spamWarn').classList.remove('show');Chat.spamCount=0;},3000);return false;}}
    else Chat.spamCount=0;
    Chat.lastSent=now;return true;
  }
  function sendChat(){
    const input=document.getElementById('chatInput'),raw=input.value.trim();
    if(!raw||!S.roomId||raw.length>200)return;
    if(!checkSpam())return;
    input.value='';input.style.height='38px';
    // Spectators on the Watchers tab post into the watcher channel
    const spec = S.isSpectator && Chat.activeTab === 'spec';
    const evt = spec ? 'chat:spectator_send' : 'chat:send';
    S.socket.emit(evt,{text:raw},(res)=>{if(!res?.success)toast('Could not send message','e');});
  }
  function handleChatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}}
  function autoResizeTextarea(el){el.style.height='38px';el.style.height=Math.min(el.scrollHeight,80)+'px';}

  function initChatListeners(sk){
    sk.on('chat:message',(msg)=>{addChatMsg(msg);if(!Chat.open&&msg.userId!==S.user?.id)toast(`💬 ${msg.username}: ${msg.text.slice(0,30)}${msg.text.length>30?'...':''}`,'i');});
    sk.on('chat:history',({messages})=>{document.getElementById('chatMsgs').innerHTML='';messages.forEach(m=>addChatMsg(m));});
    sk.on('room:player_joined',({player})=>{const n=player?.username||'A player';addActivityMsg(`🟢 ${esc(n)} joined the room`,'join');toast(`${n} joined!`,'i');refreshRoom();});
    sk.on('room:player_left',({username})=>{addActivityMsg(`🔴 ${esc(username||'Player')} left`,'leave');toast(`${username||'Player'} left`,'w');refreshRoom();});
    // Host-side kick — server splices us out of the room and emits this.
    // Bounce the kicked user back to the lobby with a clear notice.
    sk.on('room:kicked',({by,reason})=>{
      toast(`👋 You were removed by ${esc(by||'the host')}`,'w');
      S.roomId = null; S.roomCode = null;
      if(typeof goLobby === 'function') goLobby();
    });
    // Per-player bet pool update — drives the bet card + pot display
    // + the bet chip rendered next to each player's name.
    sk.on('room:bets',({minBet,playerBets})=>{
      S.roomMinBet = minBet || 0;
      S.roomBets   = playerBets || {};
      if(typeof renderBetCard === 'function') renderBetCard();
      refreshRoom();
    });
    sk.on('game:reaction',(data)=>{
      showReactionOnPanel(data.emoji, data.playerId);
    });

    /* Voice chat signaling */
    sk.on('voice:peers', ({ peers }) => {
      // Sent right after we voice:join — initiate offers to existing
      // peers so we can hear them. Fires for listen-only too: even
      // without a mic we want the inbound audio stream.
      if (!VoiceChat.connected) return;
      (peers || []).forEach((peerId) => VoiceChat._ensurePeer(peerId, true));
    });
    sk.on('voice:peer_joined', () => {
      // A new peer just joined voice. They will initiate to us — we just wait.
    });
    sk.on('voice:peer_left', ({ peerId }) => {
      VoiceChat._dropPeer(peerId);
    });
    sk.on('voice:signal', (data) => {
      VoiceChat._handleSignal(data);
    });
    sk.on('voice:speaking', ({ peerId, speaking }) => {
      VoiceChat._setRemoteSpeaking(peerId, speaking);
    });
    sk.on('friend:request',(data)=>{
      Friends.requests.push(data.from);
      updateFriendsNotif(Friends.requests.length);
      toast(`👥 ${data.from.username} sent you a friend request!`,'i');
    });
    sk.on('friend:accepted',(data)=>{
      toast(`🎉 ${data.by.username} accepted your friend request!`,'s');
      loadFriends();
    });
    sk.on('friend:invite',(data)=>{
      showInviteToast(data.from, data.roomId, data.code);
    });
    sk.on('tournament:update',(t)=>{
      if(Tourn.current?.id===t.id) renderTournament(t);
    });
    sk.on('tournament:match_ready',(data)=>{
      Tourn.pendingMatch = data;
      document.getElementById('matchInviteText').textContent=`vs ${data.opponent.username} — ${data.tournamentName}${data.round?` Round ${data.round}`:''}`;
      document.getElementById('matchInvite').classList.add('show');
      SFX.play('turn');
      toast('⚔️ Your match is ready!','s');
    });
    sk.on('tournament:won',(data)=>{
      toast(`🏆 You won the ${data.name} tournament! +${data.prize} coins 🪙`,'s');
      if(S.user){ S.user.coins=(S.user.coins||0)+data.prize; localStorage.setItem('uno_user',JSON.stringify(S.user)); }
    });
    sk.on('tournament:finished',(data)=>{
      toast(`🏆 Tournament finished! Winner: ${data.winner.username}`,'i');
      if(Tourn.current?.id===data.tournamentId){
        Tourn.current.status='finished';
        Tourn.current.winner=data.winner;
        renderTournament(Tourn.current);
      }
    });
    sk.on('game:uno_called',({username})=>{
      addActivityMsg(`🗣️ ${esc(username)} called Cardora!`,'uno');SFX.play('uno');
      const d=document.createElement('div');d.className='uno-alert';d.textContent=`${username} — Cardora!`;
      document.body.appendChild(d);setTimeout(()=>d.remove(),2000);
    });
    sk.on('game:started_notify',()=>{addActivityMsg('🎮 Game has started!','game');});
    sk.on('game:over_notify',({winner})=>{addActivityMsg(`🏆 ${esc(winner||'Someone')} won!`,'game');});
    sk.on('player:disconnected',({username})=>{addActivityMsg(`📡 ${esc(username)} disconnected`,'disconnect');});
    sk.on('player:reconnected',({username})=>{addActivityMsg(`✅ ${esc(username)} reconnected`,'join');});
  }

