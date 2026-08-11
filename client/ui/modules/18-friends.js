  /* ═══ FRIENDS SYSTEM ═══ */
  const Friends = {
    list: [], requests: [], tab: 'friends', open: false,
    pendingInvite: null,
    searchQuery: '',
    MAX: 250,
  };

  function toggleFriendsPanel(){
    Friends.open = !Friends.open;
    document.getElementById('friendsPanel').classList.toggle('open', Friends.open);
    if(Friends.open){
      loadFriends();
      // Wire the search input the first time the panel opens.
      _wireFriendsSearch();
      // Populate the "Your ID" row with the short 9-char friend ID
      // (much friendlier to share than the full UUID).
      const idEl = document.getElementById('myIdVal');
      if(idEl) idEl.textContent = (S.user?.shortId) || (S.user?.id?.slice(0,9)?.toUpperCase()) || '—';
    }
  }

  // Copy the current user's short friend ID to the clipboard so they
  // can share it with someone they played with (who can then paste it
  // into the "Add by username or ID" input).
  async function copyMyFriendId(){
    const id = S.user?.shortId || S.user?.id;
    if(!id) return toast('No ID available', 'e');
    try{
      await navigator.clipboard.writeText(id);
      toast('Your ID copied — share it!', 's');
    }catch(e){
      // Some browsers refuse clipboard access without HTTPS / focus.
      // Fall back to a manual selection prompt.
      window.prompt('Copy your ID:', id);
    }
  }
  window.copyMyFriendId = copyMyFriendId;

  function switchFriendsTab(tab){
    Friends.tab = tab;
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`ftab-${tab}`).classList.add('active');
    renderFriendsList();
  }

  // Single binding — _wired guards against double-attaching on repeat opens.
  function _wireFriendsSearch(){
    const inp = document.getElementById('friendsSearch');
    const clr = document.getElementById('friendsSearchClear');
    if(!inp || inp._wired) return;
    inp._wired = true;
    inp.addEventListener('input', ()=>{
      Friends.searchQuery = (inp.value || '').trim().toLowerCase();
      if(clr) clr.style.display = Friends.searchQuery ? '' : 'none';
      renderFriendsList();
    });
    if(clr){
      clr.addEventListener('click', ()=>{
        inp.value = ''; Friends.searchQuery = '';
        clr.style.display = 'none';
        renderFriendsList();
        inp.focus();
      });
    }
  }

  async function loadFriends(){
    try{
      const [listData, reqData] = await Promise.all([
        apiFetch('/api/friends'),
        apiFetch('/api/friends/requests').catch(()=>({ requests: [] })),
      ]);
      Friends.list = listData.friends || [];
      Friends.requests = reqData.requests || [];
      // Surface pending requests to the global notifications bell.
      window._friendRequests = Friends.requests.slice();
      if(typeof Notifs !== 'undefined') Notifs.refreshBadge();
      _updateFriendsMeta();
      updateFriendsNotif(Friends.requests.length);
      renderFriendsList();
    } catch(e){ console.log('Friends load error', e); }
  }

  function _updateFriendsMeta(){
    const total  = Friends.list.length;
    const online = Friends.list.filter(f => f.isOnline).length;
    const totalEl  = document.getElementById('friendsTotalN');
    const onlineEl = document.getElementById('friendsOnlineN');
    if(totalEl)  totalEl.textContent  = total;
    if(onlineEl) onlineEl.textContent = online;
    // Tint the capacity counter red as you approach the cap.
    const cap = document.querySelector('.friends-meta-cap');
    if(cap){
      cap.classList.toggle('warn', total >= Friends.MAX * 0.9 && total < Friends.MAX);
      cap.classList.toggle('full', total >= Friends.MAX);
    }
  }

  // Avatar fallback — circular tile with the first letter on a gradient.
  function _friendAvatar(f){
    const a = (f.avatar || '').trim();
    if(a) return `<img class="friend-avatar" src="${esc(a)}" alt="">`;
    const ch = esc((f.username || '?')[0]).toUpperCase();
    return `<div class="friend-avatar friend-avatar-letter">${ch}</div>`;
  }

  function _statusLine(f){
    if(f.status === 'in_match')  return 'Playing in match';
    if(f.status === 'in_lobby')  return 'In lobby';
    if(f.isOnline)               return 'Online';
    return 'Offline';
  }

  function renderFriendsList(){
    const el = document.getElementById('friendsList');
    if(!el) return;
    if(Friends.tab === 'friends'){
      // Apply search filter — match against username, short ID, or full
      // user ID so a pasted ID (any format) still finds the friend if
      // they're already added.
      const q = Friends.searchQuery;
      const filtered = q
        ? Friends.list.filter(f =>
            (f.username || '').toLowerCase().includes(q) ||
            (f.shortId  || '').toLowerCase().includes(q) ||
            (f.id       || '').toLowerCase().includes(q))
        : Friends.list.slice();
      // Sort: online first, then by username.
      filtered.sort((a,b)=>{
        const ao = a.isOnline?1:0, bo = b.isOnline?1:0;
        if(ao !== bo) return bo - ao;
        return (a.username||'').localeCompare(b.username||'');
      });
      if(!Friends.list.length){
        el.innerHTML = `
          <div class="friends-empty">
            <div class="friends-empty-ic">👋</div>
            <div class="friends-empty-title">No friends yet</div>
            <div class="friends-empty-sub">Add someone by username below to start playing together.</div>
          </div>`;
        return;
      }
      if(!filtered.length){
        el.innerHTML = `
          <div class="friends-empty">
            <div class="friends-empty-ic">🔎</div>
            <div class="friends-empty-title">No matches</div>
            <div class="friends-empty-sub">No friend matches "${esc(q)}".</div>
          </div>`;
        return;
      }
      el.innerHTML = filtered.map(f => {
        const status = _statusLine(f);
        const onlineCls = f.isOnline ? 'online' : 'offline';
        // JOIN button when the friend is in a public waiting-room (server
        // only returns currentRoom for public rooms, so no extra check needed).
        const joinBtn = (f.currentRoom?.id && f.currentRoom.status === 'lobby')
          ? `<button class="friend-action join" onclick="doJoin('${esc(f.currentRoom.id)}')" title="Join their room">JOIN</button>`
          : '';
        // INVITE only when YOU're the host of a room.
        const inviteBtn = (S.roomId && f.isOnline && !joinBtn)
          ? `<button class="friend-action invite" onclick="doInviteFriend('${esc(f.id)}')" title="Invite to your room">INVITE</button>`
          : '';
        return `
          <div class="friend-row friend-row-rich">
            <div class="friend-row-tap" onclick="showOpponentProfile('${esc(f.id)}')" title="View profile" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;cursor:pointer">
              <div class="friend-avatar-wrap">
                ${_friendAvatar(f)}
                <span class="friend-dot ${onlineCls}"></span>
              </div>
              <div class="friend-text">
                <div class="friend-name">${esc(f.username)}${verifiedBadgeHTML(f.username,{size:'xs'})}</div>
                <div class="friend-status friend-status-${f.status || (f.isOnline?'online':'offline')}">${esc(status)}</div>
              </div>
            </div>
            <div class="friend-actions">
              <button class="friend-action dm" title="Message" onclick="event.stopPropagation();DM.openThread('${esc(f.id)}','${esc(f.username)}','${esc(f.avatar||'')}')">💬</button>
              ${joinBtn}
              ${inviteBtn}
              <button class="friend-action decline icon-only" title="Remove friend" onclick="event.stopPropagation();doRemoveFriend('${esc(f.id)}')">×</button>
            </div>
          </div>`;
      }).join('');
    } else {
      const reqEl = document.getElementById('reqCount');
      if(reqEl) reqEl.textContent = Friends.requests.length ? ` (${Friends.requests.length})` : '';
      if(!Friends.requests.length){
        el.innerHTML = `
          <div class="friends-empty">
            <div class="friends-empty-ic">📬</div>
            <div class="friends-empty-title">No pending requests</div>
            <div class="friends-empty-sub">New friend requests show up here.</div>
          </div>`;
        return;
      }
      el.innerHTML = Friends.requests.map(r => `
        <div class="friend-row friend-row-rich">
          <div class="friend-avatar-wrap">
            ${_friendAvatar(r)}
          </div>
          <div class="friend-text">
            <div class="friend-name">${esc(r.username)}${verifiedBadgeHTML(r.username,{size:'xs'})}</div>
            <div class="friend-status">wants to be friends</div>
          </div>
          <div class="friend-actions">
            <button class="friend-action accept" onclick="doAcceptFriend('${esc(r.id)}')">✓</button>
            <button class="friend-action decline" onclick="doDeclineFriend('${esc(r.id)}')">×</button>
          </div>
        </div>
      `).join('');
    }
  }

  async function doAddFriend(){
    const username = document.getElementById('addFriendInput').value.trim();
    if(!username) return;
    return addFriendByUsername(username, ()=>{
      document.getElementById('addFriendInput').value = '';
      _closeFriendSearch();
    });
  }

  // ── Live player search ───────────────────────────────────────────
  // Typing a name surfaces the players who have (or are close to) that
  // name; a full ID jumps straight to the player. Debounced so we don't
  // hammer the server on every keystroke.
  let _frSearchTimer = null;
  function onFriendSearchInput(val){
    const q = String(val || '').trim();
    clearTimeout(_frSearchTimer);
    const box = document.getElementById('frSearchResults');
    if(!box) return;
    if(q.length < 1){ _closeFriendSearch(); return; }
    box.innerHTML = '<div class="fr-sr-empty">Searching…</div>';
    box.classList.add('show');
    _ensureFriendSearchOutsideClose();
    _frSearchTimer = setTimeout(() => _runFriendSearch(q), 220);
  }
  async function _runFriendSearch(q){
    const box = document.getElementById('frSearchResults');
    if(!box) return;
    let results = [];
    try{ const d = await apiFetch('/api/friends/search?q=' + encodeURIComponent(q)); results = d?.results || []; }
    catch(e){
      const msg = (e?.status === 404)
        ? '🔄 Search needs a server restart — restart the server, then refresh.'
        : 'Search failed — try again.';
      box.innerHTML = `<div class="fr-sr-empty">${msg}</div>`;
      return;
    }
    // The query may have changed while the request was in flight.
    const live = (document.getElementById('addFriendInput')?.value || '').trim();
    if(live !== q) return;
    if(!results.length){
      box.innerHTML = `<div class="fr-sr-empty">No players found for “${esc(q)}”</div>`;
      return;
    }
    box.innerHTML = results.map(r => {
      const initial = esc((r.username || '?')[0].toUpperCase());
      const img = r.avatar && /^(https?:|data:|\/)/.test(r.avatar);
      const av  = img ? `<span class="fr-sr-av" style="background-image:url('${esc(r.avatar)}')"></span>`
                      : `<span class="fr-sr-av fr-sr-av-txt">${initial}</span>`;
      const action = r.isFriend
        ? `<span class="fr-sr-badge ok">✓ Friend</span>`
        : r.outgoing
          ? `<span class="fr-sr-badge sent">✓ Requested</span>`
          : r.incoming
            ? `<button class="fr-sr-add" onclick="event.stopPropagation();addFriendFromSearch('${esc(r.id)}','${esc((r.username||'').replace(/'/g,"\\'"))}',this)">✓ Accept</button>`
            : `<button class="fr-sr-add" onclick="event.stopPropagation();addFriendFromSearch('${esc(r.id)}','${esc((r.username||'').replace(/'/g,"\\'"))}',this)">＋ Add</button>`;
      return `<div class="fr-sr-row" onclick="showOpponentProfile('${esc(r.id)}')" title="View profile">
          ${av}
          <div class="fr-sr-info">
            <div class="fr-sr-name">${esc(r.username)}${verifiedBadgeHTML(r.username,{size:'xs'})}</div>
            <div class="fr-sr-id">ID: ${esc(r.shortId || '—')}</div>
          </div>
          ${action}
        </div>`;
    }).join('');
  }
  async function addFriendFromSearch(id, username, btn){
    if(btn){ btn.disabled = true; btn.textContent = '…'; }
    try{
      await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify({ userId: id }) });
      toast(`Friend request sent to ${username}! 🎉`, 's');
      if(btn){ btn.textContent = '✓ Sent'; btn.classList.add('sent'); }
    }catch(e){
      toast(e.message || 'Could not send request', 'e');
      if(btn){ btn.disabled = false; btn.textContent = '＋ Add'; }
    }
  }
  function _closeFriendSearch(){
    const box = document.getElementById('frSearchResults');
    if(box){ box.classList.remove('show'); box.innerHTML = ''; }
  }
  let _frOutsideBound = false;
  function _ensureFriendSearchOutsideClose(){
    if(_frOutsideBound) return;
    _frOutsideBound = true;
    document.addEventListener('mousedown', (e) => {
      if(!e.target.closest('.add-friend-wrap')) _closeFriendSearch();
    });
  }
  window.onFriendSearchInput = onFriendSearchInput;
  window.addFriendFromSearch = addFriendFromSearch;

  // Shared "send friend request" helper. Callable from anywhere a username
  // appears (player list in-game, profile sheet, chat, etc.) — opens the
  // path the user asked for: "add frends tkon f kol user".
  // Send a friend request by username, 9-digit numeric ID, or full UUID.
  // Server accepts any; we auto-detect here so the same input handles
  // every case:
  //   • All digits, 8-9 chars (player-share ID) → send as shortId
  //   • Looks like a UUID (8-4-4-4-12 hex)      → send as userId
  //   • Otherwise                               → send as username
  // 8 digits accepted as a courtesy in case someone drops the leading
  // digit when sharing; server-side lookup still requires an exact match.
  async function addFriendByUsername(query, onSuccess){
    const q = String(query || '').trim();
    if(!q) return;
    const looksLikeShortId = /^[0-9]{8,9}$/.test(q);
    const looksLikeUuid    = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(q);
    const body = looksLikeShortId ? { shortId: q }
               : looksLikeUuid    ? { userId: q }
                                  : { username: q };
    try{
      await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify(body) });
      toast(`Friend request sent!`, 's');
      onSuccess?.();
    } catch(e){
      toast(e.message || 'Could not send request', 'e');
    }
  }

  async function doAcceptFriend(userId){
    try{
      await apiFetch('/api/friends/accept', { method:'POST', body: JSON.stringify({ userId }) });
      toast('Friend added! 🎉', 's');
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doDeclineFriend(userId){
    try{
      await apiFetch('/api/friends/decline', { method:'POST', body: JSON.stringify({ userId }) });
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doRemoveFriend(userId){
    try{
      await apiFetch('/api/friends/remove', { method:'POST', body: JSON.stringify({ userId }) });
      toast('Friend removed', 'i');
      loadFriends();
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  async function doInviteFriend(friendId){
    if(!S.roomId) return toast('You are not in a room', 'e');
    try{
      await apiFetch('/api/friends/invite', { method:'POST', body: JSON.stringify({ friendId, roomId: S.roomId }) });
      toast('Invite sent! 🎮', 's');
    } catch(e){ toast(e.message||'Error', 'e'); }
  }

  // ── Room-screen INVITE FRIENDS picker ──────────────────────────────
  // One tap from the waiting room: shows ONLINE friends first with a big
  // INVITE button each (offline ones dimmed below), marks "✓ Sent" per
  // friend, and reminds that the room code works too.
  async function showRoomInvitePicker(){
    if(!S.roomId) return toast('Create or join a room first', 'i');
    document.getElementById('roomInviteOv')?.remove();
    const ov = document.createElement('div');
    ov.id = 'roomInviteOv'; ov.className = 'rinv-ov';
    ov.innerHTML = `
      <div class="rinv-card" role="dialog" aria-label="Invite friends">
        <button class="rinv-close" onclick="document.getElementById('roomInviteOv')?.remove()" aria-label="Close">×</button>
        <div class="rinv-title">👥 Invite Friends</div>
        <div class="rinv-sub">Online friends get a pop-up with one-tap JOIN</div>
        <div class="rinv-list" id="rinvList"><div class="rinv-empty">Loading friends…</div></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e)=>{ if(e.target === ov) ov.remove(); });
    requestAnimationFrame(()=>ov.classList.add('show'));
    // Fresh list (also fills Friends.list if the panel was never opened).
    try{
      const d = await apiFetch('/api/friends', { timeout: 8000 });
      Friends.list = d.friends || [];
    }catch(e){}
    const box = document.getElementById('rinvList');
    if(!box) return;
    const fs = (Friends.list || []).slice()
      .sort((a,b)=>(b.isOnline?1:0)-(a.isOnline?1:0));
    if(!fs.length){
      box.innerHTML = `<div class="rinv-empty">No friends yet — add some from the 👥 Friends panel,<br>or share the room code below.</div>`;
      return;
    }
    box.innerHTML = fs.map(f=>{
      const av = (typeof _isImgAvatar==='function' && _isImgAvatar(f.avatar))
        ? `<span class="rinv-av" style="background-image:url('${esc(f.avatar)}')"></span>`
        : `<span class="rinv-av rinv-av-letter">${esc((f.avatar||f.username||'?').charAt(0).toUpperCase())}</span>`;
      return `<div class="rinv-row ${f.isOnline?'':'off'}">
        ${av}
        <span class="rinv-name">${esc(f.username)}${typeof verifiedBadgeHTML==='function'?verifiedBadgeHTML(f.username,{size:'xs'}):''}</span>
        <span class="rinv-dot ${f.isOnline?'on':''}"></span>
        ${f.isOnline
          ? `<button class="rinv-btn" onclick="this.outerHTML='<span class=\\'rinv-sent\\'>✓ Sent</span>'; doInviteFriend('${esc(f.id)}')">INVITE</button>`
          : `<span class="rinv-offline">offline</span>`}
      </div>`;
    }).join('');
  }
  window.showRoomInvitePicker = showRoomInvitePicker;

  function showInviteToast(from, roomId, code){
    Friends.pendingInvite = { roomId, code };
    document.getElementById('inviteToastTitle').textContent = `🎮 ${from.username} invited you!`;
    document.getElementById('inviteToastMsg').textContent = code ? `Room Code: ${code}` : '';
    document.getElementById('inviteAcceptBtn').onclick = () => {
      hideInviteToast();
      doJoin(roomId);
    };
    document.getElementById('inviteToast').classList.add('show');
    setTimeout(hideInviteToast, 15000);
  }

  function hideInviteToast(){
    document.getElementById('inviteToast').classList.remove('show');
  }

  function updateFriendsNotif(count){
    const el = document.getElementById('friendsNotif');
    if(el){
      el.textContent = count;
      el.classList.toggle('show', count > 0);
    }
    const legacy = document.getElementById('friendsNotifLobby');
    if(legacy){
      legacy.textContent = count;
      legacy.style.display = count > 0 ? 'flex' : 'none';
    }
    // Header 👥 button badge — pending friend-request count.
    const hdr = document.getElementById('hdrFriendsNotif');
    if(hdr){
      if(count > 0){
        hdr.textContent = count > 9 ? '9+' : String(count);
        hdr.style.display = '';
      } else {
        hdr.style.display = 'none';
      }
    }
    // Per user request: the bell + chat badges are NOT for friend-list
    // activity. The bell is wired to Notifs (game alerts), the chat is
    // wired to DM.refreshUnread() (friend DMs only). Recompute here so
    // friend-request changes still bubble into Notifs' badge.
    if(typeof Notifs !== 'undefined') Notifs.refreshBadge();
  }

