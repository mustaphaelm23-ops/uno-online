  /* ═══════════════════════════════════════════
    MAIN APP
    ═══════════════════════════════════════════ */
  // Backend origin: use the configured ATLAS_SERVER_URL (set for native/packaged
  // builds in index.html) when present, otherwise the page's own origin (web).
  const _host=(window.ATLAS_SERVER_URL && String(window.ATLAS_SERVER_URL).trim())
    ? String(window.ATLAS_SERVER_URL).trim().replace(/\/$/,'')
    : window.location.origin;
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
    if(id!=='game-screen'){document.getElementById('emojiBtn')?.classList.remove('visible');document.getElementById('chatFab')?.classList.remove('visible');document.getElementById('emojiPicker')?.classList.remove('show');document.getElementById('micBtn')?.classList.remove('visible');document.getElementById('qcFab')?.classList.remove('visible');document.getElementById('qcPanel')?.classList.remove('show');document.body.classList.remove('uno-felt-art');if(typeof VoiceChat!=='undefined'&&VoiceChat.connected)VoiceChat.leave();}
    // DMs are now opened from the header chat button (💬) only — the
    // floating envelope FAB was removed since it had no role mid-game.
    // We still auto-close the DM overlay if the user leaves the lobby/room.
    if(id !== 'lobby-screen' && id !== 'room-screen'
       && typeof DM !== 'undefined' && DM.open){
      DM.closeOverlay();
    }
    // Re-evaluate the rotate-to-landscape prompt whenever the active
    // screen changes — auth-screen skips it entirely (so signup works
    // in portrait), every other screen turns it back on automatically.
    try{ if(typeof MobileRotate !== 'undefined') MobileRotate.refresh(); }catch(e){}
    // Floating Friends 👥 button retired — moved to the header actions
    // group alongside Bell/Chat/Settings. Element kept hidden in the DOM
    // for backwards compat with any code that toggles its badge.
  }
  function toast(msg,type='i'){const w=document.getElementById('twrap'),t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;w.appendChild(t);setTimeout(()=>t.remove(),3500);}
  // Centralised "stale token" handler — called by api() / apiFetch when the
  // server returns 401. Debounced so parallel failing requests don't trigger
  // a logout storm. Once triggered, doLogout() clears state and bounces to auth.
  //
  // Guard against firing on the AUTH SCREEN: if the user hasn't logged in
  // yet (no S.token), a 401 from some idle background fetch (battlepass
  // hydration, friends rail, etc.) is expected and must not bounce them
  // back to login mid-typing in the register form. Without this check the
  // register tab would flash a "Session expired" toast every few seconds
  // and switch back to the login tab.
  let _authExpiredTriggered=false;
  function _handleAuthExpiry(){
    if(_authExpiredTriggered) return;
    if(!S.token) return;                                    // not logged in → ignore
    _authExpiredTriggered=true;
    setTimeout(()=>{ _authExpiredTriggered=false; },5000);   // reset guard after 5s
    try{ if(typeof toast==='function') toast('Session expired — please log in again','e'); }catch(e){}
    try{ if(typeof doLogout==='function') doLogout(); }catch(e){ console.error('[auth] doLogout failed:',e); }
  }
  async function api(method,path,body,opts={}){
    let r;
    // Opt-in hard timeout (opts.timeout ms) — off by default so existing
    // callers are unaffected, but available so no screen can hang forever.
    const ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
    const timeoutMs = (typeof opts.timeout==='number' && opts.timeout>0) ? opts.timeout : 0;
    let timer = null;
    if(ctrl && timeoutMs>0) timer = setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},body:body?JSON.stringify(body):undefined,signal:ctrl?ctrl.signal:undefined});
    }catch(netErr){
      const timedOut = netErr && netErr.name==='AbortError';
      const err=new Error(timedOut?'Request timed out':'Network error'); err.status=0; err.networkError=true; err.timedOut=timedOut;
      console.warn(`[api] ${method} ${path} -> ${timedOut?'timed out':'network error'}:`, netErr.message);
      throw err;
    }finally{
      if(timer) clearTimeout(timer);
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
    // Optional hard timeout (opt-in via opts.timeout in ms) so a stalled
    // request can't leave a screen stuck on "Loading…" forever. Left off by
    // default to avoid cutting slow uploads / long polls.
    const ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
    const timeoutMs = (typeof opts.timeout==='number' && opts.timeout>0) ? opts.timeout : 0;
    let timer = null;
    if(ctrl){
      if(opts.signal){ try{ opts.signal.addEventListener('abort',()=>ctrl.abort()); }catch(e){} }
      if(timeoutMs>0) timer = setTimeout(()=>ctrl.abort(), timeoutMs);
    }
    try{
      r=await fetch(_host+path,{
        method:opts.method||'GET',
        headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},
        body:opts.body,
        signal: ctrl ? ctrl.signal : undefined,
      });
    }catch(netErr){
      const timedOut = netErr && netErr.name==='AbortError';
      const err=new Error(timedOut?'Request timed out':'Network error');
      err.status=0; err.networkError=true; err.timedOut=timedOut;
      console.warn(`[apiFetch] ${path} -> ${timedOut?'timed out':'network error'}:`, netErr.message);
      throw err;
    }finally{
      if(timer) clearTimeout(timer);
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
  // Verification seal HTML for a player name — blue for everyone, GOLD for the
  // dev/showcase account, none for bots. opts.size: 'sm' (lists/panels) | 'xs'
  // (tiny rows) | undefined (big, profile headers). Reused everywhere a player
  // name is shown so the badge is consistent.
  function verifiedBadgeHTML(username, opts){
    opts = opts || {};
    // Bots get the same blue ✓ as real players so they blend in (a missing
    // badge would tell players the opponent is a bot).
    const gold = String(username||'').toLowerCase()==='mustapha';
    const size = opts.size==='sm' ? ' vbadge-sm' : opts.size==='xs' ? ' vbadge-xs' : '';
    return `<span class="profile-v4-verified${size}${gold?' is-gold':''}" title="Verified">✓</span>`;
  }
  window.verifiedBadgeHTML = verifiedBadgeHTML;
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

