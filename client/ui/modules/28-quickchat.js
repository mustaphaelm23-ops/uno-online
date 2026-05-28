  /* ═══════════════ QUICK CHAT (GDD §7.5) ═══════════════
     Pre-vetted phrase grid for in-match social. Mirrors the server's
     QUICK_CHAT_PRESETS table by ID; sending a custom string isn't possible
     (server validates by ID). A floating 💭 fab on the game screen opens
     the grid; clicking a preset emits chat:quick {id} and the server
     broadcasts back as chat:quick { playerId, username, id, text } which
     this module renders as a 2.4s speech bubble pinned near the sender's
     opp panel (or the my-info row for the local player). */

  // Keep this list in sync with QUICK_CHAT_PRESETS in server/index.js.
  const QC_PRESETS = [
    { id: 1,  text: '👋 Hi!' },
    { id: 2,  text: '🎯 Nice play!' },
    { id: 3,  text: '🤣 GG' },
    { id: 4,  text: '😤 So close!' },
    { id: 5,  text: '🙏 Sorry!' },
    { id: 6,  text: '🎉 UNO!' },
    { id: 7,  text: '⚠️ Watch out!' },
    { id: 8,  text: '🔥 Let\'s go!' },
    { id: 9,  text: '😅 Oops' },
    { id: 10, text: '🤝 Good luck!' },
    { id: 11, text: '⏰ Hurry up!' },
    { id: 12, text: '👏 Well played' },
  ];

  const QuickChat = {
    open: false,
    _localCooldownMs: 2000,                            // mirrors the server rate-limit
    _nextAllowedAt: 0,

    init(){
      this._renderPanel();
      // Wire the fab clicks. Some platforms send a tap that also bubbles
      // to the close-on-outside-click handler — use stopPropagation on
      // the panel + fab to avoid the immediate auto-close.
      const fab = document.getElementById('qcFab');
      if(fab) fab.addEventListener('click', (e)=>{ e.stopPropagation(); this.toggle(); });
      // Outside-click closes the panel cleanly.
      document.addEventListener('click', (e)=>{
        if(!this.open) return;
        const panel = document.getElementById('qcPanel');
        if(panel && !panel.contains(e.target)) this.close();
      });
    },

    _renderPanel(){
      const panel = document.getElementById('qcPanel');
      if(!panel) return;
      panel.innerHTML = QC_PRESETS.map(p =>
        `<button class="qc-preset" data-qc="${p.id}" onclick="QuickChat.send(${p.id})">${esc(p.text)}</button>`
      ).join('');
    },

    toggle(){ this.open ? this.close() : this.openPanel(); },

    openPanel(){
      const panel = document.getElementById('qcPanel');
      if(!panel) return;
      panel.classList.add('show');
      this.open = true;
    },

    close(){
      const panel = document.getElementById('qcPanel');
      if(panel) panel.classList.remove('show');
      this.open = false;
    },

    send(id){
      if(!S.socket?.connected){
        toast('Not connected','e');
        return;
      }
      const now = Date.now();
      if(now < this._nextAllowedAt){
        const left = Math.ceil((this._nextAllowedAt - now)/1000);
        toast(`Slow down — wait ${left}s`,'i');
        return;
      }
      this._nextAllowedAt = now + this._localCooldownMs;
      S.socket.emit('chat:quick', { id }, (res)=>{
        if(res && res.success === false && res.reason === 'rate_limit'){
          // Server enforced the throttle — restart our local cooldown to
          // sync with the server's window so the player isn't double-rejected.
          this._nextAllowedAt = Date.now() + this._localCooldownMs;
        }
      });
      this.close();
    },

    // Render a 2.4s speech bubble pinned near the sender. Mirrors the
    // showReactionOnPanel pattern in 16-emoji.js (per-panel ephemeral
    // overlay; auto-removes; no state mutation). For the local player
    // we anchor to .myinfo if present; otherwise we fall back to a
    // centered flying bubble.
    onIncoming({ playerId, username, text }){
      if(!text) return;
      const isMe = playerId === S.user?.id;
      const anchor = isMe
        ? document.querySelector('.myinfo')
        : document.querySelector(`.opanel[data-pid="${playerId}"]`);
      if(anchor){
        const bubble = document.createElement('div');
        bubble.className = 'qc-bubble';
        bubble.textContent = text;
        // Make the anchor a positioning context if it isn't already.
        const cs = getComputedStyle(anchor);
        if(cs.position === 'static') anchor.style.position = 'relative';
        anchor.appendChild(bubble);
        setTimeout(()=>bubble.remove(), 2400);
      } else {
        // Fallback — center of the table area.
        const t = document.getElementById('topcard');
        const r = t?.getBoundingClientRect();
        const bubble = document.createElement('div');
        bubble.className = 'qc-bubble qc-bubble-fly';
        bubble.textContent = `${username}: ${text}`;
        bubble.style.left = (r ? r.left + r.width/2 : innerWidth/2) + 'px';
        bubble.style.top  = (r ? r.top  - 30           : innerHeight/2) + 'px';
        document.body.appendChild(bubble);
        setTimeout(()=>bubble.remove(), 2400);
      }
    },
  };

  // Boot once the DOM is ready. The fab + panel skeleton lives in index.html.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>QuickChat.init(), { once:true });
  } else {
    QuickChat.init();
  }
