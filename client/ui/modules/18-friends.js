  /* ═══ FRIENDS SYSTEM ═══ */
  const Friends = {
    list: [], requests: [], tab: 'friends', open: false,
    pendingInvite: null,
  };

  function toggleFriendsPanel(){
    Friends.open = !Friends.open;
    document.getElementById('friendsPanel').classList.toggle('open', Friends.open);
    if(Friends.open) loadFriends();
  }

  function switchFriendsTab(tab){
    Friends.tab = tab;
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`ftab-${tab}`).classList.add('active');
    renderFriendsList();
  }

  async function loadFriends(){
    try{
      const data = await apiFetch('/api/friends');
      Friends.list = data.friends || [];
      // load requests from user object
      const me = await apiFetch('/api/auth/me');
      const reqs = me.user?.friendRequests || [];
      Friends.requests = reqs.map(id => {
        const u = [...(window._usersCache||[])].find(u=>u.id===id);
        return { id, username: u?.username || id };
      });
      renderFriendsList();
    } catch(e){ console.log('Friends load error', e); }
  }

  function renderFriendsList(){
    const el = document.getElementById('friendsList');
    if(!el) return;
    if(Friends.tab === 'friends'){
      if(!Friends.list.length){
        el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px;">No friends yet 😢<br>Add someone by username!</div>';
        return;
      }
      el.innerHTML = Friends.list.map(f => `
        <div class="friend-row">
          <div class="friend-dot ${f.isOnline?'online':'offline'}"></div>
          <div class="friend-name">${esc(f.username)}<br><span style="font-size:10px;color:var(--muted)">${f.isOnline?'Online':'Offline'}</span></div>
          <button class="friend-action dm" title="Message" onclick="DM.openThread('${f.id}','${esc(f.username)}','${esc(f.avatar||'')}')">💬</button>
          ${S.roomId && f.isOnline ? `<button class="friend-action invite" onclick="doInviteFriend('${f.id}')">Invite</button>` : ''}
          <button class="friend-action decline" onclick="doRemoveFriend('${f.id}')">✕</button>
        </div>
      `).join('');
    } else {
      const reqEl = document.getElementById('reqCount');
      if(reqEl) reqEl.textContent = Friends.requests.length ? ` (${Friends.requests.length})` : '';
      if(!Friends.requests.length){
        el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px;">No pending requests</div>';
        return;
      }
      el.innerHTML = Friends.requests.map(r => `
        <div class="friend-row">
          <div class="friend-name">👤 ${esc(r.username)}</div>
          <button class="friend-action accept" onclick="doAcceptFriend('${r.id}')">✓ Accept</button>
          <button class="friend-action decline" onclick="doDeclineFriend('${r.id}')">✕</button>
        </div>
      `).join('');
    }
  }

  async function doAddFriend(){
    const username = document.getElementById('addFriendInput').value.trim();
    if(!username) return;
    try{
      await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify({ username }) });
      document.getElementById('addFriendInput').value = '';
      toast(`Friend request sent to ${username}!`, 's');
    } catch(e){ toast(e.message||'Error', 'e'); }
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

  function showInviteToast(from, roomId, code){
    Friends.pendingInvite = { roomId, code };
    document.getElementById('inviteToastTitle').textContent = `🎮 ${from.username} invited you!`;
    document.getElementById('inviteToastMsg').textContent = code ? `Room Code: ${code}` : '';
    document.getElementById('inviteAcceptBtn').onclick = () => {
      hideInviteToast();
      doJoinRoom(roomId);
    };
    document.getElementById('inviteToast').classList.add('show');
    setTimeout(hideInviteToast, 15000);
  }

  function hideInviteToast(){
    document.getElementById('inviteToast').classList.remove('show');
  }

  function updateFriendsNotif(count){
    const el = document.getElementById('friendsNotif');
    if(!el) return;
    el.textContent = count;
    el.classList.toggle('show', count > 0);
  }

