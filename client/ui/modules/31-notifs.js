  /* ═══════════════ GAME NOTIFICATIONS ═══════════════
     Bell-icon panel. Per the user spec, this surfaces ONLY game-level
     alerts directed at the player — NOT the friends list:
       - Friend requests pending (incoming, awaiting your action)
       - Friend accepted (someone accepted your request)
       - Room invites from friends (in-flight)
       - Daily Spin ready
       - Daily login bonus claimable
       - Live event running + claimable missions

     The bell badge sums all unread items. Clicking an item performs the
     action and clears that item; closing the overlay marks all "seen". */

  const Notifs = {
    items: [],            // [{ id, type, title, sub, icon, action, time }]
    seenIds: new Set(),   // ids the user has already acked
    _isOpen: false,       // renamed from `open` to avoid clobbering the open() method below

    /* ────── badge math ────── */
    // Single source of truth — recomputed any time something feeds in
    // (DM, friends, spin, daily). Outputs a single integer for the bell.
    refreshBadge(){
      this._collect();
      const unread = this.items.filter(i => !this.seenIds.has(i.id)).length;
      const el = document.getElementById('hdrBellNotif');
      if(!el) return;
      if(unread > 0){
        el.textContent = unread > 9 ? '9+' : String(unread);
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    },

    // Rebuilds the items list from app state. Cheap to call.
    _collect(){
      const items = [];
      // 1. Pending friend requests (incoming).
      const reqs = window._friendRequests || [];
      reqs.forEach(r => items.push({
        id:    `req:${r.id}`,
        type:  'friend_request',
        icon:  '👥',
        title: `${r.username} wants to be friends`,
        sub:   'Tap to view in Friends',
        action: ()=>{ Notifs.close(); if(typeof toggleFriendsPanel === 'function') toggleFriendsPanel(); },
      }));
      // 2. Daily Spin ready.
      if(typeof SpinWheel !== 'undefined' && SpinWheel.ready){
        items.push({
          id:    'spin:ready',
          type:  'spin_ready',
          icon:  '🎰',
          title: 'Daily Spin is ready',
          sub:   'Free guaranteed reward — open the wheel',
          action: ()=>{ Notifs.close(); SpinWheel.open(); },
        });
      }
      // 3. Daily login bonus notification removed per user request —
      //    Daily Reward is no longer surfaced as a notification item.
      // 4. Live event banner (event:load drops d on window).
      const ev = window._currentEvent;
      if(ev){
        items.push({
          id:    `event:${ev.id}`,
          type:  'event_live',
          icon:  ev.emoji || '🎉',
          title: `${ev.name} is live`,
          sub:   ev.sub || 'Limited-time event — open the missions',
          action: ()=>{ Notifs.close(); EVENT?.openMissions?.(); },
        });
      }
      this.items = items;
    },

    /* ────── overlay ────── */
    show(){
      this._ensureNode();
      this._collect();
      this._render();
      const ov = document.getElementById('notifsOv');
      if(ov) ov.classList.add('show');
      this._isOpen = true;
    },
    close(){
      const ov = document.getElementById('notifsOv');
      if(ov) ov.classList.remove('show');
      this._isOpen = false;
      // Mark everything currently shown as seen so the badge clears.
      this.items.forEach(i => this.seenIds.add(i.id));
      this.refreshBadge();
    },
    // Alias matching the convention SpinWheel/DM use. Header bell calls this.
    open(){ this.show(); },

    _ensureNode(){
      if(document.getElementById('notifsOv')) return;
      const ov = document.createElement('div');
      ov.id = 'notifsOv';
      ov.className = 'notifs-ov';
      ov.innerHTML = `
        <div class="notifs-box" role="dialog" aria-label="Notifications">
          <button class="notifs-close" onclick="Notifs.close()" aria-label="Close">×</button>
          <div class="notifs-head">
            <div class="notifs-eyebrow">GAME ALERTS</div>
            <div class="notifs-title">NOTIFICATIONS</div>
          </div>
          <div class="notifs-list" id="notifsList"></div>
        </div>`;
      ov.addEventListener('mousedown', e => { if(e.target === ov) Notifs.close(); });
      document.body.appendChild(ov);
    },

    _render(){
      const list = document.getElementById('notifsList');
      if(!list) return;
      if(!this.items.length){
        list.innerHTML = `<div class="notifs-empty">
          <div class="notifs-empty-ic">🔕</div>
          <div class="notifs-empty-title">All caught up</div>
          <div class="notifs-empty-sub">Game alerts and rewards will show up here.</div>
        </div>`;
        return;
      }
      list.innerHTML = this.items.map((it, i) => `
        <button class="notifs-row" data-i="${i}" onclick="Notifs._fire(${i})">
          <span class="notifs-row-ic">${esc(it.icon || '🔔')}</span>
          <span class="notifs-row-txt">
            <span class="notifs-row-title">${esc(it.title || '')}</span>
            <span class="notifs-row-sub">${esc(it.sub || '')}</span>
          </span>
          <span class="notifs-row-chev">›</span>
        </button>`).join('');
    },
    _fire(i){
      const it = this.items[i];
      if(!it) return;
      this.seenIds.add(it.id);
      try{ it.action?.(); }catch(e){}
      this.refreshBadge();
    },
  };

  // Lightweight global hook so other modules (friends, spin, event) can
  // poke us without explicit imports.
  window.Notifs = Notifs;

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{ Notifs.refreshBadge(); }, 2000);
  });
