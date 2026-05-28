  /* ═══════════════════════════════════════════
    MAIN APP
    ═══════════════════════════════════════════ */
  const _host=window.location.origin;
  const API=_host+'/api';
  const SOCK=_host;

  const S={
    token:localStorage.getItem('uno_token'),
    user:(()=>{try{return JSON.parse(localStorage.getItem('uno_user')||'null');}catch(e){localStorage.removeItem('uno_user');return null;}})(),
    socket:null,roomId:null,
    roomsTimer:null,unoTimer:null,
    pendingWild:null,calledUNO:false,
    g:{myHand:[],myPlayable:[],players:[],topCard:null,currentTurn:null,direction:1,drawPileSize:108,turnPhase:'waiting',drawnCardId:null,stackDraw:0,spectatorHands:{},voteTally:{},myVote:null},
    isSpectator:false,
  };

  /* ═══ HELPERS ═══ */
  function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active');
    // The ⚙ menus must never carry over open between screens —
    // they open only when the player taps the gear.
    document.getElementById('gameMenu')?.classList.remove('show');
    document.getElementById('lobbyMenu')?.classList.remove('show');
    // event-room ambiance only belongs on the room/game screens
    if(id!=='game-screen'&&id!=='room-screen') document.body.classList.remove('in-event-room');
    // hover-focused room scene pauses immediately when leaving the lobby (no GPU work)
    if(id!=='lobby-screen' && typeof RoomScene!=='undefined') RoomScene.stop();
    if(id!=='lobby-screen' && typeof LobbyScene!=='undefined') LobbyScene.stop();
    if(id!=='lobby-screen' && typeof Parallax!=='undefined') Parallax.stop();
    if(id!=='game-screen'){document.getElementById('emojiBtn')?.classList.remove('visible');document.getElementById('chatFab')?.classList.remove('visible');document.getElementById('emojiPicker')?.classList.remove('show');document.getElementById('micBtn')?.classList.remove('visible');document.getElementById('qcFab')?.classList.remove('visible');document.getElementById('qcPanel')?.classList.remove('show');if(typeof VoiceChat!=='undefined'&&VoiceChat.isOn)VoiceChat.leave();}}
  function toast(msg,type='i'){const w=document.getElementById('twrap'),t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;w.appendChild(t);setTimeout(()=>t.remove(),3500);}
  // Centralised "stale token" handler — called by api() / apiFetch when the
  // server returns 401. Debounced so parallel failing requests don't trigger
  // a logout storm. Once triggered, doLogout() clears state and bounces to auth.
  let _authExpiredTriggered=false;
  function _handleAuthExpiry(){
    if(_authExpiredTriggered) return;
    _authExpiredTriggered=true;
    setTimeout(()=>{ _authExpiredTriggered=false; },5000);   // reset guard after 5s
    try{ if(typeof toast==='function') toast('Session expired — please log in again','e'); }catch(e){}
    try{ if(typeof doLogout==='function') doLogout(); }catch(e){ console.error('[auth] doLogout failed:',e); }
  }
  async function api(method,path,body){
    let r;
    try{
      r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},body:body?JSON.stringify(body):undefined});
    }catch(netErr){
      const err=new Error('Network error'); err.status=0; err.networkError=true;
      console.warn(`[api] ${method} ${path} -> network error:`, netErr.message);
      throw err;
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===401) _handleAuthExpiry();
      const err=new Error(d.error||`Request failed (${r.status})`);
      err.status=r.status; err.payload=d;
      console.warn(`[api] ${method} ${path} -> ${r.status}`, d);
      throw err;
    }
    return d;
  }
  // fetch-style helper: path already includes /api, opts = { method, body(stringified) }
  async function apiFetch(path,opts={}){
    let r;
    try{
      r=await fetch(_host+path,{
        method:opts.method||'GET',
        headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},
        body:opts.body,
      });
    }catch(netErr){
      const err=new Error('Network error'); err.status=0; err.networkError=true;
      console.warn(`[apiFetch] ${path} -> network error:`, netErr.message);
      throw err;
    }
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===401) _handleAuthExpiry();
      const err=new Error(d.error||`Request failed (${r.status})`);
      err.status=r.status; err.payload=d;
      console.warn(`[apiFetch] ${path} -> ${r.status}`, d);
      throw err;
    }
    return d;
  }
  function fmtV(v){return{skip:'⊘',reverse:'⇄',draw_two:'+2',wild:'★',wild_draw_four:'+4','0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'}[v]||v||'?';}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function isMe(id){return id===S.user?.id;}
  function myTurn(){return S.g.currentTurn===S.user?.id;}
  function canIDraw(){return myTurn()&&S.g.turnPhase==='must_play';}
  function canIPlay(){return myTurn()&&(S.g.turnPhase==='must_play'||S.g.turnPhase==='drew_card');}

  // P4-NEW — single canonical sync path for the user's currency state.
  // Use whenever a server response returns an updated user object that
  // may have changed coins AND/OR diamonds. Persists to S.user +
  // localStorage and animates every pill that shows either currency
  // (#hcoins / #scoins / #heroCoins / #hdiamonds). The shop and match
  // events already have their own dedicated update paths; this helper
  // is for HTTP endpoints (event claim, BP claim, daily reward, mission
  // claim, competitions, insta-reward) — if/when they start granting
  // diamonds, switch the call site to _syncUserCurrencies(d.user) and
  // both currencies stay in sync without per-site wiring.
  function _syncUserCurrencies(user){
    if(!user || !S.user) return;
    if(typeof user.coins === 'number'){
      S.user.coins = user.coins;
      if(typeof _animateCount === 'function'){
        _animateCount('hcoins', user.coins);
        _animateCount('scoins', user.coins);
        _animateCount('heroCoins', user.coins);
      }
    }
    if(typeof user.diamonds === 'number'){
      S.user.diamonds = user.diamonds;
      if(typeof _animateCount === 'function'){
        _animateCount('hdiamonds', user.diamonds);
      }
    }
    try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
  }

  function buildCardHTML(color,value){
    const v=fmtV(value);
    if(color==='wild')return`<div class="wild-oval"></div><div class="card-tl">${v}</div><div class="wild-txt">${value==='wild_draw_four'?'+4':'★'}</div><div class="card-br">${v}</div>`;
    return`<div class="card-oval"></div><div class="card-tl">${v}</div><div class="card-num">${v}</div><div class="card-br">${v}</div>`;
  }

