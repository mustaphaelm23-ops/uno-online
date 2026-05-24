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
    if(id!=='game-screen'){document.getElementById('emojiBtn')?.classList.remove('visible');document.getElementById('chatFab')?.classList.remove('visible');document.getElementById('emojiPicker')?.classList.remove('show');document.getElementById('micBtn')?.classList.remove('visible');if(typeof VoiceChat!=='undefined'&&VoiceChat.isOn)VoiceChat.leave();}}
  function toast(msg,type='i'){const w=document.getElementById('twrap'),t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;w.appendChild(t);setTimeout(()=>t.remove(),3500);}
  async function api(method,path,body){
    const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},body:body?JSON.stringify(body):undefined});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Error');return d;
  }
  // fetch-style helper: path already includes /api, opts = { method, body(stringified) }
  async function apiFetch(path,opts={}){
    const r=await fetch(_host+path,{
      method:opts.method||'GET',
      headers:{'Content-Type':'application/json',...(S.token?{Authorization:`Bearer ${S.token}`}:{})},
      body:opts.body,
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Request failed');
    return d;
  }
  function fmtV(v){return{skip:'⊘',reverse:'⇄',draw_two:'+2',wild:'★',wild_draw_four:'+4','0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9'}[v]||v||'?';}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function isMe(id){return id===S.user?.id;}
  function myTurn(){return S.g.currentTurn===S.user?.id;}
  function canIDraw(){return myTurn()&&S.g.turnPhase==='must_play';}
  function canIPlay(){return myTurn()&&(S.g.turnPhase==='must_play'||S.g.turnPhase==='drew_card');}

  function buildCardHTML(color,value){
    const v=fmtV(value);
    if(color==='wild')return`<div class="wild-oval"></div><div class="card-tl">${v}</div><div class="wild-txt">${value==='wild_draw_four'?'+4':'★'}</div><div class="card-br">${v}</div>`;
    return`<div class="card-oval"></div><div class="card-tl">${v}</div><div class="card-num">${v}</div><div class="card-br">${v}</div>`;
  }

