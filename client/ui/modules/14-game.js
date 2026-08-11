  /* ═══ PLAYER PROFILE MODAL — pro-tier sheet ═══
     Top-of-the-line player card on opponent tap. Shows avatar with a
     tier-based glow frame, name, level, rank, stats (games, wins,
     win-rate, peak), an achievement strip, and "last seen" line. Below
     that lives a 5-button action row: Add Friend, Invite to Room,
     Message, Report, Block. Bots render the same card but with a bot
     label and limited actions (add only, fake-accepts). */
  const _PROFILE_TIERS = [
    { min:0,    name:'Bronze',      badge:'🥉', color:'#CD7F32', glow:'rgba(205,127,50,.55)' },
    { min:500,  name:'Silver',      badge:'🥈', color:'#C0C0C0', glow:'rgba(192,192,192,.55)' },
    { min:1300, name:'Gold',        badge:'🥇', color:'#FFD700', glow:'rgba(255,215,0,.55)' },
    { min:2400, name:'Platinum',    badge:'💠', color:'#E5E4E2', glow:'rgba(229,228,226,.55)' },
    { min:3900, name:'Diamond',     badge:'💎', color:'#B9F2FF', glow:'rgba(185,242,255,.6)' },
    { min:6000, name:'Master',      badge:'👑', color:'#9F70FD', glow:'rgba(159,112,253,.65)' },
    { min:9000, name:'Grandmaster', badge:'🏆', color:'#FF6B6B', glow:'rgba(255,107,107,.65)' },
  ];
  function _profileTierFor(rp){
    return [..._PROFILE_TIERS].reverse().find(t => (rp||0) >= t.min) || _PROFILE_TIERS[0];
  }
  function _profileLastSeen(ts){
    if(!ts) return 'Last seen: unknown';
    const diff = Date.now() - ts;
    if(diff < 60_000)        return 'Online now';
    if(diff < 3_600_000)     return `Last seen ${Math.floor(diff/60_000)}m ago`;
    if(diff < 86_400_000)    return `Last seen ${Math.floor(diff/3_600_000)}h ago`;
    if(diff < 7*86_400_000)  return `Last seen ${Math.floor(diff/86_400_000)}d ago`;
    return `Last seen ${new Date(ts).toLocaleDateString()}`;
  }
  function _profileAchievements(u){
    // Derive badges from data we already have — no separate achievements
    // table yet. Each entry is { icon, label } shown as a chip.
    const out = [];
    const wins = u.stats?.gamesWon || 0;
    const played = u.stats?.gamesPlayed || 0;
    if(wins >= 1000)     out.push({ icon:'👑', label:'Legend (1000+ wins)' });
    else if(wins >= 100) out.push({ icon:'🏅', label:'Centurion (100+ wins)' });
    else if(wins >= 10)  out.push({ icon:'⭐', label:'Rising Star' });
    if(u.peakRankPoints >= 2000) out.push({ icon:'🥇', label:`Peak ${u.peakRankPoints} RP` });
    if((u.winStreak || 0) >= 3)  out.push({ icon:'🔥', label:`${u.winStreak}-win streak` });
    if(played >= 50 && wins/played >= 0.6) out.push({ icon:'📈', label:'60%+ win rate' });
    if(u.accountLevel >= 50) out.push({ icon:'🎖️', label:`Lvl ${u.accountLevel}` });
    return out.slice(0, 3);
  }

  function showOpponentProfile(playerId){
    if(!playerId) return;
    // Lookup priority: UNO players → RONDA/Dama players → friends → server fetch.
    // (RONDA/Dama keep their own player list; without this a bot there fell back
    //  to the "Player / BOT_RONDA" skeleton instead of its real name + avatar.)
    let p = (S.g?.players || []).find(x => x.id === playerId)
         || (typeof Ronda !== 'undefined' && (Ronda.state?.players || []).find(x => x.id === playerId))
         || (typeof Dama  !== 'undefined' && (Dama.state?.players  || []).find(x => x.id === playerId))
         || (typeof Chess !== 'undefined' && (Chess.state?.players || []).find(x => x.id === playerId))
         || (Friends?.list || []).find(x => x.id === playerId)
         || null;
    // If nothing local, render a skeleton + let the async fetch populate.
    if(!p) p = { id: playerId, username: 'Player', avatar: null, accountLevel: 1, isBot:false };
    _ensureOpponentProfileStyles();
    const old = document.getElementById('oppProfileOv');
    if(old) old.remove();

    const ov = document.createElement('div');
    ov.id = 'oppProfileOv';
    ov.className = 'opp-prof-ov';

    const isMe          = p.id === S.user?.id;
    const isBot         = !!p.isBot || /^t?bot[_-]/i.test(p.id || '');
    // Friendship is matched on EITHER the internal id OR the public shortId —
    // in-game player ids can differ from the stored friend id, but the shortId
    // is stable, so this catches friends whether viewed in a match or the list.
    const _friendKeys = new Set(
      (Friends?.list || []).flatMap(f => [f.id, f.shortId].filter(Boolean).map(String))
    );
    const _isFriend = (u) => !isBot && [u?.id, u?.shortId, p?.id, p?.shortId]
      .some(x => x && _friendKeys.has(String(x)));
    const inRoom        = !!S.roomId;

    // Render once with whatever we have, then re-render with richer data
    // once /api/player/:id resolves.
    const render = (data) => {
      const u = data || p;
      // Make bots indistinguishable from real players: give them plausible,
      // STABLE stats (hashed from name + rank) so their profile reads genuine
      // instead of empty/"0 games".
      if(isBot){
        let h = 0; const s = String(u.username || u.id || 'x');
        for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
        // ONE skill seed drives EVERYTHING so the numbers can NEVER contradict
        // (e.g. high level but Bronze rank). Rank ↔ level ↔ games ↔ win-rate all
        // scale together: a higher-ranked bot is also higher level, more games.
        // Rank MUST reflect the bot's tier so the profile never lies: ELITE
        // "pro" bots (premium cards + HARD play) sit in the high band → Diamond/
        // Master; REGULAR bots (default cards, easy/medium) are capped well below
        // Diamond → Bronze..Platinum. So a high-rank opponent always has the top
        // look + tough play to match.
        const skill   = u.isElite ? (82 + (h % 18)) : (h % 60);        // elite 82..99 → Diamond+; regular 0..59 → ≤Platinum
        if(!u.rankPoints && !u.rankedTier) u.rankPoints = Math.round(40 + (skill/99)*6200);
        const rp      = u.rankPoints || 0;
        const level   = Math.max(3, Math.min(100, Math.round(8 + (rp/100)*1.15 + (h % 7))));
        const played  = (u.isElite ? 180 : 25) + level*4 + (h % 45);
        const winRate = (u.isElite ? 0.58 : 0.42) + (skill/100)*0.18;  // elite ~58–76%
        if(!u.stats)          u.stats          = { gamesPlayed: played, gamesWon: Math.round(played*winRate) };
        if(!u.accountLevel)   u.accountLevel   = level;
        // Peak stays in the SAME ballpark as current (no jumping tiers) so it
        // reads as a real history, not a contradiction.
        if(!u.peakRankPoints || u.peakRankPoints < rp) u.peakRankPoints = rp + (h % 200);
        if(!u.lastLoginAt)    u.lastLoginAt    = Date.now() - ((h % 60) + 1) * 60000;
        if((u.placementGamesPlayed || 0) < 5) u.placementGamesPlayed = 5;
        // Fake numeric public ID so it NEVER shows the raw "BOT_…" id.
        if(!u.shortId || /bot/i.test(String(u.shortId))) u.shortId = String(100000000 + (h % 899999999));
      }
      // Re-evaluated each render so the richer server payload (with shortId)
      // can confirm friendship even if the first pass missed it.
      const alreadyFriend = !isMe && _isFriend(u);
      const lvl       = u.accountLevel || 1;
      // Public player ID — prefer the short ID, fall back to a slice of the
      // internal id. Shown on every profile so players can identify/report.
      const pid       = u.shortId || (u.id || '').slice(0, 9).toUpperCase() || '—';
      // Profile banner — the ornate plaque behind the avatar + name. Banners are
      // ranked rewards: show the player's EARNED/equipped banner, defaulting to
      // the universal royal-gold (also used for bots).
      const _bIds = ['royal-gold','sapphire','royal-crimson','amethyst','inferno'];
      const banner = _bIds.includes(u.profileBanner) ? u.profileBanner : 'royal-gold';
      const bannerLight = false;   // all banners are dark-filled now
      const tier      = u.rankedTier   || _profileTierFor(u.rankPoints || 0);
      const tierColor = tier?.color || '#FBBF24';
      const tierGlow  = _profileTierFor(u.rankPoints || 0).glow;
      // Bots are never "placement" — they always carry a real tier, so their
      // rank emblem shows clearly (not dimmed/unranked).
      const placement = !isBot && (u.placementGamesPlayed || 0) < 5;
      // Real rank-badge artwork (same set as the Ranked Hub) for this player's tier.
      const tierName  = String(tier?.name || tier?.label || 'Bronze');
      const _rk = { bronze:'bronze', silver:'silver', gold:'gold', platinum:'platinum',
        diamond:'diamond', master:'master', legend:'grandmaster', grandmaster:'grandmaster' };
      const rankImg = `/ranks/${_rk[tierName.toLowerCase()] || 'bronze'}.png`;
      // X-style verification seal beside the name (gold for the dev/showcase
      // account, blue for everyone else). Bots get none.
      const goldVerified = String(u.shortId) === '951808283' || String(u.username || '').toLowerCase() === 'mustapha';
      const verifiedHTML = `<span class="profile-v4-verified opp-prof-verified${goldVerified ? ' is-gold' : ''}" title="Verified">✓</span>`;
      const tierLabel = placement ? `🎯 PLACEMENT ${u.placementGamesPlayed || 0}/5` : `${tier?.badge || '🥉'} ${tier?.label || tier?.name || 'Bronze'}`;
      const wins      = u.stats?.gamesWon  || 0;
      const played    = u.stats?.gamesPlayed || 0;
      const winRate   = played > 0 ? Math.round((wins/played)*100) : 0;
      const peak      = u.peakRankPoints || u.rankPoints || 0;
      const lastSeen  = _profileLastSeen(u.lastLoginAt);

      // Avatar with rank-coloured frame + glow.
      const img = _isImgAvatar(u.avatar);
      const face = img ? '' : esc((u.avatar || u.username || '?')[0]).toUpperCase();
      const avatarHTML = `
        <div class="opp-prof-avatar-wrap" style="--tier:${tierColor};--tier-glow:${tierGlow}">
          <div class="opp-prof-avatar ${img ? '' : 'opp-prof-avatar-letter'}" style="${img ? `background-image:url('${esc(u.avatar)}')` : ''}">${face}</div>
          <img class="opp-prof-avatar-rank${placement ? ' is-unranked' : ''}" src="${rankImg}" alt="${esc(tierName)}" title="${placement ? 'Unranked' : esc(tierName)}" draggable="false">
        </div>`;

      // RANK card — the player's tier shown with its real badge artwork. The
      // headline piece the user asked for: prominent, tier-coloured, modern.
      const rankCardHTML = `
        <div class="opp-prof-rank ${placement ? 'is-unranked' : ''}" style="--tier:${tierColor};--tier-glow:${tierGlow}">
          <div class="opp-prof-rank-badge"><img src="${rankImg}" alt="${esc(tierName)}" draggable="false"></div>
          <div class="opp-prof-rank-meta">
            <span class="opp-prof-rank-eyebrow">RANK</span>
            <span class="opp-prof-rank-tier">${placement ? 'UNRANKED' : esc(tierName.toUpperCase())}</span>
            <span class="opp-prof-rank-rp">${placement
              ? `🎯 Placement · ${u.placementGamesPlayed || 0}/5`
              : `${(u.rankPoints || 0).toLocaleString()} RP · Peak ${peak.toLocaleString()}`}</span>
          </div>
          ${placement ? '' : `<div class="opp-prof-rank-chev">›</div>`}
        </div>`;

      // Stats grid (4 cards).
      const statsHTML = `
        <div class="opp-prof-stats">
          <div class="opp-prof-stat"><div class="opp-prof-stat-val">${played}</div><div class="opp-prof-stat-lbl">Games</div></div>
          <div class="opp-prof-stat"><div class="opp-prof-stat-val opp-prof-stat-w">${wins}</div><div class="opp-prof-stat-lbl">Wins</div></div>
          <div class="opp-prof-stat"><div class="opp-prof-stat-val">${winRate}%</div><div class="opp-prof-stat-lbl">Win rate</div></div>
          <div class="opp-prof-stat"><div class="opp-prof-stat-val" style="color:${tierColor}">${placement ? '—' : peak}</div><div class="opp-prof-stat-lbl">Peak RP</div></div>
        </div>`;

      // Achievement chips.
      const achList = _profileAchievements(u);
      const achHTML = achList.length ? `
        <div class="opp-prof-achs">
          ${achList.map(a => `<span class="opp-prof-ach"><span>${a.icon}</span> ${esc(a.label)}</span>`).join('')}
        </div>` : '';

      // Action buttons. Disabled / hidden based on context.
      let actionsHTML = '';
      if(isMe){
        actionsHTML = `<div class="opp-prof-note">That's you 👋</div>`;
      } else {
        // (Mute removed from the profile — the per-opponent mic mute still
        //  lives on the opponent pill during a match; it has no place on a
        //  leaderboard / friends profile card.)
        const addBtn = alreadyFriend
          ? `<button class="opp-prof-act opp-prof-act-ok" disabled>✓ Friends</button>`
          : `<button class="opp-prof-act opp-prof-act-primary" onclick="doAddFriendOpponent('${esc(p.id)}','${esc(u.username || '')}',${isBot},this)">＋ Add</button>`;
        const inviteBtn = (inRoom && !isBot && alreadyFriend)
          ? `<button class="opp-prof-act" onclick="doInviteOpponent('${esc(p.id)}')">🎮 Invite</button>`
          : `<button class="opp-prof-act" disabled title="${!inRoom ? 'Join or create a room first' : 'Add as friend first'}">🎮 Invite</button>`;
        const msgBtn = (!isBot && alreadyFriend)
          ? `<button class="opp-prof-act" onclick="doMessageOpponent('${esc(p.id)}','${esc(u.username || '')}','${esc(u.avatar || '')}')">💬 Message</button>`
          : `<button class="opp-prof-act" disabled title="Add as friend first">💬 Message</button>`;
        const reportBtn = `<button class="opp-prof-act opp-prof-act-warn" onclick="doReportPlayer('${esc(p.id)}','${esc(u.username || '')}')">🚩 Report</button>`;
        const blockBtn  = `<button class="opp-prof-act opp-prof-act-danger" onclick="doBlockPlayer('${esc(p.id)}','${esc(u.username || '')}',this)">⛔ Block</button>`;
        actionsHTML = `
          <div class="opp-prof-actions">
            ${addBtn}${inviteBtn}${msgBtn}${reportBtn}${blockBtn}
          </div>`;
      }

      // Bots are indistinguishable from real players — everyone shows the same
      // tier tag (the old "🤖 BOT — HARD" tag was the last visible bot tell).
      const headerTag = `<div class="opp-prof-tag" style="border-color:${tierColor}55;color:${tierColor}">${tierLabel}</div>`;

      ov.innerHTML = `
        <div class="opp-prof-box" role="dialog" aria-label="Player profile">
          <button class="opp-prof-close" onclick="document.getElementById('oppProfileOv')?.remove()" aria-label="Close">×</button>
          <div class="opp-prof-eyebrow">PLAYER PROFILE</div>
          <div class="opp-prof-header${banner ? ' has-banner' : ''}${bannerLight ? ' banner-light' : ''}"${banner ? ` style="--profile-banner:url('/banners/${banner}.png')"` : ''}>
            ${avatarHTML}
            <div class="opp-prof-hinfo">
              <div class="opp-prof-name"><span class="opp-prof-name-text">${esc(u.username || 'Player')}</span>${verifiedHTML}</div>
              <button class="opp-prof-id" onclick="_copyPlayerId('${esc(pid)}',this)" title="Copy ID">ID: <b>${esc(pid)}</b><span class="opp-prof-id-copy">⧉</span></button>
              <div class="opp-prof-hmeta">
                <span class="opp-prof-lvl">Lvl ${lvl}</span>
                <span class="opp-prof-hrank" style="--tier:${tierColor}">
                  <img class="opp-prof-hrank-img" src="${rankImg}" alt="${esc(tierName)}" draggable="false">
                  <span>${placement ? 'UNRANKED' : esc(tierName.toUpperCase())}</span>
                </span>
              </div>
            </div>
          </div>
          ${rankCardHTML}
          ${statsHTML}
          ${achHTML}
          <div class="opp-prof-lastseen">${esc(lastSeen)}</div>
          ${actionsHTML}
        </div>`;
    };

    // Guard the first render — if any helper throws, the modal must STILL open
    // (with a minimal fallback) instead of the click silently doing nothing.
    try {
      render(p);
    } catch (err) {
      console.error('[showOpponentProfile] render failed:', err);
      ov.innerHTML = `
        <div class="opp-prof-box" role="dialog" aria-label="Player profile">
          <button class="opp-prof-close" onclick="document.getElementById('oppProfileOv')?.remove()" aria-label="Close">×</button>
          <div class="opp-prof-eyebrow">PLAYER PROFILE</div>
          <div style="font-size:20px;font-weight:800;color:#fff;margin:10px 0">${esc(p.username || 'Player')}</div>
          <div style="color:rgba(255,255,255,.6)">Lvl ${p.accountLevel || 1}</div>
        </div>`;
    }
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));
    ov.addEventListener('mousedown', e=>{ if(e.target === ov) ov.remove(); });
    const onKey = (e)=>{ if(e.key === 'Escape'){ ov.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    // Fetch the rich profile and re-render once it lands.
    if(!isBot && !isMe){
      apiFetch('/api/player/' + encodeURIComponent(p.id)).then(d=>{
        if(!d?.user) return;
        const cur = document.getElementById('oppProfileOv');
        if(!cur) return;
        // Re-render in-place, preserving the overlay so the open animation
        // and ESC/click-outside handlers stay attached.
        render(d.user);
      }).catch(()=>{ /* keep base */ });
    }
  }
  window.showOpponentProfile = showOpponentProfile;

  // Copy a player's ID to the clipboard (tap the ID chip on any profile).
  function _copyPlayerId(id, btn){
    const txt = String(id || '');
    const done = () => {
      if(btn){ btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 1200); }
      if(typeof toast === 'function') toast('📋 ID copied: ' + txt, 's');
    };
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(txt).then(done).catch(() => done());
    } else {
      try{ const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }catch(e){}
      done();
    }
  }
  window._copyPlayerId = _copyPlayerId;

  // Per-player local mute toggle exposed for the opp profile sheet.
  // Same affordance as the chip on the opponent pill — flips both the
  // VoiceChat state and the button label/class so the user sees the
  // change immediately.
  window.doToggleMuteOpponent = function(playerId, btn){
    if(!playerId || typeof VoiceChat === 'undefined') return;
    VoiceChat.toggleMutePeer(playerId);
    const muted = !!VoiceChat.mutedPeers?.has(playerId);
    if(btn){
      btn.classList.toggle('opp-prof-act-muted', muted);
      btn.textContent = muted ? '🔇 Muted' : '🎤 Mute';
      btn.title = muted ? 'Unmute on your end' : 'Mute on your end';
    }
  };

  // Called by 08-socket.js when `game:over` arrives. That event is the
  // first one carrying data.rankedChanges, so it's also when the rewards
  // grid + the ranked drama (flying RP, promotion banner, progress card)
  // get their real values. Merges the new payload into S.lastWinData so
  // any later renderer sees the full picture.
  window._showRankedDramaFromGameOver = function(data){
    if(!data) return;
    S.lastWinData = { ...(S.lastWinData || {}), ...data };
    const iWon = data.winnerId === S.user?.id;
    const payout = (typeof data.payout === 'number') ? data.payout : 0;
    // Re-render the rewards row so the rank chip shows up alongside coins/XP.
    if(typeof _renderWinRewards === 'function') _renderWinRewards(S.lastWinData, iWon, payout);
    // Premium ranked result panel — real deltas are present now.
    if(typeof _renderRankedPanel === 'function') _renderRankedPanel(S.lastWinData);
    _showRankedDrama(S.lastWinData);
  };

  // Invite the visible opponent into our current room. Reuses the existing
  // friend-invite endpoint since we already gate the button on "is friend
  // + in a room". Closes the sheet on success.
  function doInviteOpponent(userId){
    if(!userId || !S.roomId) return;
    apiFetch('/api/friends/invite', {
      method:'POST',
      body: JSON.stringify({ friendId: userId, roomId: S.roomId }),
    }).then(()=>{
      toast('Invite sent 🎮','s');
      document.getElementById('oppProfileOv')?.remove();
    }).catch(e => toast(e?.message || 'Could not send invite','e'));
  }
  window.doInviteOpponent = doInviteOpponent;

  // Open a DM thread with this player. Closes the profile and routes
  // through the existing DM overlay (29-dms.js).
  function doMessageOpponent(userId, username, avatar){
    if(!userId) return;
    document.getElementById('oppProfileOv')?.remove();
    if(window.DM && typeof DM.openThread === 'function'){
      DM.openThread(userId, username, avatar || '');
    } else {
      toast('Messages unavailable','e');
    }
  }
  window.doMessageOpponent = doMessageOpponent;

  // Report — for now this just records the intent client-side and toasts.
  // Wire to a real moderation endpoint later without changing the UX.
  function doReportPlayer(userId, username){
    if(!userId) return;
    if(!confirm(`Report ${username || 'this player'}? Their account will be flagged for review.`)) return;
    toast(`Report received — thanks for keeping the game clean 🚩`,'s');
    // TODO: POST /api/moderation/report once the server endpoint exists.
  }
  window.doReportPlayer = doReportPlayer;

  // Block — local list for now. Stored on S.user.blocked so match-end and
  // friend-suggestion code can exclude blocked players. Server-side block
  // persistence is a follow-up (needs DB schema work).
  function doBlockPlayer(userId, username, btnEl){
    if(!userId) return;
    if(!confirm(`Block ${username || 'this player'}? You won't see them in matchmaking or chat.`)) return;
    if(!S.user) return;
    S.user.blocked = Array.isArray(S.user.blocked) ? S.user.blocked : [];
    if(!S.user.blocked.includes(userId)) S.user.blocked.push(userId);
    try{ localStorage.setItem('uno_user', JSON.stringify(S.user)); }catch(e){}
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '⛔ Blocked'; }
    toast(`${username || 'Player'} blocked`,'s');
  }
  window.doBlockPlayer = doBlockPlayer;

  // Friend-request from the in-game opponent profile. For bots, fakes the
  // network round-trip and shows a "Sent — bot won't accept though" hint.
  function doAddFriendOpponent(userId, username, isBot, btnEl){
    if(!userId) return;
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = 'Sending…'; }
    if(isBot){
      // Fake-send: keep the UX consistent without spamming the server with
      // a request that would always 404 anyway.
      setTimeout(()=>{
        if(btnEl){ btnEl.textContent = '✓ Sent'; btnEl.classList.add('sent'); }
        toast(`Friend request sent to ${username || 'player'}!`, 's');
      }, 400);
      return;
    }
    apiFetch('/api/friends/request', {
      method:'POST',
      body: JSON.stringify({ userId }),
    }).then(()=>{
      if(btnEl){ btnEl.textContent = '✓ Sent'; btnEl.classList.add('sent'); }
      toast(`Friend request sent to ${username || 'player'}!`, 's');
    }).catch(e=>{
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = '＋ Add Friend'; }
      toast(e.message || 'Could not send request', 'e');
    });
  }
  window.doAddFriendOpponent = doAddFriendOpponent;

  function _ensureOpponentProfileStyles(){
    if(document.getElementById('oppProfileStyles')) return;
    const s = document.createElement('style');
    s.id = 'oppProfileStyles';
    s.textContent = `
      .opp-prof-ov{
        position:fixed; inset:0; z-index:1200;
        display:flex; align-items:center; justify-content:center; padding:20px;
        background:rgba(4,8,18,0);
        backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px);
        transition:background .25s ease, backdrop-filter .25s ease;
      }
      .opp-prof-ov.show{
        background:rgba(4,8,18,.62);
        backdrop-filter:blur(14px) saturate(140%);
        -webkit-backdrop-filter:blur(14px) saturate(140%);
      }
      .opp-prof-box{
        position:relative;
        /* Tall profiles (rank card + stats + actions) must never clip on short
           screens — cap the height and let the card scroll smoothly instead. */
        overflow-y:auto; overflow-x:hidden;
        max-height:90vh; max-height:90dvh;
        scroll-behavior:smooth; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
        scrollbar-width:thin; scrollbar-color:rgba(251,191,36,.45) transparent;
        width:min(340px, 92vw); padding:22px 22px 20px;
        border-radius:22px;
        background:
          radial-gradient(120% 60% at 50% 0%, rgba(251,191,36,.10) 0%, rgba(251,191,36,0) 60%),
          linear-gradient(180deg, #1A2236 0%, #0E1525 50%, #080D1A 100%);
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 40px 100px rgba(0,0,0,.75),
                   0 0 40px rgba(251,191,36,.06),
                   inset 0 1px 0 rgba(255,255,255,.06);
        color:#fff; font-family:'Outfit',sans-serif; text-align:center;
        transform:scale(.94); opacity:0;
        transition:transform .32s cubic-bezier(.18,.89,.32,1.07), opacity .32s ease;
      }
      .opp-prof-box::-webkit-scrollbar{ width:6px; }
      .opp-prof-box::-webkit-scrollbar-thumb{ background:linear-gradient(180deg, rgba(251,191,36,.5), rgba(251,191,36,.18)); border-radius:6px; }
      .opp-prof-box::-webkit-scrollbar-track{ background:transparent; }
      .opp-prof-ov.show .opp-prof-box{ transform:scale(1); opacity:1; }
      .opp-prof-box::before{
        content:""; position:absolute; left:24px; right:24px; top:0; height:2px;
        background:linear-gradient(90deg, transparent 0%, rgba(251,191,36,.85) 18%, rgba(232,50,74,.95) 50%, rgba(251,191,36,.85) 82%, transparent 100%);
        border-radius:2px;
        filter:drop-shadow(0 0 6px rgba(251,191,36,.4));
        pointer-events:none;
      }
      .opp-prof-close{
        position:absolute; top:12px; right:14px;
        width:30px; height:30px; border-radius:50%; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
        color:rgba(255,255,255,.85); font-size:16px; line-height:1; font-weight:700;
        display:flex; align-items:center; justify-content:center;
        transition:transform .22s, background .2s, border-color .2s, color .2s;
      }
      .opp-prof-close:hover{
        background:rgba(232,50,74,.20); border-color:rgba(232,50,74,.55);
        color:#fff; transform:rotate(90deg);
      }
      .opp-prof-eyebrow{
        font-size:10px; font-weight:900; letter-spacing:2.8px;
        color:#FBBF24; text-transform:uppercase; margin-bottom:12px;
        text-shadow:0 1px 2px rgba(0,0,0,.5);
      }
      .opp-prof-avatar{
        width:84px; height:84px; border-radius:50%;
        /* The gradient is only the FALLBACK; the real avatar image is applied
           inline via background-image. CRITICAL: background-size/position must
           come AFTER the background shorthand below — the shorthand RESETS
           them, which is why the avatar was rendering as a top-left sliver
           instead of a centred cover-fit. */
        background:linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%);
        background-size:cover; background-position:center; background-repeat:no-repeat;
        border:3px solid #FBBF24;
        margin:0 auto 12px;
        display:flex; align-items:center; justify-content:center;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:38px; color:#FFFBEB;
        text-shadow:0 2px 4px rgba(0,0,0,.6);
        box-shadow:0 8px 22px rgba(0,0,0,.55), 0 0 20px rgba(251,191,36,.32);
      }
      .opp-prof-name{
        display:flex; align-items:center; gap:9px;
      }
      /* Banner plaque — wraps the avatar + name + ID + level into one ornate
         frame, exactly like the owner's own profile header. Horizontal layout
         so the wide frame fits the avatar + info. */
      .opp-prof-header{
        display:flex; align-items:center; justify-content:center; gap:16px;
        margin-bottom:14px;
      }
      .opp-prof-header.has-banner{
        background:var(--profile-banner) center/100% 100% no-repeat;
        justify-content:flex-start;
        padding:20px 46px; border-radius:13px; margin:6px 0 16px;
        box-shadow:0 12px 30px rgba(0,0,0,.5);
      }
      .opp-prof-header .opp-prof-avatar-wrap{ margin:0; flex:0 0 auto; }
      .opp-prof-header.has-banner .opp-prof-avatar-wrap{ width:60px; height:60px; }
      .opp-prof-header.has-banner .opp-prof-avatar-wrap .opp-prof-avatar{
        width:60px; height:60px; font-size:26px;
        box-shadow:0 0 0 2px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.55);
      }
      .opp-prof-hinfo{ display:flex; flex-direction:column; align-items:flex-start; gap:6px; min-width:0; }
      .opp-prof-header.has-banner .opp-prof-name-text{ font-size:22px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
      .opp-prof-hinfo .opp-prof-id,
      .opp-prof-hinfo .opp-prof-lvl{ margin:0; }
      .opp-prof-name-text{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:26px; letter-spacing:2px; line-height:1; font-weight:400;
        background:linear-gradient(180deg, #FDE68A 0%, #FBBF24 50%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 0 rgba(0,0,0,.35));
        text-transform:uppercase;
      }
      .opp-prof-verified{ flex:0 0 auto; }
      .opp-prof-id{
        display:inline-flex; align-items:center; gap:6px; margin:0 auto 8px;
        padding:3px 10px; border-radius:99px; cursor:pointer;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12);
        color:rgba(255,255,255,.6); font-size:11px; font-weight:700; letter-spacing:.5px;
        font-family:'Outfit',sans-serif; transition:background .15s, border-color .15s, color .15s;
      }
      .opp-prof-id b{ color:#FFE9B0; font-weight:800; letter-spacing:1px; }
      .opp-prof-id:hover{ background:rgba(255,255,255,.09); border-color:rgba(251,191,36,.4); color:rgba(255,255,255,.85); }
      .opp-prof-id-copy{ font-size:12px; opacity:.6; }
      .opp-prof-id.copied{ border-color:#34D399; color:#6EE7B7; }
      .opp-prof-id.copied b{ color:#6EE7B7; }
      .opp-prof-lvl{
        display:inline-block; padding:3px 12px; border-radius:99px;
        background:rgba(251,191,36,.10); border:1px solid rgba(251,191,36,.30);
        color:#FDE68A; font-size:11px; font-weight:900; letter-spacing:1.2px;
        text-transform:uppercase; line-height:1.4;
        margin-bottom:10px;
      }
      /* Level + RANK shown together in the header. */
      .opp-prof-hmeta{ display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
      .opp-prof-hinfo .opp-prof-hmeta .opp-prof-lvl{ margin:0; }
      .opp-prof-hrank{
        display:inline-flex; align-items:center; gap:6px;
        padding:3px 11px 3px 5px; border-radius:99px; line-height:1;
        background:color-mix(in srgb, var(--tier,#FBBF24) 18%, rgba(0,0,0,.35));
        border:1px solid color-mix(in srgb, var(--tier,#FBBF24) 55%, transparent);
        box-shadow:0 0 12px color-mix(in srgb, var(--tier,#FBBF24) 30%, transparent);
        color:#fff; font-size:11px; font-weight:900; letter-spacing:1px; text-transform:uppercase;
        white-space:nowrap;
      }
      .opp-prof-hrank-img{ width:22px; height:22px; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
      .opp-prof-tag{
        display:inline-block; padding:4px 12px; border-radius:99px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10);
        font-size:11px; font-weight:800; letter-spacing:1px; color:#fff;
        margin-bottom:14px;
      }
      .opp-prof-tag-bot{
        background:rgba(96,165,250,.12);
        border-color:rgba(96,165,250,.35);
        color:#A5D8FF;
      }
      .opp-prof-add{
        display:inline-block; width:100%;
        padding:11px 16px; border-radius:10px;
        background:linear-gradient(180deg, #FBBF24 0%, #D97706 100%);
        border:1px solid rgba(255,251,235,.4);
        color:#3D2308; cursor:pointer;
        font-family:'Outfit',sans-serif;
        font-size:13px; font-weight:900; letter-spacing:1px; text-transform:uppercase;
        box-shadow:0 4px 12px rgba(251,191,36,.40), inset 0 1px 0 rgba(255,255,255,.4);
        transition:transform .18s cubic-bezier(.34,1.56,.64,1), filter .15s, box-shadow .22s;
      }
      .opp-prof-add:hover{ transform:translateY(-1px); filter:brightness(1.08); }
      .opp-prof-add:active{ transform:translateY(0) scale(.96); }
      .opp-prof-add:disabled{ cursor:default; opacity:.85; }
      .opp-prof-add.sent{
        background:linear-gradient(180deg, #22C55E 0%, #15803D 100%);
        color:#fff;
      }
      .opp-prof-add-bot{ filter:saturate(.85); }
      .opp-prof-note{
        margin-top:6px; padding:7px 12px; border-radius:8px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
        color:rgba(255,255,255,.7); font-size:11px; font-weight:700;
      }
      .opp-prof-note-ok{ color:#86EFAC; border-color:rgba(74,222,128,.30); background:rgba(74,222,128,.10); }
      .opp-prof-note-hint{ margin-top:8px; font-size:10px; color:rgba(255,255,255,.55); border-style:dashed; }

      /* ── Pro profile: enlarged box, tier-framed avatar, stat grid,
            achievement chips, last-seen line, 5-button action row. ── */
      .opp-prof-box{ width:min(420px, 94vw); padding:20px 20px 18px; }
      .opp-prof-avatar-wrap{
        position:relative; margin:0 auto 10px; width:96px; height:96px;
      }
      .opp-prof-avatar-wrap::before{
        content:''; position:absolute; inset:-6px;
        border-radius:50%;
        background:conic-gradient(from 0deg, var(--tier, #FBBF24), transparent 60%, var(--tier, #FBBF24));
        filter:blur(.5px) drop-shadow(0 0 12px var(--tier-glow, rgba(251,191,36,.55)));
        animation:oppFrameSpin 8s linear infinite;
      }
      @keyframes oppFrameSpin{ to{ transform:rotate(360deg) } }
      .opp-prof-avatar-wrap .opp-prof-avatar{
        position:relative; margin:0; width:96px; height:96px;
        font-size:42px;
        border:3px solid var(--tier, #FBBF24);
        box-shadow:0 8px 26px rgba(0,0,0,.6), 0 0 24px var(--tier-glow, rgba(251,191,36,.45));
      }
      /* Bot indicator — pinned at the TOP corner so it never collides with
         the rank emblem at the bottom corner. */
      .opp-prof-avatar-badge{
        position:absolute; right:-2px; top:-2px;
        width:26px; height:26px; border-radius:50%;
        background:#0E1525; border:2px solid var(--tier, #FBBF24);
        display:flex; align-items:center; justify-content:center;
        font-size:13px; line-height:1;
        box-shadow:0 4px 10px rgba(0,0,0,.5);
        z-index:3;
      }
      /* Real rank-badge artwork pinned on the avatar's bottom corner. */
      .opp-prof-avatar-rank{
        position:absolute; right:-7px; bottom:-7px;
        width:40px; height:40px; object-fit:contain; z-index:2;
        filter:drop-shadow(0 3px 6px rgba(0,0,0,.6));
      }
      .opp-prof-avatar-rank.is-unranked{ filter:grayscale(.7) brightness(.85) drop-shadow(0 3px 6px rgba(0,0,0,.6)); opacity:.85; }
      /* In the compact banner header the avatar is 60px — scale the emblem to match. */
      .opp-prof-header.has-banner .opp-prof-avatar-rank{ width:30px; height:30px; right:-5px; bottom:-5px; }
      .opp-prof-header.has-banner .opp-prof-avatar-badge{ width:22px; height:22px; font-size:11px; }

      /* RANK card — headline tier display with the real badge. */
      .opp-prof-rank{
        display:flex; align-items:center; gap:14px;
        width:100%; margin:14px 0 4px; padding:11px 16px; border-radius:16px;
        background:
          radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, var(--tier) 18%, transparent), transparent 60%),
          linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015));
        border:1px solid color-mix(in srgb, var(--tier) 40%, rgba(255,255,255,.08));
        box-shadow:0 8px 22px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06);
      }
      .opp-prof-rank-badge{ flex:0 0 auto; width:56px; height:56px; display:flex; align-items:center; justify-content:center; }
      .opp-prof-rank-badge img{ width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 3px 8px rgba(0,0,0,.5)); }
      .opp-prof-rank.is-unranked .opp-prof-rank-badge img{ filter:grayscale(.75) brightness(.8) drop-shadow(0 3px 8px rgba(0,0,0,.5)); opacity:.8; }
      .opp-prof-rank-meta{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; text-align:left; }
      .opp-prof-rank-eyebrow{ font-size:9px; font-weight:900; letter-spacing:2px; color:rgba(255,255,255,.5); }
      .opp-prof-rank-tier{
        font-family:'Bangers','Outfit',sans-serif; font-size:25px; letter-spacing:1.2px; line-height:1.02;
        color:var(--tier, #FBBF24); text-shadow:0 0 16px color-mix(in srgb, var(--tier) 50%, transparent);
      }
      .opp-prof-rank-rp{ font-size:11.5px; font-weight:800; color:rgba(255,255,255,.72); }
      .opp-prof-rank-chev{ flex:0 0 auto; font-size:24px; font-weight:700; color:color-mix(in srgb, var(--tier) 75%, transparent); }
      .opp-prof-stats{
        display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;
        margin:10px 0 12px;
      }
      .opp-prof-stat{
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);
        border-radius:9px; padding:8px 4px;
      }
      .opp-prof-stat-val{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:20px; letter-spacing:1px; line-height:1; color:#FFFBEB;
      }
      .opp-prof-stat-val.opp-prof-stat-w{ color:#86EFAC; }
      .opp-prof-stat-lbl{
        margin-top:2px; font-size:9px; letter-spacing:1.4px; text-transform:uppercase;
        color:rgba(255,255,255,.55); font-weight:800;
      }
      .opp-prof-achs{
        display:flex; flex-wrap:wrap; gap:6px; justify-content:center;
        margin:0 0 10px;
      }
      .opp-prof-ach{
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 10px; border-radius:99px;
        background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.30);
        font-size:10px; font-weight:800; letter-spacing:.6px; color:#FDE68A;
      }
      .opp-prof-ach span{ font-size:12px; line-height:1; }
      .opp-prof-lastseen{
        margin-bottom:12px; font-size:10px; letter-spacing:1.4px;
        color:rgba(255,255,255,.4); text-transform:uppercase;
      }
      .opp-prof-actions{
        display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;
      }
      .opp-prof-act{
        display:flex; align-items:center; justify-content:center; gap:3px;
        min-height:36px; white-space:nowrap;
        padding:8px 4px; border-radius:9px;
        background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12);
        color:#FFFBEB; cursor:pointer;
        font-family:'Outfit',sans-serif;
        font-size:10px; font-weight:900; letter-spacing:.4px;
        line-height:1.1;
        transition:transform .15s cubic-bezier(.34,1.56,.64,1), background .18s, border-color .18s;
      }
      .opp-prof-act:hover{ transform:translateY(-1px); background:rgba(255,255,255,.08); }
      .opp-prof-act:active{ transform:translateY(0) scale(.96); }
      .opp-prof-act:disabled{
        cursor:default; opacity:.45;
        transform:none; background:rgba(255,255,255,.03);
      }
      .opp-prof-act-primary{
        background:linear-gradient(180deg, #FBBF24, #D97706);
        border-color:rgba(255,251,235,.4);
        color:#3D2308;
        box-shadow:0 3px 10px rgba(251,191,36,.35);
      }
      .opp-prof-act-primary:hover{ filter:brightness(1.08); }
      .opp-prof-act-ok{
        background:rgba(34,197,94,.15); border-color:rgba(34,197,94,.50); color:#86EFAC;
      }
      .opp-prof-act-warn:hover{ background:rgba(251,191,36,.12); border-color:rgba(251,191,36,.45); color:#FDE68A; }
      .opp-prof-act-danger:hover{ background:rgba(232,50,74,.15); border-color:rgba(232,50,74,.55); color:#FCA5A5; }
      /* Muted-state styling for the per-player mic toggle in the profile
       * sheet — red gradient so the user sees at a glance that this
       * player is silenced on their end. */
      .opp-prof-act-muted{
        background:linear-gradient(135deg, rgba(127,29,29,.45), rgba(69,10,10,.35)) !important;
        border-color:rgba(232,50,74,.55) !important;
        color:#FECACA !important;
      }
      .opp-prof-act-muted:hover{ filter:brightness(1.1); }

      @media (max-width:520px){
        .opp-prof-box{ padding:18px 16px 16px; }
        .opp-prof-actions{ grid-template-columns:repeat(5, 1fr); gap:4px; }
        .opp-prof-act{ padding:7px 2px; font-size:9px; min-height:32px; }
        .opp-prof-stat-val{ font-size:17px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ═══ GAME ACTIONS ═══ */
  function playCard(cardId){
    if(!canIPlay())return toast("Not your turn!",'e');
    const card=S.g.myHand.find(c=>c.id===cardId);if(!card)return;
    if(card.isWild){S.pendingWild=cardId;document.getElementById('cmodal').classList.add('show');return;}
    // Look up the visual card via the stable data-cid attribute that the
    // renderHand path stamps on every .hcard. We used to grep onclick=
    // strings here, but in-place state refreshes set onclick via a JS
    // property (no HTML attribute), so the attribute selector silently
    // missed the card and the flight animation didn't fire.
    const el=document.querySelector(`.hcard[data-cid="${cardId}"]`) || document.querySelector(`.hcard[onclick*="${cardId}"]`);
    if(el){
      el.classList.add('playing');
      el.style.pointerEvents='none';
      const rect=el.getBoundingClientRect();
      const top=document.getElementById('topcard').getBoundingClientRect();
      const dx=top.left-rect.left;
      const dy=top.top-rect.top;
      el.style.setProperty('--fly-x',dx+'px');
      el.style.setProperty('--fly-y',dy+'px');
    }
    setTimeout(()=>{
      S.socket.emit('game:play_card',{cardId},(res)=>{
        if(!res.success){toast(res.reason,'e');SFX.play('error');if(el){el.classList.remove('playing');el.style.pointerEvents='';}}
        else{
          document.getElementById('cancelArea').style.display='none';
          if(S.g.myHand.length!==1)S.calledUNO=false;
          // No clone here — the game:played broadcast lands the discard card
          // itself via renderTop(..., myId), flying in from my hand (RONDA style).
          SFX.play('play');
        }
      });
    },180);
  }
  function pickColor(color){
    document.getElementById('cmodal').classList.remove('show');
    const cardId=S.pendingWild;S.pendingWild=null;if(!cardId)return;
    S.socket.emit('game:play_card',{cardId,chosenColor:color},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{document.getElementById('cancelArea').style.display='none';toast(`Color: ${color.toUpperCase()}!`,'s');SFX.play('play');}
    });
  }
  function doDraw(){
    if(!canIDraw())return toast(canIPlay()?'Already drew — play or cancel':'Not your turn!','e');
    if(S.g.stackDraw>0)toast(`Taking ${S.g.stackDraw} stacked cards!`,'w');
    S.socket.emit('game:draw_card',{},(res)=>{
      if(!res.success){toast(res.reason,'e');SFX.play('error');}
      else{
        const deckEl=document.getElementById('drawpile');
        const handEl=document.getElementById('myhand');
        AnimLayer.draw(null,deckEl,handEl);
      }
    });
  }
  function doCancel(){
    document.getElementById('cancelArea').style.display='none';S.g.turnPhase='waiting';
    S.socket.emit('game:pass',{},(res)=>{if(res&&!res.success)toast(res.reason||'Error','e');});
  }
  function doUNO(){
    if(S.g.myHand.length!==1)return toast('Need exactly 1 card!','e');
    S.socket.emit('game:call_uno',{},(res)=>{
      if(res.success){S.calledUNO=true;toast('Cardora! 🎉','s');SFX.play('uno');updateUNOButton();}
      else toast(res.reason,'e');
    });
  }
  function showCatchButton(targetId){
    document.querySelectorAll('.opanel').forEach(p=>{
      if(p.dataset.pid===targetId){
        p.querySelectorAll('.catch-btn').forEach(b=>b.remove());
        const btn=document.createElement('button');btn.className='catch-btn';btn.textContent='CATCH!';
        btn.onclick=(e)=>{e.stopPropagation();S.socket.emit('game:catch_uno',{targetId},(res)=>{
          if(res.success)toast('Caught them! +2 cards!','s');else toast(res.reason,'e');removeCatch();});};
        p.appendChild(btn);setTimeout(()=>btn.remove(),2500);
      }
    });
  }
  function removeCatch(){document.querySelectorAll('.catch-btn').forEach(b=>b.remove());}
  function toggleGameMenu(){document.getElementById('gameMenu').classList.toggle('show');}
  function gameMenuProfile(){
    document.getElementById('gameMenu').classList.remove('show');
    setTimeout(()=>showProfile(),120);
  }
  function gameMenuLogout(){
    document.getElementById('gameMenu').classList.remove('show');
    if(S.roomId){
      if(!confirm('You are in a game. Logging out will forfeit it. Continue?')) return;
      S.socket?.emit('room:leave',{},()=>{ S.roomId=null; doLogout(); });
    } else {
      doLogout();
    }
  }
  let soundOn=true;
  function refreshSoundLabel(){
    const el=document.getElementById('soundLabel');
    if(el) el.textContent=`${t('sound')}: ${soundOn?'ON':'OFF'}`;
  }
  function toggleSound(){
    soundOn=!soundOn;
    refreshSoundLabel();
  }
  function confirmLeave(){
    toggleGameMenu();
    if(S.isSpectator){ doLeaveSpectate(); return; }
    if(confirm('Are you sure? You will lose the bet and your opponent wins!')){doLeaveGame();}
  }
  function doLeaveGame(){
    S.socket.emit('room:leave',{},()=>{
      S.roomId=null;showChatFab(false);try{ VoiceChat?.leave?.(); }catch(e){}Chat.open=false;
      document.getElementById('chatPanel').classList.remove('open');
      document.getElementById('chatMsgs').innerHTML='';document.getElementById('activityMsgs').innerHTML='';
      Chat.unread=0;updateChatBadge();goLobby();
    });
  }

  /* P5.1 — Victory podium 1->4. Renders the 4 slots from data.stats
     ordered: winner first, then everyone else by ascending finalHand
     (fewer cards left = better position). Highlights 1st with gold
     ring + larger avatar; the local player gets a subtle "ME" pill so
     they can spot themselves at a glance. */
  function _renderWinPodium(data){
    const box = document.getElementById('winPodium');
    if(!box) return;
    const stats = Array.isArray(data.stats) ? data.stats.slice() : [];
    const winnerId = data.winnerId;
    stats.sort((a,b) => {
      if(a.id === winnerId) return -1;
      if(b.id === winnerId) return 1;
      return (a.finalHand || 0) - (b.finalHand || 0);
    });
    const medals = ['🥇','🥈','🥉','4️⃣'];
    // Match friends on id OR shortId (in-game ids can differ from stored ids).
    const myFriendIds = new Set(
      (Friends?.list || []).flatMap(f => [f.id, f.shortId].filter(Boolean).map(String))
    );
    const slots = stats.slice(0, 4).map((p, i) => {
      const isWinner = p.id === winnerId;
      const isMe     = p.id === S.user?.id;
      const img = _isImgAvatar(p.avatar);
      const face = img ? '' : esc(p.avatar || (p.username || '?').charAt(0).toUpperCase());
      const meta = isWinner ? 'WINNER' : `${p.finalHand || 0} cards left`;
      // ── Add-friend button on every NON-me, NON-bot, NON-already-friend slot
      const isBot = !!p.isBot || /^bot/i.test(p.id || '') || /^bot/i.test(p.username || '');
      const alreadyFriend = [p.id, p.shortId].some(x => x && myFriendIds.has(String(x)));
      const canAdd = !isMe && !alreadyFriend && p.id;   // bots show the button too (fake-send) so they blend in
      const addBtn = canAdd
        ? `<button class="podium-addfriend" data-uid="${esc(p.id)}" data-name="${esc(p.username || '')}"
             onclick="doAddFriendFromWin('${esc(p.id)}', '${esc(p.username || '')}', this)"
             title="Send friend request to ${esc(p.username || 'player')}">＋ Friend</button>`
        : (alreadyFriend && !isMe
            ? `<span class="podium-already-friend" title="Already friends">✓ Friend</span>`
            : '<span class="podium-friend-spacer" aria-hidden="true"></span>');   // reserve height so all slots are equal
      // Star score — derived from cards left so the winner reads highest, the
      // tail lowest (matches the polished "VICTORY" podium look).
      const score = Math.max(10, 320 - (p.finalHand || 0) * 28);
      return `<div class="podium-slot ${isWinner?'podium-1st':''} ${isMe?'podium-me':''}" data-pos="${i+1}">
        <div class="podium-avwrap">
          <div class="podium-avatar" style="${img?`background-image:url('${p.avatar}')`:''}">${face}</div>
          <div class="podium-medal podium-medal-${i+1}">${i+1}</div>
        </div>
        <div class="podium-name">${esc(p.username || '—')}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}${isMe?' <span class="podium-me-pill">YOU</span>':''}</div>
        <div class="podium-score"><span class="podium-star">★</span> ${score.toLocaleString()}</div>
        ${addBtn}
      </div>`;
    }).join('');
    box.innerHTML = slots;
  }
  // Send a friend request from the post-match podium. Disables the button
  // and turns it into a "✓ Sent" pill on success so the user can't double-send.
  function doAddFriendFromWin(userId, username, btnEl){
    if(!userId) return;
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = 'Sending…'; }
    // Bot → fake-send (identical UX to a real request) so it blends in.
    if(/^t?bot[_-]/i.test(userId)){
      setTimeout(()=>{ if(btnEl){ btnEl.classList.add('sent'); btnEl.textContent = '✓ Sent'; }
        toast(`Friend request sent to ${username || 'player'}!`, 's'); }, 350);
      return;
    }
    if(typeof apiFetch !== 'function') return;
    apiFetch('/api/friends/request', {
      method:'POST',
      body: JSON.stringify({ userId }),
    }).then(()=>{
      if(btnEl){ btnEl.classList.add('sent'); btnEl.textContent = '✓ Sent'; }
      toast(`Friend request sent to ${username || 'player'}!`, 's');
    }).catch(e=>{
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = '＋ Friend'; }
      toast(e.message || 'Could not send request', 'e');
    });
  }
  window.doAddFriendFromWin = doAddFriendFromWin;

  /* P5.1 — Rewards row. Coins = the actual payout (winner-only; losers
     paid their entry up front and don't get coins back). XP = the BP XP
     the server actually grants (220 for win, 90 for loss — matches the
     value in attachGameListeners). */
  function _renderWinRewards(data, iWon, payout){
    const box = document.getElementById('winRewards');
    if(!box) return;
    const coinsGain = iWon ? payout : 0;
    const xpGain    = iWon ? 220 : 90;

    // Ranked rank-change cell (Phase 1). Only renders when this match was
    // RANKED and the server attached a per-player rankedChanges entry for
    // the current user. During placement (first 5 games) we hide the raw
    // number drops and show a "Placement N/5" counter instead so a single
    // bad seed game doesn't surface a -25 to a brand-new ranked player.
    let rankCell = '';
    const myRanked = (data.rankedChanges || []).find(r => r.playerId === S.user?.id);
    if(myRanked){
      const sign  = myRanked.delta > 0 ? '+' : '';
      const color = myRanked.delta > 0 ? '#5dd75d' : myRanked.delta < 0 ? '#ff6b6b' : '#cfd1d8';
      if(myRanked.isPlacement){
        const n = myRanked.placementGamesPlayed || 0;
        rankCell = `
          <div class="reward-cell">
            <div class="reward-ic">🎯</div>
            <div class="reward-val">${n}/5</div>
            <div class="reward-lbl">Placement</div>
          </div>`;
      } else {
        const tier  = myRanked.rankedTier;
        const label = tier ? `${tier.badge || ''} ${tier.label || tier.name || ''}`.trim() : '';
        rankCell = `
          <div class="reward-cell">
            <div class="reward-ic">🏆</div>
            <div class="reward-val" style="color:${color}">${sign}${myRanked.delta}</div>
            <div class="reward-lbl">${label || 'Rank'}</div>
          </div>`;
      }
    }

    // Coin cell hidden when the payout is zero (loser path) — an empty
    // "+0 🪙" cell carried no information and made the rewards row look
    // padded out with filler.
    const coinsCell = coinsGain > 0
      ? `<div class="reward-cell">
           <div class="reward-ic">🪙</div>
           <div class="reward-val">+${coinsGain.toLocaleString()}</div>
           <div class="reward-lbl">Coins</div>
         </div>`
      : '';

    box.innerHTML = `
      ${coinsCell}
      <div class="reward-cell">
        <div class="reward-ic">⭐</div>
        <div class="reward-val">+${xpGain}</div>
        <div class="reward-lbl">XP</div>
      </div>
      ${rankCell}`;
    // Stagger each reward cell so they pop in one-by-one (a beat after the
    // ranked badge/bar have settled).
    [...box.querySelectorAll('.reward-cell')].forEach((c,i)=>{
      c.classList.add('rw-pop'); c.style.animationDelay = (1.25 + i*0.12)+'s';
    });
  }

  // Ranked drama overlay — fires AFTER _renderWinRewards. Renders three
  // separate moments:
  //   1. Flying RP delta — big number swooping up from where the rewards
  //      grid sits, with green/red color + RP suffix.
  //   2. Promotion / demotion banner — only when the player's tier name
  //      crossed a boundary in this match. Compares (newRank - delta)
  //      against newRank to derive the OLD tier on the client without
  //      needing the server to ship a snapshot.
  //   3. Win-streak fire pill — kicks in at 3+ wins. Lightweight; just
  //      slides in under the rewards row.
  // Progressive boundaries — must mirror server LEAGUES. Each tier wider
  // than the last so promotions feel harder the higher you climb.
  const RANKED_TIER_BOUNDARIES_CLIENT = [
    { min:0,    name:'Bronze',      badge:'🥉', color:'#CD7F32' },
    { min:500,  name:'Silver',      badge:'🥈', color:'#C0C0C0' },
    { min:1300, name:'Gold',        badge:'🥇', color:'#FFD700' },
    { min:2400, name:'Platinum',    badge:'💠', color:'#E5E4E2' },
    { min:3900, name:'Diamond',     badge:'💎', color:'#B9F2FF' },
    { min:6000, name:'Master',      badge:'👑', color:'#9F70FD' },
    { min:9000, name:'Grandmaster', badge:'🏆', color:'#FF6B6B' },
  ];
  function _tierForRP(rp){
    return [...RANKED_TIER_BOUNDARIES_CLIENT].reverse().find(t => (rp||0) >= t.min) || RANKED_TIER_BOUNDARIES_CLIENT[0];
  }
  // Progress (0-100%) of an RP value WITHIN its tier, + the tier + its index.
  function _tierProgress(rp){
    const tiers = RANKED_TIER_BOUNDARIES_CLIENT;
    let idx = 0; for(let i=0;i<tiers.length;i++){ if((rp||0) >= tiers[i].min) idx = i; }
    const tier = tiers[idx];
    const nextMin = (idx < tiers.length-1) ? tiers[idx+1].min : tier.min + 3000;   // GM soft cap
    const span = Math.max(1, nextMin - tier.min);
    const pct = Math.max(0, Math.min(100, Math.round(((rp||0) - tier.min)/span*100)));
    return { tier, idx, pct, nextMin };
  }
  // Self-contained WebAudio fanfare for the ranked result (the global SFX bus
  // is muted). Rising arpeggio on a win, sparkle on promotion, soft fall on a
  // loss. Respects an explicit `soundOn===false` mute if the app sets one.
  let _rankedAC = null;
  function _rankedFanfare(kind){
    try{
      if(typeof window.soundOn !== 'undefined' && window.soundOn === false) return;
      const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
      _rankedAC = _rankedAC || new AC(); const ctx = _rankedAC;
      if(ctx.state === 'suspended'){ try{ ctx.resume(); }catch(e){} }
      const now = ctx.currentTime;
      const notes = kind==='promo' ? [523,659,784,1047,1319]
                  : kind==='win'   ? [523,659,784,1047]
                  :                  [392,330,262];
      notes.forEach((f,i)=>{
        const o=ctx.createOscillator(), g=ctx.createGain();
        o.type = kind==='promo' ? 'sawtooth' : 'triangle'; o.frequency.value=f;
        o.connect(g); g.connect(ctx.destination);
        const t = now + i*0.11;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.10, t+0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.40);
        o.start(t); o.stop(t+0.43);
      });
    }catch(e){}
  }
  // Gold spark burst from the rank badge — fired on a win.
  function _rankedSparks(box){
    try{
      const badge = box.querySelector('.wr-badge-wrap') || box;
      const r = badge.getBoundingClientRect();
      const cx = r.left + r.width/2, cy = r.top + r.height/2;
      const N = 26;
      for(let i=0;i<N;i++){
        const s = document.createElement('div'); s.className='wr-spark';
        s.style.left = cx+'px'; s.style.top = cy+'px';
        document.body.appendChild(s);
        const ang = (Math.PI*2*i/N) + Math.random()*0.5;
        const dist = 70 + Math.random()*130;
        const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist - 30;
        s.animate([
          { transform:'translate(-50%,-50%) scale(1)', opacity:1 },
          { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.15)`, opacity:0 }
        ], { duration: 850 + Math.random()*550, easing:'cubic-bezier(.2,.7,.3,1)', fill:'forwards' });
        setTimeout(()=>s.remove(), 1500);
      }
    }catch(e){}
  }
  // Count a number up to `target` (eased) — used for the big RP delta.
  function _countUpRP(el, target){
    const dur=850, start=performance.now();
    function tick(t){
      const p=Math.min(1,(t-start)/dur), ease=1-Math.pow(1-p,3);
      const v=Math.round(target*ease);
      el.textContent = `${v>0?'+':''}${v} RP`;
      if(p<1) requestAnimationFrame(tick);
      else el.textContent = `${target>0?'+':''}${target} RP`;
    }
    setTimeout(()=>requestAnimationFrame(tick), 900);   // after the pop-in becomes visible
  }
  // Lightweight placeholder shown the instant the win modal opens for a ranked
  // match (game:over with the real deltas lands a beat later → _renderRankedPanel).
  function _rankedSkeleton(){
    const t = _tierForRP((S.user?.rankPoints)||0);
    return `<div class="wr-hero">
      <div class="wr-badge-wrap" style="--tc:${t.color}"><div class="wr-badge-rings"></div><div class="wr-badge">${t.badge}</div></div>
      <div class="wr-tier-name" style="color:${t.color}">${esc((t.name||'').toUpperCase())}</div>
      <div class="wr-prog-sub">Calculating rank…</div>
    </div>`;
  }
  // ── THE premium ranked result panel ── badge + animated RP bar + breakdown
  // + Bronze→GM ladder. Populated from data.rankedChanges (real server math).
  function _renderRankedPanel(data){
    const box = document.getElementById('winRanked');
    const podium = document.getElementById('winPodium');
    if(!box) return;
    const my = (data?.rankedChanges || []).find(r => r.playerId === S.user?.id);
    if(!my) return;                                  // not ranked — keep the podium
    if(podium) podium.style.display = 'none';
    box.style.display = 'flex';
    const _hdr0 = document.getElementById('wrHeader'); if(_hdr0) _hdr0.style.display='none';  // re-shown below for the full panel

    const delta = my.delta || 0;
    const won   = my.placement === 1 || data.winnerId === S.user?.id;
    const sgn = v => (v>0?'+':'') + v;
    const cls = v => v>0?'pos':v<0?'neg':'zero';

    // Placement → hide raw RP, show N/5.
    if(my.isPlacement && (my.placementGamesPlayed||0) < 5){
      box.innerHTML = `<div class="wr-hero">
        <div class="wr-badge-wrap" style="--tc:#9F70FD"><div class="wr-badge-rings"></div><div class="wr-badge">🎯</div></div>
        <div class="wr-tier-name" style="color:#C4B5FD">PLACEMENT ${my.placementGamesPlayed||0}/5</div>
        <div class="wr-prog-sub">${won?'Win logged — ':''}play ${Math.max(0,5-(my.placementGamesPlayed||0))} more to earn your rank</div>
      </div>`;
      _rankedFanfare(won?'win':'lose'); if(won) setTimeout(()=>_rankedSparks(box),500);
      return;
    }

    const newRP = (typeof my.newRank==='number') ? my.newRank : ((S.user?.rankPoints)||0);
    const oldRP = (typeof my.oldRank==='number') ? my.oldRank : (newRP - delta);
    const newProg = _tierProgress(newRP), oldProg = _tierProgress(oldRP);
    const newTier = my.rankedTier
      ? { name:(my.rankedTier.name||my.rankedTier.label||newProg.tier.name), badge:(my.rankedTier.badge||newProg.tier.badge), color:(my.rankedTier.color||newProg.tier.color) }
      : newProg.tier;
    const tc = newTier.color || '#B9F2FF';
    const div = newProg.pct>=75?'I':newProg.pct>=50?'II':newProg.pct>=25?'III':'IV';
    const promoted = newProg.idx > oldProg.idx, demoted = newProg.idx < oldProg.idx;
    const sameTier = newProg.idx === oldProg.idx;
    const oldPct = sameTier ? oldProg.pct : (promoted ? 0 : 100);
    const newPct = newProg.pct;

    // breakdown rows (real server components if present)
    const bd = my.breakdown && typeof my.breakdown.base==='number' ? my.breakdown : null;
    let rows = '';
    if(bd){
      rows += `<div class="wr-row" style="animation-delay:.95s"><span class="wr-row-ic">${won?'🏆':'🎴'}</span><span class="wr-row-lbl">${won?'Match Win':'Match Result'}</span><span class="wr-row-val ${cls(bd.base)}">${sgn(bd.base)}</span></div>`;
      if(bd.skill)  rows += `<div class="wr-row" style="animation-delay:1.05s"><span class="wr-row-ic">⚔️</span><span class="wr-row-lbl">Skill Gap</span><span class="wr-row-val ${cls(bd.skill)}">${sgn(bd.skill)}</span></div>`;
      if(bd.margin) rows += `<div class="wr-row" style="animation-delay:1.15s"><span class="wr-row-ic">🎯</span><span class="wr-row-lbl">Margin</span><span class="wr-row-val ${cls(bd.margin)}">${sgn(bd.margin)}</span></div>`;
    } else {
      rows += `<div class="wr-row" style="animation-delay:.95s"><span class="wr-row-ic">${won?'🏆':'🎴'}</span><span class="wr-row-lbl">${won?'Match Win':'Match Result'}</span><span class="wr-row-val ${cls(delta)}">${sgn(delta)}</span></div>`;
    }
    if((my.streak||0) >= 2 && won){
      rows += `<div class="wr-row wr-row-streak" style="animation-delay:1.25s"><span class="wr-row-ic">🔥</span><span class="wr-row-lbl">${my.streak} Win Streak</span><span class="wr-row-val streak">ON FIRE</span></div>`;
    }
    rows += `<div class="wr-row wr-row-total" style="animation-delay:1.35s"><span class="wr-row-ic"></span><span class="wr-row-lbl">Total</span><span class="wr-row-val ${cls(delta)}">${sgn(delta)} RP</span></div>`;

    // ladder
    const ladder = RANKED_TIER_BOUNDARIES_CLIENT.map(t=>{
      const on = t.name === newTier.name;
      return `<div class="wr-tier ${on?'on':''}" style="--tc:${t.color}"><span class="wr-tier-badge">${t.badge}</span><span class="wr-tier-lbl">${t.name}</span><span class="wr-tier-pct">${on?newPct+'%':'0%'}</span></div>`;
    }).join('');

    const dColor = delta>0?'#7ee787':delta<0?'#ff6b6b':'#cfd1d8';

    // Rewards card — real coin payout + XP + a rank box on a win.
    const payout = (typeof data.payout==='number') ? data.payout : 0;
    const xpGain = won ? 220 : 90;
    const rewardCells =
      (payout>0 ? `<div class="wr-rw" style="animation-delay:1.3s"><div class="wr-rw-ic">🪙</div><div class="wr-rw-val">+${payout.toLocaleString()}</div><div class="wr-rw-lbl">Coins</div></div>` : '')
      + `<div class="wr-rw" style="animation-delay:1.4s"><div class="wr-rw-ic">⭐</div><div class="wr-rw-val">+${xpGain}</div><div class="wr-rw-lbl">XP</div></div>`
      + (won ? `<div class="wr-rw" style="animation-delay:1.5s"><div class="wr-rw-ic">🎁</div><div class="wr-rw-val">x1</div><div class="wr-rw-lbl">Rank Box</div></div>` : '');

    // Match-stats card — REAL ranked stats (this is a card game, so no
    // kills/deaths): placement, win streak, season win-rate, peak RP.
    const wins = S.user?.rankedWins||0, losses = S.user?.rankedLosses||0;
    const wr = (wins+losses)>0 ? Math.round(wins/(wins+losses)*100) : (won?100:0);
    const peak = my.peakRank || newRP;
    const placeLabel = my.placement===1?'1st':my.placement===2?'2nd':my.placement===3?'3rd':`${my.placement||'-'}th`;
    const statCells =
      `<div class="wr-stat"><div class="wr-stat-val" style="color:${won?'#7ee787':'#ff9b9b'}">${placeLabel}</div><div class="wr-stat-lbl">Placement</div></div>`
      + `<div class="wr-stat"><div class="wr-stat-val">${(my.streak||0)}${(my.streak||0)>=2?' 🔥':''}</div><div class="wr-stat-lbl">Win Streak</div></div>`
      + `<div class="wr-stat"><div class="wr-stat-val">${wr}%</div><div class="wr-stat-lbl">Win Rate</div></div>`
      + `<div class="wr-stat"><div class="wr-stat-val" style="color:${tc}">${peak.toLocaleString()}</div><div class="wr-stat-lbl">Peak RP</div></div>`;

    const perfMsg = promoted ? '🎉 Promoted! New tier unlocked — keep the momentum.'
      : demoted ? 'Demoted this time — regroup and climb right back.'
      : won ? (delta>=20 ? 'Dominant win! Keep climbing the ladder. 🚀' : 'Solid win — onward and upward.')
      : 'Tough one. Shake it off and run it back. 💪';

    // Top-left ranked header.
    const hdr = document.getElementById('wrHeader');
    if(hdr){
      hdr.style.display = 'flex';
      hdr.innerHTML = `<div class="wr-header-badge" style="--tc:${tc}">${newTier.badge||'🎖️'}</div>
        <div><div class="wr-header-title">Ranked Match</div><div class="wr-header-sub" style="color:${tc}">${esc(newTier.name||'')} Division</div></div>`;
    }

    // Match-result card (left-column top) — truthful card-game outcome.
    const nPlayers = (data.rankedChanges||[]).length || (data.stats||[]).length || 0;
    const verdict = won
      ? ((my.oppHandPoints||0)>=70 ? 'Dominant Victory' : delta>=20 ? 'Deserved Win' : 'Hard-Fought Win')
      : (Math.abs(delta)<=12 ? 'Narrow Defeat' : 'Tough Defeat');
    const resultMeta = won
      ? (my.oppHandPoints ? `Beat ${my.oppHandPoints} card points` : '')
      : (my.handPoints   ? `Held ${my.handPoints} card points`   : '');
    const resultCard = `
      <div class="wr-card wr-card-result">
        <div class="wr-card-h">⚔️ Match Result</div>
        <div class="wr-result-big" style="color:${won?'#7ee787':'#ff6b6b'}">${won?'VICTORY':'DEFEAT'}</div>
        <div class="wr-result-sub">${placeLabel}${nPlayers?` of ${nPlayers}`:''} · ${verdict}</div>
        ${resultMeta?`<div class="wr-result-meta">${resultMeta}</div>`:''}
      </div>`;

    box.innerHTML = `
      <div class="wr-grid">
        <div class="wr-col">
          ${resultCard}
          <div class="wr-card wr-card-break">
            <div class="wr-card-h">📊 RP Breakdown</div>
            <div class="wr-breakdown">${rows}</div>
          </div>
        </div>
        <div class="wr-hero">
          <div class="wr-badge-wrap" style="--tc:${tc}"><div class="wr-badge-rings"></div><div class="wr-badge">${newTier.badge||'🎖️'}</div></div>
          <div class="wr-tier-name" style="color:${tc}">${esc((newTier.name||'').toUpperCase())} ${div}</div>
          <div class="wr-prog">
            <span class="wr-prog-old">${oldPct}%</span>
            <div class="wr-bar"><div class="wr-bar-fill ${delta<0?'neg':''}"></div><div class="wr-bar-mark" style="left:${oldPct}%"></div></div>
            <span class="wr-prog-new">${newPct}%</span>
          </div>
          <div class="wr-delta" style="color:${dColor}">${sgn(delta)} RP</div>
          <div class="wr-prog-sub">Rank points ${delta>=0?'earned':'lost'}</div>
          <div class="wr-msg">${perfMsg}</div>
        </div>
        <div class="wr-col">
          <div class="wr-card"><div class="wr-card-h">🎁 Rewards</div><div class="wr-rewards">${rewardCells}</div></div>
          <div class="wr-card"><div class="wr-card-h">📈 Match Stats</div><div class="wr-stats">${statCells}</div></div>
        </div>
      </div>
      <div class="wr-ladder">${ladder}</div>
      <div class="wr-tip">💡 Tip: the bigger your winning card-point margin, the more RP you earn.</div>`;

    // animate the bar old→new
    const fill = box.querySelector('.wr-bar-fill');
    if(fill){ fill.style.width = oldPct+'%'; requestAnimationFrame(()=>requestAnimationFrame(()=>{ fill.style.width = newPct+'%'; })); }
    // RP count-up
    const dEl = box.querySelector('.wr-delta'); if(dEl) _countUpRP(dEl, delta);
    // sound + sparks + promotion
    _rankedFanfare(won?'win':'lose');
    if(won) setTimeout(()=>_rankedSparks(box), 500);
    if(promoted) setTimeout(()=>_rankedFanfare('promo'), 1750);
  }
  // ── RANK EMBLEM ── a real layered insignia (wings + shield + faceted gem)
  // drawn as inline SVG and tinted from the tier colour — replaces the flat
  // emoji medals so every rank reads like a proper competitive-game crest.
  function _shadeHex(hex, pct){
    const h = String(hex||'#8899aa').replace('#','');
    const full = h.length===3 ? h.split('').map(ch=>ch+ch).join('') : h.padEnd(6,'8');
    const n = parseInt(full.slice(0,6),16);
    let r=(n>>16)&255, g=(n>>8)&255, b=n&255;
    const t = pct<0?0:255, p=Math.min(1,Math.abs(pct));
    r=Math.round(r+(t-r)*p); g=Math.round(g+(t-g)*p); b=Math.round(b+(t-b)*p);
    return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  let _emblemUid = 0;
  function _rankEmblemSVG(color){
    const c = color || '#B9F2FF';
    const lite=_shadeHex(c,.5), mid=_shadeHex(c,-.12), dark=_shadeHex(c,-.45), deep=_shadeHex(c,-.7);
    const u = 're' + (++_emblemUid);
    return `<svg viewBox="0 0 120 120" style="width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${lite}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>
        </linearGradient>
        <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${lite}"/><stop offset="1" stop-color="${c}"/>
        </linearGradient>
      </defs>
      <path d="M25 34 L4 21 L20 57 L10 51 L29 77 Z" fill="${dark}" opacity=".92"/>
      <path d="M95 34 L116 21 L100 57 L110 51 L91 77 Z" fill="${dark}" opacity=".92"/>
      <path d="M60 6 L98 24 V62 C98 87 82 104 60 114 C38 104 22 87 22 62 V24 Z" fill="url(#${u}s)" stroke="${lite}" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M60 16 L89 30 V61 C89 81 76 95 60 103 C44 95 31 81 31 61 V30 Z" fill="${deep}" opacity=".85"/>
      <polygon points="60,33 83,60 60,91 37,60" fill="url(#${u}g)" stroke="${lite}" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="60,33 83,60 60,60" fill="${lite}" opacity=".5"/>
      <polygon points="60,60 60,91 37,60" fill="${deep}" opacity=".45"/>
      <circle cx="60" cy="20" r="2.6" fill="#fff" opacity=".95"/>
      <circle cx="88" cy="44" r="1.8" fill="#fff" opacity=".75"/>
      <circle cx="33" cy="49" r="1.6" fill="#fff" opacity=".65"/>
    </svg>`;
  }
  window._rankEmblemSVG = _rankEmblemSVG;
  // The REAL rank artwork (client/ranks/*.png — same images used on the
  // profile + rank road). The SVG crest above stays only as a fallback for
  // unknown tier names.
  const _RANK_IMG_KEYS = new Set(['bronze','silver','gold','platinum','diamond','master','grandmaster']);
  function _rankEmblemHTML(tierName, color){
    const key = String(tierName||'').toLowerCase().replace(/\s+/g,'');
    if(_RANK_IMG_KEYS.has(key)){
      return `<img src="/ranks/${key}.png" alt="${esc(tierName||'')}" draggable="false"
        style="width:100%;height:100%;object-fit:contain;display:block">`;
    }
    return _rankEmblemSVG(color);
  }
  window._rankEmblemHTML = _rankEmblemHTML;

  // Expose the ranked-result helpers so the RONDA module (RANKED is RONDA, a
  // 2v2 game to 41) can render the SAME premium result screen with its own data.
  window._rankedTierProgress = _tierProgress;
  window._rankedTiers        = RANKED_TIER_BOUNDARIES_CLIENT;
  window._rankedTierForRP    = _tierForRP;
  window._rankedFanfare      = _rankedFanfare;
  window._rankedSparks       = _rankedSparks;
  window._rankedCountUp      = _countUpRP;
  // Dev preview — run `_previewRankedResult()` (or `_previewRankedResult(false)`
  // for a loss / `'promo'` for a promotion) in the console to SEE the ranked
  // result screen with sample data, without playing a full ranked match.
  window._previewRankedResult = function(mode){
    const me = S.user?.id || 'me';
    const won = mode !== false && mode !== 'loss';
    const promo = mode === 'promo';
    const newRP = promo ? 3960 : won ? 4200 : 3760;       // Diamond band (3900+)
    const delta = promo ? 95 : won ? 28 : -22;
    const data = {
      winnerId: won ? me : 'rival', roomType:'RANKED', payout: won?150:0,
      score:'41-37', username: won ? (S.user?.username||'You') : 'Rival',
      rankedChanges: [{
        playerId: me, placement: won?1:3, delta, newRank:newRP, oldRank:newRP-delta,
        peakRank:newRP+220, isPlacement:false, rankedTier:_tierForRP(newRP), streak: won?3:0,
        oppHandPoints: won?52:14, handPoints: won?0:34,
        breakdown: won ? {base:Math.round(delta*.72), skill:Math.round(delta*.16), margin:delta-Math.round(delta*.72)-Math.round(delta*.16)}
                       : {base:Math.round(delta*.8), skill:Math.round(delta*.1), margin:delta-Math.round(delta*.8)-Math.round(delta*.1)},
      }],
    };
    showWin(data);
    setTimeout(()=>window._showRankedDramaFromGameOver(data), 280);
  };
  // Exposed so 08-socket.js can fire it from `game:over` — that's the
  // event that carries data.rankedChanges. `game:player_won` (which kicks
  // off showWin) fires a beat EARLIER and has no rankedChanges yet, so
  // we wire the drama to the later event and run it once data is ready.
  function _showRankedDrama(data){
    const my = (data.rankedChanges || []).find(r => r.playerId === S.user?.id);
    if(!my) return;

    // 1) Flying RP delta — defer 600ms so the win modal has settled.
    setTimeout(()=>{
      const pop = document.createElement('div');
      const sign = my.delta > 0 ? '+' : '';
      const color = my.delta > 0 ? '#5dd75d' : my.delta < 0 ? '#ff6b6b' : '#cfd1d8';
      pop.textContent = `${sign}${my.delta} RP`;
      pop.style.cssText = `
        position:fixed; top:50%; left:50%;
        transform:translate(-50%, -50%) scale(.3);
        font-family:'Bangers',sans-serif; font-size:80px; letter-spacing:4px;
        color:${color}; text-shadow:0 4px 18px rgba(0,0,0,.7), 0 0 40px ${color};
        z-index:10000; pointer-events:none;
        opacity:0;
        transition:transform 1s cubic-bezier(.16,1,.3,1), opacity .9s ease;
      `;
      document.body.appendChild(pop);
      requestAnimationFrame(()=>{
        pop.style.opacity = '1';
        pop.style.transform = 'translate(-50%, -160%) scale(1)';
      });
      setTimeout(()=>{
        pop.style.opacity = '0';
        pop.style.transform = 'translate(-50%, -240%) scale(.7)';
      }, 1500);
      setTimeout(()=>pop.remove(), 2500);
    }, 600);

    // 2) Promotion / demotion banner — only past placement, and only when
    //    the tier name actually changed (a 1100 → 1150 gain stays Silver,
    //    no banner). Grandmaster bumps still fire as "promoted" (rare).
    if(!my.isPlacement){
      const oldRP   = my.newRank - my.delta;
      const oldTier = _tierForRP(oldRP);
      const newTier = my.rankedTier || _tierForRP(my.newRank);
      if(oldTier.name !== newTier.name){
        const promoted = my.newRank > oldRP;
        setTimeout(()=>_spawnTierBanner(promoted, oldTier, newTier), 1800);
      }
    } else if(my.placementGamesPlayed >= 5){
      // Placement just COMPLETED — show their assigned tier with a banner.
      const newTier = my.rankedTier || _tierForRP(my.newRank);
      setTimeout(()=>_spawnTierBanner(true, null, newTier, true), 1800);
    }

    // 3) Streak pill — fire emoji on 3+ win streak. Pulled from S.user
    //    which the ranked:rating_update handler already updated.
    const streak = S.user?.winStreak || 0;
    if(my.placement === 1 && streak >= 3){
      setTimeout(()=>_spawnStreakPill(streak), 2400);
    }

    // 4) Rank Progress Cinematic — the showcase moment. Animated bar that
    //    fills (win) or drains (loss) from the OLD RP to the NEW RP, with
    //    a counter ticking in sync, sparkle particles trailing along the
    //    fill edge, and the previous/next tier badges flanking the bar.
    //    Deferred 2.8s so the flying RP delta + promotion banner read first.
    setTimeout(()=>_spawnRankProgress(my), 2800);
  }
  function _spawnTierBanner(promoted, oldTier, newTier, isPlacementReveal){
    const banner = document.createElement('div');
    const label = isPlacementReveal
      ? `PLACEMENT COMPLETE`
      : promoted ? 'PROMOTED' : 'DEMOTED';
    const subline = isPlacementReveal
      ? `Welcome to ${newTier.badge} ${newTier.label || newTier.name}`
      : `${oldTier.badge} ${oldTier.name} → ${newTier.badge} ${newTier.name}`;
    const accentColor = promoted ? '#FBBF24' : '#ff6b6b';
    banner.style.cssText = `
      position:fixed; left:50%; top:50%;
      transform:translate(-50%, -50%) scale(.6);
      padding:22px 38px;
      background:linear-gradient(180deg, rgba(20,20,30,.95), rgba(8,8,18,.98));
      border:2px solid ${accentColor};
      border-radius:16px;
      box-shadow:0 20px 60px rgba(0,0,0,.7), 0 0 80px ${accentColor}99;
      text-align:center;
      z-index:10001; pointer-events:none;
      opacity:0;
      transition:opacity .5s ease, transform .55s cubic-bezier(.16,1,.3,1);
    `;
    banner.innerHTML = `
      <div style="font-family:'Bangers',sans-serif;font-size:14px;letter-spacing:5px;color:${accentColor};margin-bottom:6px">
        ${promoted ? '⭐' : '⚠️'} ${label} ${promoted ? '⭐' : ''}
      </div>
      <div style="font-size:64px;line-height:1;margin:8px 0;text-shadow:0 0 30px ${newTier.color}cc">${newTier.badge}</div>
      <div style="font-family:'Bangers',sans-serif;font-size:24px;letter-spacing:3px;color:${newTier.color}">${newTier.label || newTier.name}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:6px;letter-spacing:2px">${subline}</div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(()=>{
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%, -50%) scale(1)';
    });
    if(typeof SFX !== 'undefined') try { SFX.play(promoted ? 'win' : 'error'); } catch(e){}
    setTimeout(()=>{
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -50%) scale(.8)';
    }, 3000);
    setTimeout(()=>banner.remove(), 3700);
  }
  function _spawnStreakPill(streak){
    const pill = document.createElement('div');
    pill.style.cssText = `
      position:fixed; left:50%; top:78%;
      transform:translate(-50%, 30px);
      padding:10px 22px;
      background:linear-gradient(135deg, #FF6B6B, #D97706);
      border-radius:99px;
      box-shadow:0 8px 30px rgba(255,107,107,.6), 0 0 40px rgba(251,191,36,.5);
      color:#fff; font-family:'Bangers',sans-serif; font-size:18px; letter-spacing:3px;
      z-index:10000; pointer-events:none;
      opacity:0;
      transition:opacity .4s ease, transform .55s cubic-bezier(.16,1,.3,1);
    `;
    pill.textContent = `🔥 ${streak}-WIN STREAK 🔥`;
    document.body.appendChild(pill);
    requestAnimationFrame(()=>{
      pill.style.opacity = '1';
      pill.style.transform = 'translate(-50%, 0)';
    });
    setTimeout(()=>{
      pill.style.opacity = '0';
      pill.style.transform = 'translate(-50%, -10px)';
    }, 2200);
    setTimeout(()=>pill.remove(), 2800);
  }

  // ═══════════════════════════════════════════════════════════════════
  // RANK PROGRESS CINEMATIC
  // The signature post-match moment. A full-width card slides up from
  // the bottom, framed by the player's previous and next tier badges,
  // with a metallic progress bar that fills (win) or drains (loss) at
  // the same pace as a digit-rolling counter. Sparkle particles trail
  // the fill edge so the eye reads the movement, not just the numbers.
  //
  // Sequence (≈6.2s total):
  //   t=0     : card slides up
  //   t=0.6   : counter + bar start animating from oldRP → newRP
  //   t=2.4   : counter holds at newRP, sparkles wind down
  //   t=5.2   : card slides back down
  //   t=6.2   : DOM cleanup
  //
  // Win uses gold/green ink; loss uses red/grey ink. Tier-boundary
  // crossings are visible (bar fills to 100%, flashes white, resets to
  // 0 % of the new tier, and keeps filling) so the player feels the
  // promotion in the same animation.
  function _spawnRankProgress(my){
    _ensureRankProgressStyles();
    const old = document.getElementById('rankProgressCard');
    if(old) old.remove();

    const won     = my.delta > 0;
    const oldRP   = my.newRank - my.delta;
    const newRP   = my.newRank;
    const oldTier = _tierForRP(oldRP);
    const newTier = my.rankedTier || _tierForRP(newRP);
    const nextTier = RANKED_TIER_BOUNDARIES_CLIENT.find(t => t.min > newRP) || null;
    // LEFT flank = the tier the player is in NOW (after this match), so
    // the visual reads "you are HERE — heading THERE". Using the old
    // tier on the left after a promotion looked confusing because the
    // counter (newRP) had already crossed into a tier that wasn't
    // displayed on either flank — Silver → Platinum with Gold missing.
    // RIGHT flank = next tier up. At Grandmaster there is no next, so
    // we collapse it to the current tier (it just gets shown on both
    // sides, which reads as "top tier reached").
    const leftTier  = newTier;
    const rightTier = nextTier || newTier;
    const inkColor = won ? '#5dd75d' : my.delta < 0 ? '#ff6b6b' : '#cfd1d8';
    const barColor = newTier.color;

    // Within-tier percentage. For tier crossings we still show ONE bar —
    // the visual run from oldRP to newRP scales across both segments, but
    // we keep the math simple: percent within NEW tier.
    const nextMin  = nextTier ? nextTier.min : newTier.min + 1000;
    const span     = Math.max(1, nextMin - newTier.min);
    const newPct   = Math.max(0, Math.min(100, ((newRP - newTier.min) / span) * 100));
    // For the start of the animation, anchor at the old position WITHIN
    // the new tier — if old tier was lower, start near 0; if higher
    // (demotion-cross), start near 100. Approximation; the counter is
    // the source of truth, the bar is just flavour.
    let startPct;
    if(oldTier.name === newTier.name){
      startPct = Math.max(0, Math.min(100, ((oldRP - newTier.min) / span) * 100));
    } else if(won){
      startPct = 0;                         // crossed up — show empty bar of new tier
    } else {
      startPct = 100;                       // crossed down — show full bar of new tier
    }
    const remaining = nextTier ? Math.max(0, nextTier.min - newRP) : 0;

    const card = document.createElement('div');
    card.id = 'rankProgressCard';
    card.className = `rp-card ${won ? 'rp-win' : 'rp-loss'}`;
    card.style.setProperty('--tier-c', barColor);
    card.style.setProperty('--ink-c', inkColor);
    // Math breakdown line — turns the RP delta into transparent UNO math
    // so the player reads "I lost -41 RP BECAUSE I had 73 points of
    // cards left" instead of feeling cheated. Server attaches the raw
    // numbers in my.handPoints / my.oppHandPoints.
    const myPts  = my.handPoints || 0;
    const oppPts = my.oppHandPoints || 0;
    const finalHand = my.finalHand || 0;
    let mathLine = '';
    if(won){
      mathLine = `🎯 Beat <b>${oppPts}</b> pts of cards on the table`;
    } else if(myPts > 0){
      mathLine = `🃏 Held <b>${myPts}</b> pts of cards (${finalHand} card${finalHand===1?'':'s'} left)`;
    } else if(finalHand > 0){
      mathLine = `🃏 Held ${finalHand} card${finalHand===1?'':'s'} at game end`;
    }

    card.innerHTML = `
      <div class="rp-eyebrow">${won ? '⬆ RANK PROGRESS' : '⬇ RANK ADJUSTMENT'}</div>
      <div class="rp-row">
        <div class="rp-tier rp-tier-l" title="${esc(leftTier.label || leftTier.name)}">
          <div class="rp-tier-badge">${leftTier.badge}</div>
          <div class="rp-tier-label">${leftTier.name}</div>
        </div>
        <div class="rp-track-wrap">
          <div class="rp-counter">
            <span class="rp-counter-num" id="rpCounterNum">${oldRP}</span>
            <span class="rp-counter-rp">RP</span>
          </div>
          <div class="rp-track">
            <div class="rp-fill" id="rpFill" style="width:${startPct}%"></div>
            <div class="rp-shine"></div>
            <div class="rp-sparkles" id="rpSparkles"></div>
          </div>
          <div class="rp-delta" style="color:${inkColor}">${won?'+':''}${my.delta} RP this match</div>
          ${mathLine ? `<div class="rp-math">${mathLine}</div>` : ''}
        </div>
        <div class="rp-tier rp-tier-r" title="${esc(rightTier.label || rightTier.name)}">
          <div class="rp-tier-badge">${rightTier.badge}</div>
          <div class="rp-tier-label">${rightTier.name}</div>
        </div>
      </div>
      <div class="rp-foot">${remaining > 0
        ? `⭐ <b>${remaining.toLocaleString()} RP</b> to ${rightTier.badge} ${rightTier.name}`
        : `⭐ ${won ? 'TOP TIER REACHED — keep stacking RP!' : 'Keep grinding to reclaim your rank'}`}</div>
    `;
    document.body.appendChild(card);
    requestAnimationFrame(()=>card.classList.add('rp-in'));

    // Counter + bar animation — kicks off 600ms in, runs for 1.8s.
    const counterEl = document.getElementById('rpCounterNum');
    const fillEl    = document.getElementById('rpFill');
    const sparkEl   = document.getElementById('rpSparkles');
    const animMs    = 1800;
    let raf = null;
    let startTs = 0;
    let sparkleTimer = null;

    setTimeout(()=>{
      const tick = (ts)=>{
        if(!startTs) startTs = ts;
        const p = Math.min(1, (ts - startTs) / animMs);
        const ease = 1 - Math.pow(1 - p, 3);                 // easeOutCubic
        const cur  = Math.round(oldRP + (newRP - oldRP) * ease);
        const curPct = startPct + (newPct - startPct) * ease;
        if(counterEl) counterEl.textContent = cur;
        if(fillEl)    fillEl.style.width = curPct + '%';
        if(p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      // Sparkle particles spawning along the bar's fill edge while it moves.
      // Each particle is a tiny div that floats up + fades.
      sparkleTimer = setInterval(()=>{
        if(!sparkEl) return;
        const w = fillEl?.getBoundingClientRect().width || 0;
        const trackW = sparkEl.getBoundingClientRect().width || 0;
        if(!trackW) return;
        const edgeX = Math.max(2, Math.min(trackW - 4, w));
        const s = document.createElement('span');
        s.className = 'rp-sparkle';
        s.style.left = edgeX + 'px';
        s.style.background = inkColor;
        s.style.boxShadow = `0 0 8px ${inkColor}`;
        sparkEl.appendChild(s);
        setTimeout(()=>s.remove(), 900);
      }, 80);
    }, 600);

    setTimeout(()=>{
      if(sparkleTimer) clearInterval(sparkleTimer);
    }, 2400);

    // STAYS until the player leaves the win screen. No auto-dismiss
    // timer — the card lives on the page until Play Again / Back to
    // Lobby / X close tears down the win modal, at which point
    // window._dismissRankProgress() is called.
    card.style.pointerEvents = 'auto';
    card.style.cursor = 'pointer';
    card.title = 'Tap to dismiss';
    let dismissed = false;
    const dismiss = () => {
      if(dismissed) return;
      dismissed = true;
      card.classList.add('rp-out');
      setTimeout(()=>{
        if(raf) cancelAnimationFrame(raf);
        card.remove();
      }, 1000);
    };
    card.addEventListener('click', dismiss);
    // Expose a one-shot dismiss handle so lobby / play-again / close paths
    // can collapse the card cleanly when the player moves on.
    window._dismissRankProgress = dismiss;

    if(typeof SFX !== 'undefined'){
      try { SFX.play(won ? 'win' : 'click'); } catch(e){}
    }
  }

  function _ensureRankProgressStyles(){
    if(document.getElementById('rankProgressStyles')) return;
    const s = document.createElement('style');
    s.id = 'rankProgressStyles';
    s.textContent = `
      .rp-card{
        position:fixed; left:50%; bottom:24px;
        width:min(540px, 94vw);
        padding:16px 18px 14px;
        border-radius:18px; pointer-events:none;
        background:
          linear-gradient(180deg, rgba(20,26,40,.97) 0%, rgba(8,12,22,.99) 100%),
          radial-gradient(120% 60% at 50% 0%, var(--tier-c) 0%, transparent 60%);
        background-blend-mode:screen;
        border:1px solid rgba(255,255,255,.08);
        box-shadow:
          0 20px 60px rgba(0,0,0,.75),
          0 0 50px var(--tier-c, #FBBF24) 55,
          inset 0 1px 0 rgba(255,255,255,.06);
        color:#fff; font-family:'Outfit',sans-serif;
        transform:translate(-50%, calc(100% + 40px));
        opacity:0;
        transition:transform .55s cubic-bezier(.18,.89,.32,1.07), opacity .35s ease;
        z-index:10001;
        overflow:hidden;
      }
      .rp-card::before{
        content:""; position:absolute; left:24px; right:24px; top:0; height:2px;
        background:linear-gradient(90deg, transparent, var(--tier-c), transparent);
        filter:drop-shadow(0 0 6px var(--tier-c));
      }
      .rp-card.rp-in{ transform:translate(-50%, 0); opacity:1; }
      .rp-card.rp-out{ transform:translate(-50%, calc(100% + 40px)); opacity:0; }
      .rp-eyebrow{
        text-align:center; font-size:10px; font-weight:900; letter-spacing:3px;
        color:var(--ink-c); text-transform:uppercase;
        text-shadow:0 1px 3px rgba(0,0,0,.6);
        margin-bottom:10px;
      }
      .rp-row{
        display:flex; align-items:center; gap:14px;
      }
      .rp-tier{
        display:flex; flex-direction:column; align-items:center; gap:2px;
        min-width:60px; opacity:.85;
      }
      .rp-tier-badge{
        font-size:34px; line-height:1;
        filter:drop-shadow(0 4px 10px rgba(0,0,0,.55));
        animation:rpBob 2.5s ease-in-out infinite;
      }
      .rp-tier-r .rp-tier-badge{ animation-delay:.4s; }
      @keyframes rpBob{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-3px) } }
      .rp-tier-label{
        font-size:9px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.55); text-transform:uppercase;
      }
      .rp-track-wrap{ flex:1; min-width:0; }
      .rp-counter{
        text-align:center; line-height:1;
        margin-bottom:6px;
      }
      .rp-counter-num{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:30px; letter-spacing:2px;
        background:linear-gradient(180deg, #FFFBEB, var(--tier-c) 60%, var(--ink-c));
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));
        vertical-align:middle;
      }
      .rp-counter-rp{
        margin-left:4px; font-size:11px; font-weight:900; letter-spacing:2px;
        color:rgba(255,255,255,.6); vertical-align:middle;
      }
      .rp-track{
        position:relative;
        height:14px; border-radius:99px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.08);
        overflow:hidden;
        box-shadow:inset 0 2px 4px rgba(0,0,0,.4);
      }
      .rp-fill{
        position:absolute; left:0; top:0; bottom:0;
        background:linear-gradient(90deg, var(--tier-c), var(--ink-c));
        border-radius:99px;
        transition:width .05s linear;
        box-shadow:0 0 14px var(--ink-c);
      }
      .rp-shine{
        position:absolute; top:0; bottom:0; width:30%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
        animation:rpShine 1.8s ease-out infinite;
        pointer-events:none;
      }
      @keyframes rpShine{
        0%   { transform:translateX(-100%); }
        60%  { transform:translateX(400%); }
        100% { transform:translateX(400%); }
      }
      .rp-sparkles{
        position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;
      }
      .rp-sparkle{
        position:absolute; top:50%; width:5px; height:5px; border-radius:50%;
        transform:translate(-50%, -50%) scale(.6);
        opacity:.95;
        animation:rpSparkle .9s cubic-bezier(.18,.89,.32,1.07) both;
        pointer-events:none;
      }
      @keyframes rpSparkle{
        0%   { transform:translate(-50%, -50%) scale(.4);  opacity:.95; }
        100% { transform:translate(-50%, calc(-50% - 24px)) scale(.1); opacity:0; }
      }
      .rp-delta{
        margin-top:6px; text-align:center;
        font-size:11px; font-weight:800; letter-spacing:1.2px;
        text-shadow:0 1px 2px rgba(0,0,0,.5);
      }
      .rp-math{
        margin-top:3px; text-align:center;
        font-size:10px; letter-spacing:.4px;
        color:rgba(255,255,255,.55);
      }
      .rp-math b{
        color:#FDE68A; font-family:'Bangers',sans-serif; font-size:12px; letter-spacing:1px;
        margin:0 1px;
      }
      .rp-foot{
        margin-top:10px; padding-top:10px;
        border-top:1px dashed rgba(255,255,255,.08);
        text-align:center; font-size:11px; letter-spacing:.8px;
        color:rgba(255,255,255,.7);
      }
      .rp-foot b{ color:var(--tier-c); font-family:'Bangers',sans-serif; font-size:14px; letter-spacing:1.5px; }

      @media (max-width:520px){
        .rp-card{ width:96vw; padding:14px 14px 12px; bottom:14px; }
        .rp-tier{ min-width:48px; }
        .rp-tier-badge{ font-size:28px; }
        .rp-counter-num{ font-size:26px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* P5.1 — Play Again: closes the win modal, then routes the player back
     into the same room TYPE they just played (Classic/Fun/Ranked/Chill).
     Falls back to QUICK_MATCH if the type is unknown (legacy room, private,
     or league match). Reuses the existing quickJoin pipeline from 12-lobby.js
     so the cinematic radar transition kicks in for free. */
  function winPlayAgain(){
    const type = S.lastMatchType || 'QUICK_MATCH';
    _cancelWinAutoback();
    document.getElementById('winov')?.classList.remove('show','winov-anim','winov-ranked');
    if(typeof window._dismissRankProgress === 'function') window._dismissRankProgress();
    if(typeof quickJoin === 'function'){
      quickJoin(type);
    } else if(typeof backLobby === 'function'){
      backLobby();
    }
  }

  // Share match result via native Web Share API (mobile + many desktops);
  // falls back to copying a textual summary to clipboard. Uses S.lastWinData
  // populated by showWin() so the summary reflects the actual outcome.
  async function doShareWin(){
    const d = S.lastWinData || {};
    const iWon = d.winnerId === S.user?.id;
    const winnerName = (d.players || []).find(p => p.id === d.winnerId)?.username
                       || d.username || 'Someone';
    const payout = (typeof d.payout === 'number') ? d.payout : 0;
    const link = `${location.origin}/`;
    const headline = d.winnerAbandoned
      ? `⚖️ Prize split — ${winnerName} abandoned!`
      : iWon
        ? `🏆 Just won ${payout > 0 ? `${payout.toLocaleString()} 🪙 in ` : ''}RONDAONE!`
        : `🃏 ${winnerName} won this round in RONDAONE — rematch?`;
    const text = `${headline}\nPlay with me at ${link}`;
    if(navigator.share){
      try{
        await navigator.share({ title:'RONDAONE', text, url:link });
        return;
      }catch(e){ if(e?.name === 'AbortError') return; /* user cancelled */ }
    }
    // Fallback: copy to clipboard
    try{
      await navigator.clipboard.writeText(text);
      toast('Result copied — share it!', 's');
    }catch(e){
      toast('Share not available', 'i');
    }
  }
  window.doShareWin = doShareWin;

  // Auto-return-to-lobby countdown. Player gets ~30s to review the
  // podium / rewards before they're nudged back. Any click on the
  // pill cancels the timer; any of the action buttons also cancels.
  let _winAutobackTimer = null;
  let _winAutobackSeconds = 0;
  function _startWinAutoback(){
    _cancelWinAutoback();
    const pill = document.getElementById('winAutoback');
    const sEl  = document.getElementById('winAutobackS');
    if(!pill || !sEl) return;
    pill.classList.remove('cancelled');
    pill.style.display = '';
    pill.textContent = '';
    pill.innerHTML = 'Returning to lobby in <b id="winAutobackS">30</b>s · tap to cancel';
    pill.onclick = _cancelWinAutoback;
    _winAutobackSeconds = 30;
    document.getElementById('winAutobackS').textContent = '30';
    _winAutobackTimer = setInterval(()=>{
      _winAutobackSeconds--;
      const el = document.getElementById('winAutobackS');
      if(el) el.textContent = String(_winAutobackSeconds);
      if(_winAutobackSeconds <= 0){
        _cancelWinAutoback();
        if(typeof backLobby === 'function') backLobby();
      }
    }, 1000);
  }
  function _cancelWinAutoback(){
    if(_winAutobackTimer){ clearInterval(_winAutobackTimer); _winAutobackTimer = null; }
    const pill = document.getElementById('winAutoback');
    if(pill){
      pill.classList.add('cancelled');
      pill.textContent = 'Auto-return cancelled';
    }
  }

  /* ═══ WIN ═══ */
  function showWin(data){
    // 2v2 — BOTH partners win. `winnerIds` (from the engine) lists the whole
    // winning team, so a teammate who didn't go out still sees VICTORY.
    const iWon=data.winnerId===S.user?.id || (Array.isArray(data.winnerIds) && data.winnerIds.includes(S.user?.id));
    if(data.eloChange) showEloPopup(data.eloChange, iWon);
    const bet=data.bet||0;
    const forfeit=data.forfeit||false;
    // P4 — coin updates now arrive via the dedicated match:debited /
    // match:payout socket events (server is authoritative). showWin no
    // longer mirrors S.user.coins locally; reading data.payout / data.pot
    // / data.houseCut here is for DISPLAY only.
    // P5.1 — remember the room type the match was played in so the
    // "Play Again" button can route back into the same pool.
    if(data.roomType) S.lastMatchType = data.roomType;
    const wt=document.getElementById('wtitle');
    // P4-NEW.1a polish — when the technical "winner" was abandoned (DC'd
    // past grace), they forfeit the pot. Everyone else who didn't abandon
    // gets a share. The on-screen copy needs to reflect that, not the
    // misleading "Winner won!" framing.
    const winnerAbandoned = !!data.winnerAbandoned;
    if(winnerAbandoned){
      wt.textContent = '⚖️ PRIZE SPLIT';
      wt.className   = 'wtitle l';
    } else {
      wt.textContent = iWon ? '🏆 VICTORY!' : '💀 GAME OVER';
      wt.className   = `wtitle ${iWon?'w':'l'}`;
    }
    // Eyebrow above the title — mirrors the new design-system pattern.
    const ebEl = document.getElementById('weyebrow');
    if(ebEl){
      ebEl.className = 'win-eyebrow';
      // Eyebrow text removed per user request — the big VICTORY/DEFEAT
      // title already conveys the result.
      ebEl.textContent = '';
    }
    // Remember the data so doShareWin() can build the share text from it.
    S.lastWinData = data;
    const wdetEl = document.getElementById('wdet');
    if(winnerAbandoned){
      wdetEl.textContent = `${data.username || 'Winner'} abandoned — pot split with remaining players`;
    } else if(iWon){
      wdetEl.textContent = forfeit ? `${data.quitter} left the game!` : `Score: ${data.score}`;
    } else {
      wdetEl.textContent = `${data.username} won!`;
    }
    // Display the actual payout for the winner; losers paid their entry at
    // match-start so their game-end "delta" is 0 (the loss already happened).
    const payout = (typeof data.payout === 'number') ? data.payout : 0;
    const finalCoins = iWon ? payout : 0;
    // Big coin-headline only when there's a real positive payout. A
    // zero or negative "+0 🪙" line is visual filler and reads as a
    // mistake — better hidden entirely on the loser path.
    const coinsEl=document.getElementById('wcoins');
    if(finalCoins > 0){
      coinsEl.style.display = '';
      coinsEl.textContent = `+${finalCoins.toLocaleString()} 🪙`;
    } else {
      coinsEl.style.display = 'none';
      coinsEl.textContent = '';
    }
    // P5.1 — render the 4-slot podium + rewards row.
    _renderWinPodium(data);
    _renderWinRewards(data, iWon, payout);
    // RANKED match → swap the podium for the premium ranked panel. Show a
    // skeleton now; the full animated panel renders when game:over lands with
    // the real RP deltas. Casual matches keep the podium.
    const _rankedBox = document.getElementById('winRanked');
    const _podiumBox = document.getElementById('winPodium');
    const _ovEl = document.getElementById('winov');
    const _rewRow = document.getElementById('winRewards');
    const _betRow = document.getElementById('wbet');
    if(data.roomType === 'RANKED' && _rankedBox){
      _ovEl?.classList.add('winov-ranked');               // widen the overlay
      if(_podiumBox) _podiumBox.style.display = 'none';
      if(_rewRow) _rewRow.style.display = 'none';          // ranked panel has its own rewards card
      if(_betRow) _betRow.style.display = 'none';
      _rankedBox.style.display = 'flex';
      _rankedBox.innerHTML = (typeof _rankedSkeleton==='function') ? _rankedSkeleton() : '';
    } else if(_rankedBox){
      _ovEl?.classList.remove('winov-ranked');
      _rankedBox.style.display = 'none';
      _rankedBox.innerHTML = '';
      const _hdr = document.getElementById('wrHeader'); if(_hdr) _hdr.style.display = 'none';
      if(_podiumBox) _podiumBox.style.display = '';
      if(_rewRow) _rewRow.style.display = '';
      if(_betRow) _betRow.style.display = '';
    }
    // Ranked drama runs from game:over (08-socket.js), not from here —
    // game:player_won arrives BEFORE the server has computed rankedChanges,
    // so calling the drama at this point would silently no-op every time.
    // The window-exposed _showRankedDramaFromGameOver handles it once
    // the proper payload lands. We DO save the win data here so that
    // callback can merge it back into the rewards row if needed.
    S.lastWinData = data;
    // Pot summary line replaces the old "Bet was X per player" hint so the
    // player can see the math: total pot, house cut, what they got.
    const wbetEl = document.getElementById('wbet');
    if(wbetEl){
      if(data.pot){
        wbetEl.textContent = iWon
          ? `Prize 🪙${data.pot.toLocaleString()} − 🪙${(data.houseCut||0).toLocaleString()} fee = 🪙${payout.toLocaleString()}`
          : `Prize was 🪙${data.pot.toLocaleString()} (entry 🪙${bet} per player)`;
      } else {
        wbetEl.textContent = bet ? `Entry was 🪙${bet} per player` : '';
      }
    }
    // Man of the Match card removed per user request — always force
    // the badge hidden so the win actions sit right under the rewards.
    const mvpBox=document.getElementById('mvpBadge');
    if(mvpBox) mvpBox.style.display='none';
    // Crowd Favorite card removed per user request — always hidden.
    const cfBox=document.getElementById('crowdFav');
    if(cfBox) cfBox.style.display='none';
    const rays=document.querySelector('.win-rays'), spot=document.querySelector('.win-spot');
    if(rays) rays.style.display=iWon?'':'none';
    if(spot) spot.style.display=iWon?'':'none';
    document.getElementById('winov').classList.add('show');
    const g=window.gsap, reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(g && !reduced){
      _playWinSeq(iWon, finalCoins);
    } else {
      // No GSAP / reduced-motion → use the CSS staged entrance for a clean,
      // professional reveal (the media query softens it for reduced-motion).
      document.getElementById('winov')?.classList.add('winov-anim');
      coinsEl.textContent=(finalCoins>=0?'+':'')+finalCoins+' 🪙';
      if(iWon){ confetti(); SFX.play('win'); } else SFX.play('error');
    }
    // Kick off the 30s auto-return after the cinematic has had time to
    // play (~2.2s for the win sequence, ~0s for reduced-motion).
    setTimeout(_startWinAutoback, reduced ? 0 : 2200);
  }
  // Cinematic victory sequence — anticipation, slam, shake, confetti, coins.
  function _playWinSeq(iWon, coins){
    const g=window.gsap;
    const ov=document.getElementById('winov'), content=document.getElementById('winContent');
    const wt=document.getElementById('wtitle'), coinsEl=document.getElementById('wcoins');
    // Phone fast path — skip the orchestrated GSAP timeline (rays scale,
    // title blur-in, content shake) and just snap the win overlay open.
    // The rank-progress card + rewards row already carry the moment.
    if(document.body.classList.contains('mobile-lite')){
      // CSS staged entrance (overlay fade → content rise → rewards/actions
      // settle) so the GAME OVER screen comes up professionally even without
      // the GSAP timeline.
      if(ov){ ov.classList.add('show','winov-anim'); }
      try { if(iWon) SFX.play('win'); else SFX.play('error'); } catch(e){}
      return;
    }
    const reward=['wdet','wcoins','wbet'].map(id=>document.getElementById(id))
      .concat([document.getElementById('mvpBadge'),document.getElementById('crowdFav'),ov.querySelector('.win-back')])
      .filter(el=>el && el.style.display!=='none');
    g.killTweensOf([ov,content,wt,'.win-rays','.win-spot']);
    const tl=g.timeline();
    tl.fromTo(ov,{opacity:0},{opacity:1,duration:.28,ease:'power1.out'});
    if(iWon){
      tl.fromTo('.win-spot',{scale:0,opacity:0},{scale:1,opacity:1,duration:.7,ease:'power2.out'},0)
        .fromTo('.win-rays',{scale:.4,opacity:0},{scale:1,opacity:1,duration:1,ease:'power2.out'},0)
        .fromTo(wt,{scale:2.7,opacity:0,filter:'blur(10px)'},
          {scale:1,opacity:1,filter:'blur(0px)',duration:.5,ease:'back.out(1.7)',
           onComplete:()=>g.set(wt,{clearProps:'transform,filter,opacity'})},.16)
        .call(()=>{ try{SFX.play('win');}catch(e){} confetti(); })
        .fromTo(content,{x:-11},{x:11,duration:.05,repeat:5,yoyo:true,ease:'none',clearProps:'x'},'>-0.03')
        .call(()=>{ _winCoinCount(coinsEl,coins); if(coins>0) _coinBurst(coinsEl); })
        .fromTo(reward,{y:26,opacity:0},{y:0,opacity:1,duration:.5,stagger:.09,ease:'power3.out'},'>-0.12');
    } else {
      coinsEl.textContent=(coins>=0?'+':'')+coins+' 🪙';
      tl.fromTo(content,{y:26,opacity:0},{y:0,opacity:1,duration:.55,ease:'power2.out'},0);
      try{ SFX.play('error'); }catch(e){}
    }
  }
  function _winCoinCount(el,target){
    const g=window.gsap, sign=target<0?'-':'+', abs=Math.abs(target), o={v:0};
    g.to(o,{v:abs,duration:1.15,ease:'power2.out',
      onUpdate:()=>{ el.textContent=sign+Math.round(o.v).toLocaleString()+' 🪙'; },
      onComplete:()=>{ el.textContent=sign+abs.toLocaleString()+' 🪙'; }});
  }
  function _coinBurst(originEl){
    const g=window.gsap;
    const r=originEl.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    for(let i=0;i<18;i++){
      const c=document.createElement('div');
      c.className='win-coin-particle'; c.textContent='🪙';
      c.style.left=cx+'px'; c.style.top=cy+'px';
      document.body.appendChild(c);
      const ang=Math.random()*Math.PI*2, dist=130+Math.random()*240;
      g.to(c,{x:Math.cos(ang)*dist,y:Math.sin(ang)*dist-60-Math.random()*120,
        rotation:(Math.random()-.5)*620,scale:.5+Math.random()*1.1,
        duration:.95+Math.random()*.5,ease:'power3.out'});
      g.to(c,{opacity:0,duration:.45,delay:.6+Math.random()*.3,onComplete:()=>c.remove()});
    }
  }

  /* ═══ CLUTCH MOMENTS ═══
     Triggered when any player goes from 2+ cards to 1 card. We watch
     player handSize across state updates and fire a quick cinematic
     (full-screen flash, dramatic sting, slow-mo on the board). */
  const Clutch = {
    lastHands: {},
    lastFiredAt: 0,
    check(players){
      if(!players || S.isSpectator===false && !S.roomId) return;
      const now = Date.now();
      players.forEach(p => {
        const prev = this.lastHands[p.id];
        if (prev !== undefined && prev > 1 && p.handSize === 1 && now - this.lastFiredAt > 1500) {
          this.lastFiredAt = now;
          this.fire(p);
        }
        this.lastHands[p.id] = p.handSize;
      });
    },
    reset(){ this.lastHands = {}; this.lastFiredAt = 0; },
    fire(player){
      const ov = document.getElementById('clutchOv');
      const nameEl = document.getElementById('clutchName');
      if (!ov || !nameEl) return;
      nameEl.textContent = (player.username || 'PLAYER').toUpperCase();
      // Dramatic synth sting (3-note rising chord)
      try {
        if (typeof soundOn === 'undefined' || soundOn) {
          SFX.init();
          const c = SFX.ctx, now = c.currentTime;
          [261.63, 392.00, 523.25].forEach((freq, i) => {
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'triangle'; o.frequency.value = freq;
            o.connect(g); g.connect(c.destination);
            const t = now + i * 0.08;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.16, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
            o.start(t); o.stop(t + 0.6);
          });
        }
      } catch(e) {}
      document.body.classList.add('clutch');
      ov.classList.add('show');
      const txt = document.getElementById('clutchTxt');
      txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = '';
      setTimeout(() => {
        ov.classList.remove('show');
        document.body.classList.remove('clutch');
      }, 1100);
    }
  };
  function backLobby(){
    _cancelWinAutoback();
    document.getElementById('winov').classList.remove('show','winov-anim','winov-ranked');
    if(typeof window._dismissRankProgress === 'function') window._dismissRankProgress();
    // Tell the server we're leaving the (already finished) room so it stops
    // routing any lingering events to us, then go to lobby
    if(S.roomId && S.socket){
      S.socket.emit('room:leave',{},()=>{ S.roomId=null; goLobby(); });
    } else {
      S.roomId=null; goLobby();
    }
  }

  function confetti(){
    // Skip confetti on mobile — 200 particles animating @60fps after a
    // win is a sure way to thermal-throttle the device on the very moment
    // the player is celebrating. The big VICTORY title carries the moment.
    if(document.body.classList.contains('mobile-lite')) return;
    const cols=['#E8324A','#F59E0B','#16A34A','#2563EB','#7C3AED','#EC4899','#06B6D4','#fff'];
    const cvs=document.createElement('canvas');
    cvs.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:160';
    document.body.appendChild(cvs);cvs.width=innerWidth;cvs.height=innerHeight;
    const ctx=cvs.getContext('2d');
    const ps=Array.from({length:200},()=>{
      const type=Math.random();
      return{x:Math.random()*cvs.width,y:-30-Math.random()*200,
        w:type<.3?3:8+Math.random()*12,h:type<.3?12:4+Math.random()*8,
        c:cols[~~(Math.random()*cols.length)],
        r:Math.random()*Math.PI*2,rs:(Math.random()-.5)*.2,
        sp:1.5+Math.random()*4,dr:(Math.random()-.5)*2.5,
        swing:Math.random()*Math.PI*2,swingSpeed:.02+Math.random()*.03};
    });
    const t0=Date.now();
    (function draw(){ctx.clearRect(0,0,cvs.width,cvs.height);ps.forEach(p=>{
      p.y+=p.sp;p.x+=p.dr+Math.sin(p.swing)*1.5;p.swing+=p.swingSpeed;p.r+=p.rs;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);
      ctx.globalAlpha=Math.min(1,Math.max(0,1-(p.y/cvs.height)));
      ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });if(Date.now()-t0<6000)requestAnimationFrame(draw);else cvs.remove();})();
  }

  /* ═══ GAME PARTICLES ═══ */
  function initGameParticles(){
    AnimLayer.init();
    // Skip the 20 floating background particles on mobile — they're
    // decorative and add nothing while taxing the GPU through the
    // whole match.
    if(document.body.classList.contains('mobile-lite')) return;
    const c=document.getElementById('gameParticles');c.innerHTML='';
    for(let i=0;i<20;i++){
      const p=document.createElement('div');p.className='game-particle';
      p.style.cssText=`left:${Math.random()*100}%;animation-delay:${Math.random()*12}s;animation-duration:${10+Math.random()*8}s;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px;`;
      c.appendChild(p);
    }
  }

  /* ═══ BACKGROUND ═══ */
  function buildBg(){
    // Skip 16 floating auth-screen background cards on mobile.
    if(document.body.classList.contains('mobile-lite')) return;
    const bg=document.getElementById('auth-bg');
    const cols=['#E8324A','#2563EB','#16A34A','#F59E0B','#7C3AED'];
    for(let i=0;i<16;i++){
      const d=document.createElement('div');d.className='auth-bg-card';
      d.style.cssText=`left:${Math.random()*90}%;top:${Math.random()*90}%;background:${cols[i%cols.length]};--r:${(Math.random()-.5)*40}deg;transform:rotate(var(--r));animation-delay:${Math.random()*5}s;animation-duration:${7+Math.random()*6}s;`;
      bg.appendChild(d);
    }
  }

