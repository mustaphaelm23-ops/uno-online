  /* ═══ SOCKET ═══ */
  function initSock(){
    if(S.socket?.connected)return;
    S.socket=io(SOCK,{auth:{token:S.token},reconnectionAttempts:10,reconnectionDelay:1500});
    const sk=S.socket;

    sk.on('connect',()=>{document.getElementById('dbar').classList.remove('show');if(S.roomId)sk.emit('room:join',{roomId:S.roomId});});
    sk.on('disconnect',()=>document.getElementById('dbar').classList.add('show'));
    initChatListeners(sk);

    sk.on('game:spectator_state',(state)=>{
      S.isSpectator = true;
      document.body.classList.add('spectating');
      Clutch.reset();
      // Reveal Watchers tab for spectators (and players-with-toggle)
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
      showScreen('game-screen');
      addActivityMsg('👁️ You are spectating','game');
    });
    sk.on('game:spectator_state_update',(state)=>{
      if(!S.isSpectator) return;
      applySpectatorState(state);
      if(state.players) Clutch.check(state.players);
    });
    sk.on('league:round_ended', ({ round, winnerSlotId, nextRoundIn })=>{
      const ov = document.getElementById('roundIntermission');
      if (!ov) return;
      const title = document.getElementById('riTitle');
      const score = document.getElementById('riScore');
      const nextEl = document.getElementById('riNext');
      if (title) title.textContent = `ROUND ${round} DONE`;
      // Try to label the round-1 winner so it doesn't feel ambiguous
      const myName = S.user?.username || 'You';
      if (score) {
        const players = S.g?.players || [];
        const winnerPlayer = players.find(p => p.id === winnerSlotId) || null;
        if (winnerSlotId === 'draw') score.textContent = '🤝 Round drawn';
        else if (winnerPlayer) score.textContent = `🏁 ${winnerPlayer.username || 'Unknown'} won round ${round}`;
        else score.textContent = `🏁 Round ${round} done`;
      }
      const secs = Math.max(1, Math.round((nextRoundIn || 4500) / 1000));
      if (nextEl) nextEl.textContent = `Round 2 starting in ${secs}s…`;
      ov.classList.add('show');
      // Live countdown
      let left = secs;
      const t = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(t); return; }
        if (nextEl) nextEl.textContent = `Round 2 starting in ${left}s…`;
      }, 1000);
    });
    sk.on('league:round_started', ({ round })=>{
      const ov = document.getElementById('roundIntermission');
      if (ov) ov.classList.remove('show');
      const badge = document.getElementById('roundBadge');
      if (badge) badge.textContent = `ROUND ${round} / 2`;
      toast(`🔔 Round ${round} started`, 'i');
    });

    sk.on('vote:tally',({tally,my})=>{
      S.g.voteTally = tally || {};
      if(my !== undefined) S.g.myVote = my;
      if(S.isSpectator && S.g.players?.length) renderSpectatorOpps(S.g.players);
    });
    sk.on('chat:spectator_history',({messages})=>{
      const box=document.getElementById('specMsgs');
      if(box){box.innerHTML=''; (messages||[]).forEach(m=>addSpectatorMsg(m));}
    });
    sk.on('chat:spectator_message',(msg)=>{
      addSpectatorMsg(msg);
      // For non-spectator players, surface the watchers tab so they can peek
      const wt=document.getElementById('tabSpec'); if(wt) wt.style.display='';
    });
    sk.on('room:spectator_joined',({username,count})=>{
      addActivityMsg(`👁️ ${esc(username||'A watcher')} is now watching (${count} total)`,'join');
    });
    sk.on('room:spectator_left',({count})=>{
      addActivityMsg(`👁️ A watcher left (${count} watching)`,'leave');
    });

    sk.on('game:state',(state)=>{
      // Reset start-button guard so future restarts work
      const startBtn=document.getElementById('bstart');
      if(startBtn){startBtn.dataset.starting='';startBtn.disabled=true;startBtn.textContent='Waiting for players...';}
      S.isSpectator=false;
      document.body.classList.remove('spectating');
      Clutch.reset();
      S.calledUNO=false;applyFullState(state);showScreen('game-screen');
      toast('Game started! 🎮','s');SFX.play('turn');
      showChatFab(true);addActivityMsg('🎮 Game has started!','game');
      initGameParticles();
      // Deal animation: cards fly from center to each player
      setTimeout(()=>{
        const handSize = state.myHand?.length || 7;
        const handEl = document.getElementById('myhand');
        const deckEl = document.getElementById('drawpile');
        if(handEl) AnimLayer.deal(handSize, handEl);
        // Opponents
        (state.players||[]).forEach((p,idx)=>{
          if(p.id===S.user?.id) return;
          setTimeout(()=>{
            const panel = document.querySelector(`.opanel[data-pid="${p.id}"]`);
            if(panel && deckEl) AnimLayer.drawMany(p.handSize||7, deckEl, panel, {stagger:75,duration:520});
          }, idx*200);
        });
      }, 200);
    });
    sk.on('game:state_update',(state)=>{if(!S.roomId)return;applyFullState(state);});
    sk.on('practice:error',({reason}={})=>{
      S.roomId=null;
      if(!document.getElementById('game-screen').classList.contains('active')){
        toast('⚠️ '+(reason||'Training could not start — try again'),'e');
      }
    });
    sk.on('world:history',(msgs)=>{
      const box=document.getElementById('worldMsgs');
      if(!box) return;
      if(!msgs || !msgs.length){
        box.innerHTML=`<div class="rail-empty">No messages yet — be the first to say hi 👋</div>`;
      } else {
        box.innerHTML=msgs.map(_worldMsgHTML).join('');
        box.scrollTop=box.scrollHeight;
      }
    });
    sk.on('world:msg',(m)=>{
      // Wipe the empty-state placeholder before appending the first real message.
      const box=document.getElementById('worldMsgs');
      if(box && box.querySelector('.rail-empty')) box.innerHTML='';
      _appendWorldMsg(m);
    });
    // Server tells us we were throttled (1.2s between messages). Quiet hint;
    // ignored silently if toast() isn't available.
    sk.on('world:throttled',()=>{ try{ toast('Slow down — one message at a time','i'); }catch(e){} });

    // ── P4 economy events ────────────────────────────────────────────
    // match:debited fires per-socket right after game:start succeeds and
    // the server has taken the entry fee out of S.user.coins. We mirror
    // the new balance locally + animate every coin pill that's visible
    // (header, sidebar, hero-banner). Toast tells the player why their
    // balance dropped — explicit beats silent.
    sk.on('match:debited',({entryFee,coins})=>{
      if(typeof coins==='number'){
        S.user.coins=coins;
        try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
        if(typeof _animateCount==='function'){
          _animateCount('hcoins',coins);
          _animateCount('scoins',coins);
          _animateCount('heroCoins',coins);
        }
      }
      toast(`−${entryFee} 🪙 entry fee`,'i');
    });

    // match:payout fires per-socket at game-end for the winner (or for each
    // remaining human if a bot won — they get an equal share). Single source
    // of truth for the post-match balance; showWin reads data.payout from
    // the game:over broadcast for the DISPLAY but no longer mirrors coins
    // locally (server is authoritative).
    // P4-NEW.1a — opponent disconnect / abandon / reconnect events. Light
    // toasts so the room reads the right state at a glance; deeper UI
    // polish (greyed-out avatar, grace-bar countdown) is a follow-up.
    sk.on('player:disconnected',({username,voluntary,graceMs})=>{
      const tag = voluntary ? 'left the match' : `disconnected — ${Math.round((graceMs||30000)/1000)}s to reconnect`;
      toast(`⚠️ ${username} ${tag}`,'w');
    });
    sk.on('player:abandoned',({username})=>{
      toast(`💀 ${username} abandoned — bot taking over`,'w');
    });
    sk.on('player:reconnected',({username,abandoned})=>{
      toast(`✓ ${username} reconnected${abandoned?' (forfeit still applies)':''}`,'s');
    });
    // GDD §7.5 — quick-chat incoming + throttle feedback.
    sk.on('chat:quick',(data)=>{
      if(typeof QuickChat !== 'undefined') QuickChat.onIncoming(data);
    });
    sk.on('chat:quick_throttled',()=>{ try{ toast('Quick chat throttled — wait 2s','i'); }catch(e){} });

    // GDD §7.5 B — private DM incoming + read-receipt + post-connect badge refresh.
    sk.on('dm:incoming',(msg)=>{ if(typeof DM !== 'undefined') DM.onIncoming(msg); });
    sk.on('dm:read_by',(_d)=>{ /* read-receipt; future UI hook */ });
    if(typeof DM !== 'undefined') setTimeout(()=>DM.refreshUnread(), 600);

    // GDD §7.2 — account level-up. Server has already granted the rewards
    // (coins + occasional diamonds); we just sync the new XP/level + toast.
    sk.on('account:levelup',(data)=>{
      if(!data || !S.user) return;
      if(typeof data.accountXP === 'number') S.user.accountXP = data.accountXP;
      if(typeof data.newLevel  === 'number') S.user.accountLevel = data.newLevel;
      try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
      // Update the lobby hero pill if visible.
      const el=document.getElementById('heroLevel');
      if(el){
        el.textContent=`Lv ${data.newLevel}`;
        el.classList.remove('level-up'); void el.offsetWidth; el.classList.add('level-up');
      }
      const r=data.rewards||{};
      const parts=[];
      if(r.coins)    parts.push(`+${r.coins.toLocaleString()} 🪙`);
      if(r.diamonds) parts.push(`+${r.diamonds.toLocaleString()} 💎`);
      const tail = parts.length ? ` (${parts.join(', ')})` : '';
      toast(`🌟 Level up! Lv ${data.oldLevel} → Lv ${data.newLevel}${tail}`,'s');
    });

    // P4-NEW.1b — ranked abandon penalty hit on me. Persist the lockout to
    // S.user so the lobby UI can dim the RANKED card or show a tooltip.
    sk.on('ranked:penalty',({elo,bannedUntil,reason})=>{
      if(typeof bannedUntil==='number' && S.user){
        S.user.rankedBanUntil = bannedUntil;
        try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
      }
      const mins = Math.max(1, Math.ceil(((bannedUntil||0) - Date.now())/60000));
      toast(`⚠ Ranked penalty: ${elo} ELO + ${mins}min queue ban`,'e');
    });

    sk.on('match:payout',({coins,gained,reason})=>{
      if(typeof coins==='number'){
        S.user.coins=coins;
        try{ localStorage.setItem('uno_user',JSON.stringify(S.user)); }catch(e){}
        if(typeof _animateCount==='function'){
          _animateCount('hcoins',coins);
          _animateCount('scoins',coins);
          _animateCount('heroCoins',coins);
        }
      }
      // No toast — the win modal that's about to render shows the gain.
    });

    sk.on('game:card_played',(data)=>{
      if(!S.roomId)return; // Ignore stale events after leaving the game
      // P3.4 — kick off the fly-to-discard overlay FIRST so we capture
      // rects from the current DOM (sender's seat + current topcard) before
      // any re-render mutates them. The overlay lives at z-index 9000 so it
      // visibly covers the (already-updated) topcard until it lands.
      if(typeof animateCardPlay === 'function' && data?.card && data?.playerId){
        animateCardPlay(data.card, data.playerId);
      }
      if(data.topCard)renderTop(data.topCard);
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      SFX.play('play');
      const who=(data.players||[]).find(p=>p.id===data.playerId);
      toast(`${who?.username||'?'} played ${fmtV(data.card?.value)}`,'i');
      if(data.players){const p=data.players.find(p=>p.id===data.playerId&&!isMe(p.id));if(p&&p.handSize===1&&!p.saidUno)showCatchButton(p.id);}
      // Animation: opponent card flies to pile
      if(data.playerId !== S.user?.id){
        const oppPanel = document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
        const pileEl   = document.getElementById('topCard');
        if(data.card) AnimLayer.opponentPlay(data.card, oppPanel, pileEl);
      }
    });

    sk.on('game:auto_played',(data)=>{
      if(!S.roomId)return;
      if(data.players){
        if(S.isSpectator) renderSpectatorOpps(data.players);
        else renderOpps(data.players);
        Clutch.check(data.players);
      }
      const who=(data.players||[]).find(p=>p.id===data.playerId);
      const name=who?.username||'?';
      if(data.action==='played' && data.card){
        if(data.topCard)renderTop(data.topCard);
        SFX.play('play');
        toast(`🤖 ${name} (auto) played ${fmtV(data.card.value)}`,'i');
        if(data.playerId !== S.user?.id){
          const oppPanel = document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
          const pileEl   = document.getElementById('topCard');
          AnimLayer.opponentPlay(data.card, oppPanel, pileEl);
        }
      } else if(data.action==='drew'){
        SFX.play('draw');
        Voice.sayDraw(1);
        toast(`🤖 ${name} (auto) drew a card`,'i');
        if(data.playerId !== S.user?.id){
          const panel=document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
          const deck=document.getElementById('drawpile');
          if(panel) AnimLayer.drawMany(1, deck, panel, {stagger:0,duration:560});
        }
      } else if(data.action==='stack_taken'){
        SFX.play('draw');
        Voice.sayDraw(data.count||2);
        toast(`🤖 ${name} (auto) took ${data.count} stack cards`,'i');
        const target = data.playerId === S.user?.id
          ? document.getElementById('myhand')
          : document.querySelector(`.opanel[data-pid="${data.playerId}"]`);
        const deck = document.getElementById('drawpile');
        if(target) AnimLayer.drawMany(data.count||2, deck, target, {stagger:120,duration:600});
      }
    });

    sk.on('turn:changed',(data)=>{
      if(!S.roomId)return;
      S.g.currentTurn=data.currentPlayerId;S.g.direction=data.direction;
      S.g.drawPileSize=data.drawPileSize;S.g.turnPhase=data.turnPhase||'must_play';
      S.g.drawnCardId=data.drawnCardId||null;S.g.stackDraw=data.stackDraw||0;
      if(data.topCard)renderTop(data.topCard);
      document.getElementById('dcnt').textContent=data.drawPileSize;
      document.getElementById('cancelArea').style.display='none';
      if(data.currentPlayerId===S.user?.id)SFX.play('turn');
      updateTurnUI();
    });

    sk.on('game:drew_card',({card,cards,canPlay,wasStack})=>{
      if(!S.roomId)return;
      SFX.play('draw');
      S._skipNextSync=true;
      setTimeout(()=>{S._skipNextSync=false;},2000);
      if(wasStack && Array.isArray(cards) && cards.length){
        Voice.sayDraw(cards.length);
        const deck=document.getElementById('drawpile');
        const handEl=document.getElementById('myhand');
        AnimLayer.drawMany(cards.length, deck, handEl, {stagger:130,duration:600});
        for(const c of cards){
          if(!S.g.myHand.find(x=>x.id===c.id)) S.g.myHand.push(c);
        }
        S.g.drawnCardId=null;
      } else if(card){
        Voice.sayDraw(1);
        S.g.drawnCardId=card.id;
        if(!S.g.myHand.find(c=>c.id===card.id)){
          S.g.myHand.push(card);
          if(canPlay)S.g.myPlayable=[...new Set([...S.g.myPlayable,card.id])];
        }
      }
      S.g.turnPhase=canPlay?'drew_card':'waiting';
      renderHand();updateTurnUI();
      if(canPlay){document.getElementById('cancelArea').style.display='block';}
      else{document.getElementById('cancelArea').style.display='none';}
    });

    sk.on('game:player_drew',({playerId,count})=>{
      if(!S.roomId)return;
      const p=S.g.players.find(p=>p.id===playerId);
      Voice.sayDraw(count||1);
      if(p&&!isMe(p.id)){
        const panel=document.querySelector(`.opanel[data-pid="${playerId}"]`);
        const deck=document.getElementById('drawpile');
        if(panel){
          AnimLayer.drawMany(count||1, deck, panel, {stagger:120,duration:560});
          if((count||1) > 1){
            const fx=document.createElement('div');
            fx.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:24px;font-weight:900;color:#FFD700;text-shadow:0 2px 8px rgba(0,0,0,.6);pointer-events:none;animation:popIn .4s ease forwards;z-index:20;';
            fx.textContent=`+${count}`;
            panel.appendChild(fx);
            setTimeout(()=>fx.remove(),1800);
          }
        }
      }
    });
    sk.on('game:color_chosen',({playerId,color})=>{document.getElementById('cmodal').classList.remove('show');const p=S.g.players.find(p=>p.id===playerId);toast(`${p?.username||'?'} chose ${color.toUpperCase()}!`,'i');const tc=document.getElementById('topcard');if(tc)tc.className=`ucard nohov ${color}`;});
    sk.on('game:direction_changed',({direction})=>{S.g.direction=direction;document.getElementById('hdir').textContent=direction===1?'↻ Clockwise':'↺ Counter-CW';});
    sk.on('game:uno_caught',({targetId,penaltyCards})=>{const p=S.g.players.find(p=>p.id===targetId);toast(`😱 ${p?.username||'?'} caught! +${penaltyCards} cards`,'e');removeCatch();});
    sk.on('game:player_won',(data)=>{showWin(data);SFX.play(data.winnerId===S.user?.id?'win':'error');});

    sk.on('matchmaking:matched',({roomId,players})=>{
      S.roomId=roomId;
      // Cinematic "match found" flash on the radar core, then enter the room
      const g=window.gsap, ov=document.getElementById('mmov');
      const finish=()=>{
        ov.classList.remove('show');
        if(g) g.set(ov,{clearProps:'opacity'});
        _resetLobbyCamera();
        toast('Match found!','s'); SFX.play('uno');
        showScreen('room-screen');
        if(players)renderWaiting(players);
        document.getElementById('ridlbl').textContent=`Room: ${roomId.substr(0,8).toUpperCase()}`;
      };
      if(g && ov.classList.contains('show') && !_mmReduced()){
        const core=ov.querySelector('.mm-core');
        if(core) g.fromTo(core,{scale:1},{scale:1.5,duration:.32,ease:'back.out(2)',yoyo:true,repeat:1});
        g.to(ov,{opacity:0,duration:.4,delay:.5,ease:'power2.in',onComplete:finish});
      } else { finish(); }
    });
  }

