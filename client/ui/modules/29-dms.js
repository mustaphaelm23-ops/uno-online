  /* ═══════════════ PRIVATE DMs (GDD §7.5 B) ═══════════════
     Friends-only 1:1 messaging. Two views in one overlay:
       1. Inbox     — list of recent threads (last msg + unread count)
       2. Thread    — single conversation with composer
     The Friends panel exposes a 💬 button per friend that calls openThread().
     Incoming dm:incoming socket events either append to the open thread or
     bump the inbox unread badge (handled by 08-socket.js, which delegates here). */

  const DM = {
    open: false,
    view: 'inbox',                       // 'inbox' | 'thread'
    activePartner: null,                 // {id, username, avatar} when view==='thread'
    threadCache: [],                     // currently-rendered thread messages
    unreadTotal: 0,                      // sum across all threads (for the fab badge)

    init(){
      const close = document.getElementById('dmClose');
      if(close) close.addEventListener('click', ()=>this.closeOverlay());
      const back = document.getElementById('dmBack');
      if(back) back.addEventListener('click', ()=>this.openInbox());
      const form = document.getElementById('dmForm');
      if(form) form.addEventListener('submit', (e)=>{ e.preventDefault(); this.sendCurrent(); });
      // Soft refresh inbox badge once auth is established. The socket connect
      // path in 08-socket.js also calls refreshUnread() after handshake, so
      // an early miss here doesn't matter.
      setTimeout(()=>this.refreshUnread(), 1500);
    },

    openOverlay(){
      const o = document.getElementById('dmOverlay');
      if(!o) return;
      o.classList.add('show');
      this.open = true;
    },
    closeOverlay(){
      const o = document.getElementById('dmOverlay');
      if(o) o.classList.remove('show');
      this.open = false;
      this.activePartner = null;
      this.view = 'inbox';
    },

    openInbox(){
      this.view = 'inbox';
      this.activePartner = null;
      this._setHeader('Messages', false);
      document.getElementById('dmComposer').style.display = 'none';
      const body = document.getElementById('dmBody');
      if(body) body.innerHTML = '<div class="dm-empty">Loading…</div>';
      this.openOverlay();
      if(!S.socket?.connected){
        body.innerHTML = '<div class="dm-empty">Not connected</div>';
        return;
      }
      S.socket.emit('dm:threads', {}, (res)=>{
        if(!this.open || this.view !== 'inbox') return;
        if(!res?.success){
          body.innerHTML = '<div class="dm-empty">Couldn\'t load messages</div>';
          return;
        }
        this._renderInbox(res.threads || []);
      });
    },

    _renderInbox(threads){
      const body = document.getElementById('dmBody');
      if(!body) return;
      if(!threads.length){
        body.innerHTML = '<div class="dm-empty">No messages yet. Open a friend\'s 💬 to start a thread.</div>';
        return;
      }
      body.innerHTML = threads.map(t => {
        const prev = t.lastFromMe ? `You: ${esc(t.lastText)}` : esc(t.lastText);
        const when = t.lastAt ? fmtRel(t.lastAt) : '';
        const badge = t.unread > 0 ? `<span class="dm-row-badge">${t.unread}</span>` : '';
        const avatar = t.partnerAvatar
          ? `<img class="dm-row-avatar" src="${esc(t.partnerAvatar)}" alt="">`
          : `<div class="dm-row-avatar dm-row-avatar-letter">${esc((t.partnerName||'?')[0])}</div>`;
        return `
          <div class="dm-row" onclick="DM.openThread('${esc(t.partnerId)}','${esc(t.partnerName)}','${esc(t.partnerAvatar||'')}')">
            ${avatar}
            <div class="dm-row-text">
              <div class="dm-row-name">${esc(t.partnerName)} <span class="dm-row-time">${esc(when)}</span></div>
              <div class="dm-row-prev">${prev}</div>
            </div>
            ${badge}
          </div>`;
      }).join('');
    },

    openThread(partnerId, partnerName, partnerAvatar){
      this.view = 'thread';
      this.activePartner = { id: partnerId, username: partnerName, avatar: partnerAvatar || '' };
      this._setHeader(partnerName, true);
      document.getElementById('dmComposer').style.display = 'flex';
      const body = document.getElementById('dmBody');
      if(body) body.innerHTML = '<div class="dm-empty">Loading…</div>';
      this.openOverlay();
      if(!S.socket?.connected){
        body.innerHTML = '<div class="dm-empty">Not connected</div>';
        return;
      }
      S.socket.emit('dm:thread', { withUserId: partnerId }, (res)=>{
        if(!this.open || this.view !== 'thread' || this.activePartner?.id !== partnerId) return;
        if(!res?.success){
          body.innerHTML = '<div class="dm-empty">Couldn\'t load thread</div>';
          return;
        }
        this.threadCache = res.messages || [];
        this._renderThread();
        // Server auto-marked the inbound messages read; refresh our badge.
        setTimeout(()=>this.refreshUnread(), 300);
      });
    },

    _renderThread(){
      const body = document.getElementById('dmBody');
      if(!body) return;
      if(!this.threadCache.length){
        body.innerHTML = '<div class="dm-empty">No messages yet. Say hi 👋</div>';
        return;
      }
      const meId = S.user?.id;
      body.innerHTML = this.threadCache.map(m => {
        const mine = m.from === meId;
        const cls = mine ? 'dm-msg dm-msg-mine' : 'dm-msg dm-msg-other';
        return `<div class="${cls}"><div class="dm-msg-text">${esc(m.text)}</div><div class="dm-msg-time">${esc(fmtTime(m.at))}</div></div>`;
      }).join('');
      // Snap to bottom — most recent message is what the user wants to see.
      body.scrollTop = body.scrollHeight;
    },

    sendCurrent(){
      const input = document.getElementById('dmInput');
      if(!input || !this.activePartner) return;
      const text = (input.value || '').trim();
      if(!text) return;
      if(!S.socket?.connected){ toast('Not connected','e'); return; }
      input.value = '';
      const partnerId = this.activePartner.id;
      S.socket.emit('dm:send', { toUserId: partnerId, text }, (res)=>{
        if(!res?.success){
          const reasonMsg = {
            rate_limit:  'Slow down — wait a moment',
            not_friends: 'You can only DM friends',
            empty:       'Message is empty',
          }[res?.reason] || 'Could not send';
          toast(reasonMsg,'e');
          return;
        }
        if(this.view === 'thread' && this.activePartner?.id === partnerId){
          this.threadCache.push(res.message);
          this._renderThread();
        }
      });
    },

    // Called by 08-socket.js when a dm:incoming arrives.
    onIncoming(msg){
      if(!msg) return;
      const partnerId = msg.from;
      // If the matching thread is open, append + auto-mark as read (open
      // thread = the recipient is looking at it).
      if(this.open && this.view === 'thread' && this.activePartner?.id === partnerId){
        this.threadCache.push(msg);
        this._renderThread();
        S.socket.emit('dm:read', { withUserId: partnerId });
        return;
      }
      // Otherwise nudge the inbox badge + a light toast preview.
      this.unreadTotal += 1;
      this._renderFabBadge();
      try{ toast(`💬 ${msg.fromName}: ${msg.text}`,'i'); }catch(e){}
      // If the inbox view is currently visible (but no thread), refresh the
      // list so the unread count + preview update live.
      if(this.open && this.view === 'inbox') this.openInbox();
    },

    refreshUnread(){
      if(!S.socket?.connected) return;
      S.socket.emit('dm:threads', {}, (res)=>{
        if(!res?.success) return;
        this.unreadTotal = (res.threads || []).reduce((s,t)=>s + (t.unread||0), 0);
        this._renderFabBadge();
      });
    },

    _renderFabBadge(){
      const b = document.getElementById('dmFabBadge');
      if(!b) return;
      if(this.unreadTotal > 0){
        b.textContent = this.unreadTotal > 99 ? '99+' : String(this.unreadTotal);
        b.classList.add('show');
      } else {
        b.classList.remove('show');
      }
    },

    _setHeader(title, showBack){
      const t = document.getElementById('dmTitle');
      if(t) t.textContent = title;
      const back = document.getElementById('dmBack');
      if(back) back.style.display = showBack ? 'inline-flex' : 'none';
    },
  };

  // Relative time formatter — small, kept local so this module doesn't
  // depend on whether a global helper exists.
  function fmtRel(at){
    if(!at) return '';
    const diff = Date.now() - at;
    if(diff < 60_000)        return 'just now';
    if(diff < 3_600_000)     return Math.floor(diff/60_000) + 'm';
    if(diff < 86_400_000)    return Math.floor(diff/3_600_000) + 'h';
    if(diff < 7*86_400_000)  return Math.floor(diff/86_400_000) + 'd';
    try{ return new Date(at).toLocaleDateString(); }catch(e){ return ''; }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>DM.init(), { once:true });
  } else {
    DM.init();
  }
