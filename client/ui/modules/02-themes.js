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
    const host=document.getElementById('lobbyWeather');
    if(!host) return;
    host.innerHTML='';
    const t=THEMES[id];
    if(!t||!t.particle) return;
    if(matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    for(let i=0;i<t.count;i++){
      const p=document.createElement('div');
      p.className='wp '+t.particle;
      const sz=3+Math.random()*6;
      const dur=(t.particle==='ember'||t.particle==='spark')?(7+Math.random()*8):(8+Math.random()*11);
      p.style.cssText=`left:${(Math.random()*100).toFixed(1)}%;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;`+
        `animation-duration:${dur.toFixed(1)}s;animation-delay:${(-Math.random()*dur).toFixed(1)}s;`+
        `--drift:${((Math.random()*2-1)*90).toFixed(0)}px;opacity:${(.3+Math.random()*.55).toFixed(2)};`;
      host.appendChild(p);
    }
  }
  function showThemePicker(){
    const old=document.getElementById('themePicker'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.id='themePicker';
    ov.style.cssText='position:fixed;inset:0;z-index:1200;background:rgba(4,6,14,.85);backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;padding:20px;animation:gcIn .25s ease';
    ov.innerHTML=`
      <div style="width:min(440px,95vw);max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,rgba(28,32,57,.97),rgba(17,21,38,.99));border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:24px;box-shadow:0 40px 100px rgba(0,0,0,.75)">
        <div style="font-family:'Bangers',cursive;font-size:26px;letter-spacing:2px;color:#fff;text-align:center">🎨 SEASON THEME</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin:3px 0 16px;font-weight:600">Pick the lobby atmosphere — it changes the whole vibe</div>
        <div style="display:flex;flex-direction:column;gap:9px">
          ${Theme.order.map(id=>{
            const th=THEMES[id], on=id===Theme.current;
            return `<button class="theme-opt" data-th="${id}" style="display:flex;align-items:center;gap:13px;padding:13px 14px;border-radius:14px;cursor:pointer;font-family:inherit;text-align:left;
              background:${on?'rgba(245,158,11,.13)':'rgba(255,255,255,.03)'};
              border:1.5px solid ${on?'#F59E0B':'rgba(255,255,255,.07)'};color:#fff;transition:all .18s">
              <span style="font-size:28px">${th.icon}</span>
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:800;font-size:14px">${esc(th.name)}</span>
                <span style="display:block;font-size:11px;color:rgba(255,255,255,.5);font-weight:600">${esc(th.desc)}</span>
              </span>
              ${on?'<span style="color:#F59E0B;font-weight:900;font-size:16px">✓</span>':''}
            </button>`;
          }).join('')}
        </div>
        <button id="themePickerClose" style="width:100%;margin-top:14px;padding:12px;background:transparent;border:1.5px solid rgba(255,255,255,.1);border-radius:12px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${t('close')}</button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.theme-opt').forEach(b=>b.addEventListener('click',()=>{
      Theme.apply(b.dataset.th);
      ov.remove();
    }));
    ov.querySelector('#themePickerClose').addEventListener('click',()=>ov.remove());
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) ov.remove(); });
  }

