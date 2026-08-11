  /* ═══ PRIVATE ROOM CODE ═══
     Modern bottom-sheet that mirrors the Create Room modal:
     - Slide-up sheet with backdrop blur (reuses .cr-* base styles)
     - Six big golden character boxes, auto-advance + paste support
     - Error pill slides in red if the code doesn't resolve
     - Same red CTA breath/shine treatment */

  function showJoinByCode(){
    const old = document.getElementById('jc-ov'); if(old) old.remove();
    if(typeof _ensureArenaStyles === 'function') _ensureArenaStyles();
    _ensureJoinCodeStyles();

    const ov = document.createElement('div');
    ov.id = 'jc-ov';
    ov.className = 'cr-ov';
    ov.innerHTML = `
      <div class="cr-sheet" role="dialog" aria-label="Join by Code">
        <div class="cr-grab"></div>
        <button class="cr-close" aria-label="Close">×</button>

        <div class="cr-head">
          <div class="cr-eyebrow">PRIVATE TABLE</div>
          <div class="cr-title">JOIN BY CODE</div>
          <div class="jc-sub">Enter the 6-character invite code your friend shared</div>
        </div>

        <div class="cr-step">
          <div class="cr-step-row">
            <span class="cr-step-num">1</span>
            <span class="cr-step-name">Room Code</span>
            <span class="cr-step-pick" id="jcProgress">0 / 6</span>
          </div>
          <div class="jc-boxes" id="jcBoxes">
            ${[0,1,2,3,4,5].map(i=>`
              <input class="jc-box" data-i="${i}" maxlength="1"
                inputmode="latin" autocapitalize="characters"
                autocomplete="off" spellcheck="false" aria-label="Character ${i+1}">
            `).join('')}
          </div>
          <div class="jc-err" id="jcErr"></div>
        </div>

        <button class="cr-go disabled" id="jcGo">
          <span class="cr-go-bg"></span>
          <span class="cr-go-label">JOIN ROOM</span>
          <span class="cr-go-arrow">→</span>
        </button>

        <div class="jc-hint">
          🔒 Private rooms only show up for players with the code
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));

    const boxes = Array.from(ov.querySelectorAll('.jc-box'));
    const goBtn = ov.querySelector('#jcGo');
    const errEl = ov.querySelector('#jcErr');
    const progEl = ov.querySelector('#jcProgress');

    function readCode(){
      return boxes.map(b => (b.value||'').trim().toUpperCase()).join('');
    }
    function syncState(){
      const code = readCode();
      progEl.textContent = `${code.length} / 6`;
      goBtn.classList.toggle('disabled', code.length !== 6);
      goBtn.querySelector('.cr-go-label').textContent =
        code.length === 6 ? 'JOIN ROOM' : `${6 - code.length} more…`;
    }

    function clearError(){
      if(!errEl.classList.contains('show')) return;
      errEl.classList.remove('show');
      boxes.forEach(b => b.classList.remove('err'));
    }

    boxes.forEach((box, i)=>{
      box.addEventListener('input', e=>{
        clearError();
        // Force upper-case and strip anything non-alphanumeric.
        const raw = (e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        e.target.value = raw.slice(0, 1);
        box.classList.toggle('filled', !!e.target.value);
        if(e.target.value && i < boxes.length - 1){
          boxes[i+1].focus();
          boxes[i+1].select?.();
        }
        syncState();
        if(readCode().length === 6){
          // Tiny pause so the user sees the final char land.
          setTimeout(()=>submit(), 150);
        }
      });
      box.addEventListener('keydown', e=>{
        if(e.key === 'Backspace' && !box.value && i > 0){
          boxes[i-1].focus();
          boxes[i-1].value = '';
          boxes[i-1].classList.remove('filled');
          syncState();
          e.preventDefault();
        } else if(e.key === 'ArrowLeft' && i > 0){
          boxes[i-1].focus(); e.preventDefault();
        } else if(e.key === 'ArrowRight' && i < boxes.length-1){
          boxes[i+1].focus(); e.preventDefault();
        } else if(e.key === 'Enter'){
          submit();
        }
      });
      // Distribute pasted full codes across the boxes.
      box.addEventListener('paste', e=>{
        const text = (e.clipboardData?.getData('text') || '')
          .toUpperCase().replace(/[^A-Z0-9]/g, '');
        if(!text) return;
        e.preventDefault();
        for(let k = 0; k < boxes.length; k++){
          boxes[k].value = text[k] || '';
          boxes[k].classList.toggle('filled', !!boxes[k].value);
        }
        const next = Math.min(text.length, boxes.length - 1);
        boxes[next].focus();
        syncState();
        if(readCode().length === 6) setTimeout(()=>submit(), 150);
      });
    });

    async function submit(){
      const code = readCode();
      if(code.length !== 6) return;
      goBtn.classList.add('disabled');
      goBtn.querySelector('.cr-go-label').textContent = 'CHECKING…';
      try{
        const res = await apiFetch(`/api/rooms/code/${code}`);
        close();
        doJoin(res.roomId);
      } catch(e){
        showError(e.message || 'Room not found');
        goBtn.querySelector('.cr-go-label').textContent = 'JOIN ROOM';
        goBtn.classList.remove('disabled');
      }
    }

    function showError(msg){
      errEl.textContent = msg;
      errEl.classList.add('show');
      boxes.forEach(b => b.classList.add('err'));
      // Shake the box row.
      const wrap = ov.querySelector('#jcBoxes');
      wrap.animate(
        [{transform:'translateX(0)'},{transform:'translateX(-7px)'},
         {transform:'translateX(7px)'},{transform:'translateX(0)'}],
        {duration:280}
      );
    }

    function close(){
      ov.classList.remove('show');
      ov.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(()=>ov.remove(), 260);
    }
    ov.querySelector('.cr-close').addEventListener('click', close);
    ov.addEventListener('mousedown', e=>{ if(e.target === ov) close(); });
    goBtn.addEventListener('click', ()=>{
      if(goBtn.classList.contains('disabled')) return;
      submit();
    });
    const onKey = (e)=>{ if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    // Focus the first box on next tick (after the animation starts).
    setTimeout(()=>boxes[0].focus(), 220);

    // Expose a "set code + auto-submit" path for ?join= deep links.
    window._joinCodeSheet = {
      setCode(code){
        const text = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,6);
        for(let k = 0; k < boxes.length; k++){
          boxes[k].value = text[k] || '';
          boxes[k].classList.toggle('filled', !!boxes[k].value);
        }
        syncState();
      },
      submit,
      close,
    };
  }

  // Best-effort fallback for any old call paths that still poke the legacy
  // hidden form input from the original HTML modal. Routes them through the
  // new sheet so nothing 404s on a missing DOM node.
  async function doJoinByCode(){
    const legacy = document.getElementById('joinCodeInput');
    if(window._joinCodeSheet){
      if(legacy?.value) window._joinCodeSheet.setCode(legacy.value);
      return window._joinCodeSheet.submit();
    }
    const code = (legacy?.value || '').trim().toUpperCase();
    if(code.length !== 6){
      showJoinByCode();
      if(code) setTimeout(()=>window._joinCodeSheet?.setCode(code), 250);
      return;
    }
    try{
      const res = await apiFetch(`/api/rooms/code/${code}`);
      doJoin(res.roomId);
    } catch(e){
      toast(e.message || 'Room not found', 'e');
    }
  }

  function showRoomCode(code){
    if(!code) return;
    S.roomCode = code;
    document.getElementById('roomCodeBox').style.display='block';
    document.getElementById('roomCodeDisplay').textContent = code;
  }

  function copyRoomCode(){
    if(!S.roomCode) return;
    navigator.clipboard.writeText(S.roomCode).then(()=>toast('Code copied!','s'));
  }

  // Copy a self-joining deep link the friend can paste into their browser.
  // Uses the page's current origin so it works on localhost AND the ngrok
  // domain — no hard-coded URL to rot.
  function copyRoomLink(){
    if(!S.roomCode) return;
    const link = `${location.origin}/?join=${S.roomCode}`;
    navigator.clipboard.writeText(link).then(
      ()=>toast('Link copied! Send it to your friend.','s'),
      ()=>toast('Could not copy link','e')
    );
  }

  // Native Web Share API where available (mobile + many desktop browsers);
  // gracefully falls back to copying the link otherwise.
  async function shareRoomNative(){
    if(!S.roomCode) return;
    const code = S.roomCode;
    const link = `${location.origin}/?join=${code}`;
    const text = `Join my RONDAONE room! Code: ${code}\n${link}`;
    if(navigator.share){
      try{ await navigator.share({title:'RONDAONE — Join my room', text, url:link}); return; }
      catch(e){ if(e?.name==='AbortError') return; /* user cancelled */ }
    }
    // Fallback: copy the link
    navigator.clipboard.writeText(link).then(
      ()=>toast('Share not available — link copied instead','i'),
      ()=>toast('Could not share','e')
    );
  }

  // Auto-join via ?join=CODE in the URL — drops the friend straight into the
  // new sheet with the code pre-filled.
  function _autoJoinFromUrl(){
    try{
      const params = new URLSearchParams(location.search);
      const code = (params.get('join')||'').trim().toUpperCase();
      if(!/^[A-Z0-9]{6}$/.test(code)) return;
      params.delete('join');
      const qs = params.toString();
      history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+location.hash);
      const tryJoin = ()=>{
        if(!S.token || !S.user) return setTimeout(tryJoin, 400);
        showJoinByCode();
        setTimeout(()=>{
          window._joinCodeSheet?.setCode(code);
          setTimeout(()=>window._joinCodeSheet?.submit(), 250);
        }, 350);
      };
      tryJoin();
    }catch(e){}
  }
  window.addEventListener('DOMContentLoaded', ()=>setTimeout(_autoJoinFromUrl, 600));

  function _ensureJoinCodeStyles(){
    if(document.getElementById('join-code-sheet-styles')) return;
    const s = document.createElement('style');
    s.id = 'join-code-sheet-styles';
    s.textContent = `
      @keyframes jcBoxPop {
        0%   { transform:scale(1) }
        50%  { transform:scale(1.10) }
        100% { transform:scale(1.04) }
      }
      @keyframes jcErrShake {
        0%,100% { transform:translateX(0) }
        25%     { transform:translateX(-4px) }
        75%     { transform:translateX(4px) }
      }

      .jc-sub{
        margin-top:8px;
        font-size:12px; font-weight:600;
        color:rgba(255,255,255,.55);
        line-height:1.4; padding:0 18px;
      }

      .jc-boxes{
        display:grid; grid-template-columns:repeat(6, 1fr);
        gap:8px; padding:6px 0;
      }
      .jc-box{
        aspect-ratio:1;
        width:100%; min-height:54px;
        border-radius:14px;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(180deg, #1F2A40 0%, #131B2D 100%);
        border:1.5px solid rgba(255,255,255,.10);
        color:#fff; text-align:center;
        font-family:'Bangers','Outfit',system-ui,sans-serif;
        font-size:30px; font-weight:400; letter-spacing:1px;
        text-transform:uppercase;
        caret-color:#FBBF24;
        outline:none;
        transition:transform .18s cubic-bezier(.2,.85,.3,1.1),
                   border-color .18s ease,
                   box-shadow .22s ease,
                   background .22s ease;
      }
      .jc-box:focus{
        border-color:#FBBF24;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.22) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #2A3658 0%, #19223A 100%);
        box-shadow:0 0 0 4px rgba(251,191,36,.18),
                   0 6px 22px rgba(251,191,36,.25),
                   inset 0 1px 0 rgba(255,255,255,.18);
      }
      .jc-box.filled{
        animation:jcBoxPop .28s cubic-bezier(.2,.85,.3,1.1) forwards;
        border-color:#FBBF24;
        background:
          radial-gradient(120% 80% at 50% 0%, rgba(251,191,36,.30) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #2A3658 0%, #19223A 100%);
        color:#FFFBEB;
        text-shadow:0 0 12px rgba(251,191,36,.6);
      }
      .jc-box.err{
        border-color:#F43F5E !important;
        box-shadow:0 0 0 4px rgba(244,63,94,.18),
                   0 6px 18px rgba(244,63,94,.30) !important;
        animation:jcErrShake .26s ease both;
      }

      .jc-err{
        max-height:0; overflow:hidden; margin-top:6px;
        font-size:12px; font-weight:700;
        color:#FCA5A5; text-align:center;
        background:rgba(244,63,94,.10);
        border:1px solid transparent;
        border-radius:10px;
        padding:0 12px;
        opacity:0;
        transition:max-height .25s ease, padding .25s ease,
                   opacity .25s ease, border-color .25s ease, margin-top .25s ease;
      }
      .jc-err.show{
        max-height:60px; padding:8px 12px; margin-top:10px;
        opacity:1; border-color:rgba(244,63,94,.35);
      }

      .jc-hint{
        margin-top:14px; padding:9px 12px;
        text-align:center;
        font-size:11px; font-weight:700; letter-spacing:.4px;
        color:rgba(255,255,255,.55);
        background:rgba(255,255,255,.04);
        border-radius:99px;
      }

      @media (max-width:420px){
        .jc-boxes{ gap:6px }
        .jc-box{ font-size:26px; min-height:46px; border-radius:12px }
      }
    `;
    document.head.appendChild(s);
  }
