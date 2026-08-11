  /* ═══ SEASONAL THEMES ═══ */
  const THEMES={
    neon:     {name:'Neon Rush',      icon:'🃏', cls:'',               particle:null,    count:0,  desc:'The classic warm-gold table'},
    cyber:    {name:'Cyber Neon',     icon:'🌀', cls:'theme-cyber',    particle:'spark', count:26, desc:'Electric cyan & magenta'},
    winter:   {name:'Winter Frost',   icon:'❄️', cls:'theme-winter',   particle:'snow',  count:42, desc:'Cool blue with falling snow'},
    summer:   {name:'Summer Tropical',icon:'🌴', cls:'theme-summer',   particle:'petal', count:26, desc:'Warm sunset casino glow'},
    halloween:{name:'Halloween Glow', icon:'🎃', cls:'theme-halloween',particle:'ember', count:30, desc:'Dark purple with rising embers'},
    gold:     {name:'Gold Royale',    icon:'👑', cls:'theme-gold',     particle:'dust',  count:34, desc:'Anniversary golden dust'},
  };
  const Theme={
    current:'neon',
    order:['neon','cyber','winter','summer','halloween','gold'],
    autoByMonth(){
      const m=new Date().getMonth();
      if(m===11||m===0) return 'winter';
      if(m===9) return 'halloween';
      if(m>=5&&m<=7) return 'summer';
      return 'neon';
    },
    init(){
      this.current=localStorage.getItem('uno_theme')||this.autoByMonth();
      if(!THEMES[this.current]) this.current='neon';
      this.apply(this.current,true);
    },
    apply(id,silent){
      if(!THEMES[id]) id='neon';
      this.current=id;
      try{ localStorage.setItem('uno_theme',id); }catch(e){}
      const scr=document.getElementById('lobby-screen');
      if(scr){
        Object.values(THEMES).forEach(t=>{ if(t.cls) scr.classList.remove(t.cls); });
        if(THEMES[id].cls) scr.classList.add(THEMES[id].cls);
      }
      _buildWeather(id);
      if(!silent) toast(`${THEMES[id].icon} ${THEMES[id].name}`,'s');
    },
  };
  function _buildWeather(id){
    // Falling-particle weather (snow/dust/ember/spark/petal) disabled per
    // user request — the seasonal-theme palette change still happens, but
    // no particles are spawned regardless of the active theme.
    const host=document.getElementById('lobbyWeather');
    if(host) host.innerHTML='';
  }
  function showThemePicker(){
    const old=document.getElementById('themePicker'); if(old) old.remove();
    _ensureThemePickerStyles();
    const ov=document.createElement('div');
    ov.id='themePicker';
    ov.className='tp-ov';
    ov.innerHTML=`
      <div class="tp-panel" role="dialog" aria-label="Season Theme">
        <button class="tp-close" id="themePickerClose" aria-label="Close">×</button>
        <div class="tp-head">
          <div class="tp-eyebrow">🎨 LOBBY ATMOSPHERE</div>
          <div class="tp-title">SEASON THEME</div>
          <div class="tp-sub">Pick the lobby atmosphere — it changes the whole vibe</div>
        </div>
        <div class="tp-list">
          ${Theme.order.map(id=>{
            const th=THEMES[id], on=id===Theme.current;
            return `<button class="tp-opt ${on?'on':''}" data-th="${id}">
              <span class="tp-opt-ic">${th.icon}</span>
              <span class="tp-opt-txt">
                <span class="tp-opt-name">${esc(th.name)}</span>
                <span class="tp-opt-desc">${esc(th.desc)}</span>
              </span>
              <span class="tp-opt-check">✓</span>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));
    ov.querySelectorAll('.tp-opt').forEach(b=>b.addEventListener('click',()=>{
      Theme.apply(b.dataset.th);
      _closeThemePicker(ov);
    }));
    ov.querySelector('#themePickerClose').addEventListener('click',()=>_closeThemePicker(ov));
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) _closeThemePicker(ov); });
    const onKey=(e)=>{ if(e.key==='Escape'){ _closeThemePicker(ov); document.removeEventListener('keydown',onKey); } };
    document.addEventListener('keydown',onKey);
  }
  function _closeThemePicker(ov){
    ov.classList.remove('show');
    ov.classList.add('out');
    setTimeout(()=>ov.remove(), 240);
  }
  function _ensureThemePickerStyles(){
    if(document.getElementById('themePickerStyles')) return;
    const s=document.createElement('style');
    s.id='themePickerStyles';
    s.textContent=`
      .tp-ov{
        position:fixed; inset:0; z-index:1200;
        display:flex; align-items:center; justify-content:center; padding:20px;
        background:rgba(4,8,18,.0);
        backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px);
        transition:background .25s ease, backdrop-filter .25s ease;
      }
      .tp-ov.show{
        background:rgba(4,8,18,.62);
        backdrop-filter:blur(14px) saturate(140%);
        -webkit-backdrop-filter:blur(14px) saturate(140%);
      }
      .tp-ov.show .tp-panel{
        transform:translateY(0) scale(1); opacity:1;
      }
      .tp-ov.out .tp-panel{
        transform:translateY(12px) scale(.97); opacity:0;
        transition:transform .22s ease, opacity .22s ease;
      }
      .tp-panel{
        position:relative; overflow:hidden;
        width:min(460px, 95vw); max-height:88vh; overflow-y:auto;
        padding:24px 24px 22px;
        border-radius:24px;
        background:
          radial-gradient(120% 60% at 50% 0%, rgba(251,191,36,.08) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #1A2236 0%, #0E1525 50%, #080D1A 100%);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:
          0 40px 100px rgba(0,0,0,.75),
          0 0 40px rgba(251,191,36,.06),
          inset 0 1px 0 rgba(255,255,255,.06);
        color:#fff; font-family:'Outfit',sans-serif;
        transform:translateY(20px) scale(.95); opacity:0;
        transition:transform .32s cubic-bezier(.18,.89,.32,1.07), opacity .32s ease;
      }
      .tp-panel::before{
        content:""; position:absolute; left:30px; right:30px; top:0; height:2px;
        background:linear-gradient(90deg,
          transparent 0%, rgba(251,191,36,.85) 18%, rgba(232,50,74,.95) 50%,
          rgba(251,191,36,.85) 82%, transparent 100%);
        border-radius:2px;
        filter:drop-shadow(0 0 6px rgba(251,191,36,.4));
        pointer-events:none;
      }
      .tp-close{
        position:absolute; top:14px; right:16px;
        width:34px; height:34px; border-radius:50%; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
        color:rgba(255,255,255,.85); font-size:18px; font-weight:700; line-height:1;
        display:flex; align-items:center; justify-content:center;
        transition:transform .22s, background .2s, border-color .2s, color .2s;
      }
      .tp-close:hover{background:rgba(232,50,74,.20); border-color:rgba(232,50,74,.55); color:#fff; transform:rotate(90deg);}
      .tp-head{ text-align:center; margin-bottom:16px; padding:0 12px; }
      .tp-eyebrow{
        font-size:10px; font-weight:900; letter-spacing:2.8px;
        color:#FBBF24; text-transform:uppercase; margin-bottom:4px;
        text-shadow:0 1px 2px rgba(0,0,0,.5);
      }
      .tp-title{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:28px; letter-spacing:2.5px; line-height:1; font-weight:400;
        background:linear-gradient(180deg, #FDE68A 0%, #FBBF24 50%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 0 rgba(0,0,0,.35));
        text-transform:uppercase;
      }
      .tp-sub{
        margin-top:6px;
        font-size:11.5px; font-weight:600; line-height:1.4;
        color:rgba(255,255,255,.55);
      }
      .tp-list{ display:flex; flex-direction:column; gap:8px; }
      .tp-opt{
        display:flex; align-items:center; gap:13px;
        padding:12px 14px; border-radius:14px;
        background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
        border:1.5px solid rgba(255,255,255,.07);
        color:#fff; font-family:inherit; text-align:left; cursor:pointer;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
        transition:transform .18s cubic-bezier(.2,.7,.3,1.4),
                   background .2s, border-color .2s, box-shadow .2s;
      }
      .tp-opt:hover{
        transform:translateX(-2px);
        background:linear-gradient(180deg, rgba(251,191,36,.10), rgba(251,191,36,.02));
        border-color:rgba(251,191,36,.30);
        box-shadow:0 4px 12px rgba(0,0,0,.3), 0 0 12px rgba(251,191,36,.18);
      }
      .tp-opt.on{
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.22) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #2A3658 0%, #19223A 100%);
        border-color:#FBBF24;
        box-shadow:0 6px 18px rgba(251,191,36,.30),
                   0 0 18px rgba(251,191,36,.22),
                   inset 0 1px 0 rgba(255,255,255,.15);
      }
      .tp-opt-ic{
        flex-shrink:0; width:44px; height:44px; border-radius:12px;
        display:flex; align-items:center; justify-content:center;
        font-size:24px; line-height:1;
        background:
          radial-gradient(circle at 30% 25%, rgba(255,255,255,.32), rgba(255,255,255,0) 55%),
          linear-gradient(135deg, #2A3658, #19223A);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 2px 6px rgba(0,0,0,.4);
      }
      .tp-opt.on .tp-opt-ic{
        background:
          radial-gradient(circle at 30% 25%, rgba(255,255,255,.42), rgba(255,255,255,0) 55%),
          linear-gradient(135deg, #FBBF24, #B45309);
        border-color:rgba(255,251,235,.4);
      }
      .tp-opt-txt{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .tp-opt-name{
        font-weight:800; font-size:14px; letter-spacing:.3px;
      }
      .tp-opt-desc{
        font-size:11px; font-weight:600; color:rgba(255,255,255,.55); line-height:1.3;
      }
      .tp-opt.on .tp-opt-desc{ color:rgba(253,230,138,.8); }
      .tp-opt-check{
        flex-shrink:0; width:24px; height:24px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:13px; font-weight:900; color:transparent;
        background:transparent; border:1.5px solid rgba(255,255,255,.15);
        transition:all .2s;
      }
      .tp-opt.on .tp-opt-check{
        color:#3D2308; background:linear-gradient(180deg, #FBBF24, #D97706);
        border-color:#FFFBEB;
        box-shadow:0 3px 8px rgba(251,191,36,.45), inset 0 1px 0 rgba(255,255,255,.4);
      }
    `;
    document.head.appendChild(s);
  }

