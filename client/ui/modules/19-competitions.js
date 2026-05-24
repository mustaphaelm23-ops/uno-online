  /* ═══ RANKED / ELO ═══ */
  const LEAGUES = [
    { name:'Bronze',  min:0,    max:999,  badge:'🥉', color:'#CD7F32' },
    { name:'Silver',  min:1000, max:1499, badge:'🥈', color:'#C0C0C0' },
    { name:'Gold',    min:1500, max:1999, badge:'🥇', color:'#FFD700' },
    { name:'Diamond', min:2000, max:9999, badge:'💎', color:'#B9F2FF' },
  ];

  function getLeague(elo){
    return [...LEAGUES].reverse().find(l => elo >= l.min) || LEAGUES[0];
  }

  function leagueBadgeHTML(elo){
    const l = getLeague(elo||1000);
    return `<span class="league-badge" style="color:${l.color};border-color:${l.color}40">${l.badge} ${l.name}</span>`;
  }

  function eloBarHTML(elo){
    const l = getLeague(elo||1000);
    const next = LEAGUES.find(lg => lg.min > (elo||1000));
    const pct = next ? Math.round(((elo-l.min)/(next.min-l.min))*100) : 100;
    return `
      <div class="elo-bar-wrap">
        <div class="elo-bar-label"><span>${l.badge} ${l.name}</span><span>${elo||1000} ELO${next?` / ${next.min}`:' MAX'}</span></div>
        <div class="elo-bar"><div class="elo-bar-fill" style="width:${pct}%;background:${l.color}"></div></div>
      </div>`;
  }

  async function showRankedLb(){
    try{
      const data = await apiFetch('/api/leaderboard/ranked');
      const list = data.leaderboard || [];
      const myId = S.user?.id;
      document.getElementById('rankedLbList').innerHTML = list.map(r => `
        <div class="ranked-row ${r.username===S.user?.username?'me':''}">
          <div class="ranked-rank ${r.rank===1?'gold':r.rank===2?'silver':r.rank===3?'bronze':''}">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</div>
          <div class="ranked-name">${esc(r.username)}<br><span style="font-size:10px;color:var(--muted)">${r.badge} ${r.league}</span></div>
          <div class="ranked-elo">${r.elo}</div>
        </div>
      `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">No ranked games yet</div>';
      document.getElementById('rankedLbOv').classList.add('show');
    } catch(e){ toast('Could not load ranked leaderboard','e'); }
  }

  function showEloPopup(change, won){
    const el = document.createElement('div');
    el.className = 'elo-popup';
    el.style.color = won ? '#4ade80' : '#f87171';
    el.textContent = (won?'+':'-') + Math.abs(change) + ' ELO';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 2600);
  }

  /* ═══ TOURNAMENTS ═══ */
  const Tourn = { current: null, pendingMatch: null, filter: 'all', expanded: null, lastList: [] };

  async function showTournaments(){
    document.getElementById('tournOv').classList.add('show');
    _renderTournamentsList([], true); // loading state
    try{
      const data = await apiFetch('/api/tournaments');
      _renderTournamentsList(data.tournaments || [], false);
    } catch(e){
      _renderTournamentsList([], false, 'Could not load tournaments');
    }
  }
  function _renderTournamentsList(rawList, loading, errMsg){
    const box = document.querySelector('#tournOv .tourn-box');
    if(!box) return;
    Tourn.lastList = rawList || [];
    const me = S.user?.id;
    const filter = Tourn.filter || 'all';
    const list = (rawList || []).filter(t => {
      if(filter==='open')    return t.status==='open';
      if(filter==='playing') return t.status==='playing';
      if(filter==='mine')    return t.creatorId === me || t.players.find(p=>p.id===me);
      return true;
    });
    const counts = {
      all: (rawList||[]).length,
      open: (rawList||[]).filter(t=>t.status==='open').length,
      playing: (rawList||[]).filter(t=>t.status==='playing').length,
      mine: (rawList||[]).filter(t=>t.creatorId===me||t.players.find(p=>p.id===me)).length,
    };
    let body;
    if(loading){
      body = `<div class="t-loading"><div class="t-spinner"></div>Loading tournaments…</div>`;
    } else if(errMsg){
      body = `<div style="text-align:center;color:#f87171;padding:40px;font-weight:700">${esc(errMsg)}</div>`;
    } else if(!list.length){
      const emptyMsg = filter==='mine' ? 'You haven\'t joined or hosted any tournament yet.'
                      : filter==='open' ? 'No open tournaments — be the first to host one!'
                      : filter==='playing' ? 'Nothing playing right now.'
                      : 'No tournaments yet. Create the first one!';
      body = `<div class="t-empty">
        <div class="t-empty-icon">🏆</div>
        <div class="t-empty-title">Nothing here</div>
        <div class="t-empty-sub">${emptyMsg}</div>
      </div>`;
    } else {
      body = `<div class="t-list">${list.map(t=>_tournamentCardHTML(t)).join('')}</div>`;
    }
    const tab = (k,lbl) => `<button class="t-tab ${filter===k?'on':''}" onclick="_setTournFilter('${k}')">${lbl}<span class="t-tab-n">${counts[k]}</span></button>`;
    box.innerHTML = `
      <div class="t-head">
        <div class="tourn-title">🏆 TOURNAMENTS</div>
        <button class="t-close" onclick="document.getElementById('tournOv').classList.remove('show')">✕</button>
      </div>
      <button class="t-create-btn" onclick="showCreateTournamentModal()">＋ Create Tournament</button>
      <div class="t-tabs">
        ${tab('all','All')}${tab('open','Open')}${tab('playing','Playing')}${tab('mine','Mine')}
      </div>
      ${body}
    `;
  }
  function _setTournFilter(f){
    Tourn.filter = f;
    _renderTournamentsList(Tourn.lastList || [], false);
  }
  function _toggleTournBracket(id){
    Tourn.expanded = Tourn.expanded === id ? null : id;
    _renderTournamentsList(Tourn.lastList || [], false);
  }
  function _tournamentCardHTML(t){
    const me = S.user?.id;
    const registered = !!t.players.find(p=>p.id===me);
    const isCreator = t.creatorId === me;
    const isFull = t.players.length >= t.maxPlayers;
    const expanded = Tourn.expanded === t.id;
    const statusBadge = t.status==='open'
      ? `<span class="t-status open">OPEN</span>`
      : t.status==='playing'
        ? `<span class="t-status playing">● ROUND ${t.round}</span>`
        : `<span class="t-status done">FINISHED</span>`;
    let action = '';
    if(t.status==='open'){
      if(isCreator && t.players.length>=2){
        action = `<button class="t-act t-act-start" onclick="event.stopPropagation();doStartTournament('${t.id}')">⚔️ Start Now${t.players.length<t.maxPlayers?' · fills bots':''}</button>`;
      } else if(registered){
        action = `<div class="t-act t-act-wait">✅ Registered — waiting</div>`;
      } else if(!isFull){
        const feeLbl = t.entryFee>0 ? ` · ${t.entryFee.toLocaleString()}🪙` : '';
        action = `<button class="t-act t-act-join" onclick="event.stopPropagation();doJoinTournamentId('${t.id}')">🏆 Register${feeLbl}</button>`;
      } else {
        action = `<div class="t-act t-act-wait">Tournament full</div>`;
      }
    } else if(t.status==='playing'){
      action = registered
        ? `<div class="t-act t-act-wait">⚔️ In progress — your match awaits</div>`
        : `<div class="t-act t-act-wait">⚔️ Round ${t.round} in progress</div>`;
    } else if(t.status==='finished'){
      action = `<div class="t-act t-act-wait">🏆 Champion: ${esc(t.winner?.username||'?')}</div>`;
    }
    const creator = t.creatorId ? (t.players.find(p=>p.id===t.creatorId)?.username || 'someone') : 'system';
    const pot = t.pot != null ? t.pot : t.prizeCoins;
    const feeBit = t.entryFee>0 ? `<div class="t-meta"><b>🎟️ ${t.entryFee.toLocaleString()}</b> fee</div>` : '';
    const bracketHTML = expanded ? _tournamentBracketHTML(t) : '';
    return `<div class="t-card ${expanded?'open':''}" onclick="_toggleTournBracket('${t.id}')">
      <div class="t-card-head">
        <div class="t-card-name">${esc(t.name)}</div>
        ${statusBadge}
      </div>
      <div class="t-card-meta">
        <div class="t-meta"><b>👥 ${t.players.length}/${t.maxPlayers}</b> players</div>
        <div class="t-meta"><b>🪙 ${pot.toLocaleString()}</b> pot</div>
        ${feeBit}
        <div class="t-meta">Host <b>${esc(creator)}</b></div>
      </div>
      ${action}
      ${bracketHTML}
      <div class="t-expand-hint">${expanded?'▴ Hide details':'▾ Show players & bracket'}</div>
    </div>`;
  }
  function _tournamentBracketHTML(t){
    const me = S.user?.id;
    const pChip = (p) => {
      if(!p) return '<div class="t-pchip empty">—</div>';
      const isBot = !!p.isBot;
      const isMe = p.id === me;
      return `<div class="t-pchip ${isMe?'me':''} ${isBot?'bot':''}">${esc(p.username)}${isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>`;
    };
    let bracketBlock = '';
    if(t.bracket?.length){
      bracketBlock = `<div class="t-bracket"><div class="t-bracket-title">Round ${t.round} Bracket</div>` +
        t.bracket.map(m => {
          const w = m.winner;
          const w1 = w && w===m.p1?.id, w2 = w && w===m.p2?.id;
          return `<div class="t-match">
            <div class="t-match-p ${w1?'win':w?'lose':''}">${esc(m.p1?.username||'?')}${m.p1?.isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>
            <div class="t-vs">VS</div>
            <div class="t-match-p ${w2?'win':w?'lose':''}">${esc(m.p2?.username||'?')}${m.p2?.isBot?' <span class="t-pchip-tag">BOT</span>':''}</div>
          </div>`;
        }).join('') + '</div>';
    }
    const slots = Math.max(0, t.maxPlayers - t.players.length);
    const playersHTML = `<div class="t-bracket"><div class="t-bracket-title">Players (${t.players.length}/${t.maxPlayers})</div>
      <div class="t-pchips">${t.players.map(pChip).join('')}${Array(slots).fill('<div class="t-pchip empty">empty</div>').join('')}</div>
    </div>`;
    return `<div class="t-detail" onclick="event.stopPropagation()">${playersHTML}${bracketBlock}</div>`;
  }
  async function doJoinTournamentId(id){
    try{
      await apiFetch(`/api/tournaments/${id}/join`,{method:'POST'});
      toast('Registered! 🏆','s');
      showTournaments();
    }catch(e){ toast(e.message||'Could not join','e'); }
  }
  async function doStartTournament(id){
    try{
      const d=await apiFetch(`/api/tournaments/${id}/start`,{method:'POST',body:JSON.stringify({})});
      toast('Tournament started! ⚔️','s');
      showTournaments();
    }catch(e){ toast(e.message||'Could not start','e'); }
  }
  function showCreateTournamentModal(){
    const old=document.getElementById('createTournModal'); if(old) old.remove();
    const ov=document.createElement('div'); ov.id='createTournModal';
    ov.style.cssText='position:fixed;inset:0;z-index:1500;background:rgba(4,6,14,.85);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;animation:avFadeIn .25s ease';
    const coins=(S.user?.coins||0);
    ov.innerHTML=`
      <div style="width:min(420px,95vw);background:linear-gradient(180deg,rgba(30,34,60,.97),rgba(16,20,36,.99));border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:24px;box-shadow:0 40px 100px rgba(0,0,0,.75);animation:avPanelIn .4s cubic-bezier(.2,.9,.3,1.2)">
        <div style="font-family:'Bangers',cursive;font-size:26px;letter-spacing:2px;color:#fff;text-align:center;margin-bottom:4px">🏆 CREATE TOURNAMENT</div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center;margin-bottom:18px;font-weight:600">Set the rules. Take the trophy.</div>
        <div class="fg"><label>Tournament Name</label><input id="ctName" type="text" placeholder="My UNO Cup" maxlength="30"/></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="fg"><label>Max Players</label>
            <select id="ctMax" style="width:100%;padding:13px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:14px;font-weight:700;outline:none;cursor:pointer">
              <option value="2">2 Players</option>
              <option value="4" selected>4 Players</option>
              <option value="8">8 Players</option>
              <option value="16">16 Players</option>
            </select>
          </div>
          <div class="fg"><label>Prize 🪙 <span class="fg-opt">staked</span></label><input id="ctPrize" type="number" min="0" max="${coins}" value="500" placeholder="0"/></div>
        </div>
        <div class="fg"><label>Entry Fee 🎟️ <span class="fg-opt">optional</span></label><input id="ctFee" type="number" min="0" value="0" placeholder="0"/></div>
        <div style="font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin:-4px 0 14px;line-height:1.55">You stake the prize (you have <b style="color:#FFD700">${coins.toLocaleString()}🪙</b>). Every player who joins pays the entry fee — it grows the pot. Empty slots fill with AI bots on start. <b style="color:#fff">Winner takes the full pot.</b></div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('createTournModal').remove()" style="flex:0 0 auto;padding:13px 22px;background:transparent;border:1.5px solid rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">Cancel</button>
          <button class="btnP" style="flex:1" onclick="doCreateTournament()">⚔️ Create</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    setTimeout(()=>document.getElementById('ctName')?.focus(),60);
  }
  async function doCreateTournament(){
    const name=document.getElementById('ctName').value.trim();
    const maxPlayers=parseInt(document.getElementById('ctMax').value,10);
    const prizeCoins=parseInt(document.getElementById('ctPrize').value,10)||0;
    const entryFee=parseInt(document.getElementById('ctFee').value,10)||0;
    if(name.length<3) return toast('Name must be at least 3 characters','e');
    try{
      const d=await apiFetch('/api/tournaments/create',{
        method:'POST',
        body:JSON.stringify({name, maxPlayers, prizeCoins, entryFee}),
      });
      if(S.user && typeof d.coins==='number'){
        S.user.coins=d.coins; localStorage.setItem('uno_user',JSON.stringify(S.user));
        document.getElementById('hcoins').textContent=d.coins;
        document.getElementById('scoins').textContent=d.coins;
        const hc=document.getElementById('heroCoins'); if(hc) hc.textContent=d.coins.toLocaleString();
      }
      toast('🏆 Tournament created!','s');
      document.getElementById('createTournModal')?.remove();
      showTournaments();
    }catch(e){ toast(e.message||'Could not create','e'); }
  }

  function renderTournament(t){
    Tourn.current = t;
    document.getElementById('tournName').textContent = `🏆 ${t.name}`;
    document.getElementById('tournPrize').textContent = `🪙 Prize: ${t.prizeCoins.toLocaleString()} coins`;
    const isRegistered = t.players.find(p=>p.id===S.user?.id);
    const isFull = t.players.length >= t.maxPlayers;
    // Status
    const statusEl = document.getElementById('tournStatus');
    if(t.status==='open') statusEl.textContent = `${t.players.length}/${t.maxPlayers} players registered • Open for registration`;
    else if(t.status==='playing') statusEl.textContent = `🔥 Round ${t.round} in progress!`;
    else statusEl.textContent = `🏆 Finished! Winner: ${t.winner?.username||'?'}`;
    // Players
    document.getElementById('tournPlayersList').innerHTML = t.players.map(p=>`
      <div class="tourn-player-chip" style="${p.id===S.user?.id?'border-color:var(--accent);color:var(--accent)':''}">
        ${esc(p.username)}<br><span style="font-size:10px;color:var(--muted)">${leagueBadgeHTML(p.elo||1000)}</span>
      </div>
    `).join('') + (t.status==='open' ? Array(t.maxPlayers-t.players.length).fill('<div class="tourn-player-chip" style="opacity:.3;border-style:dashed">Empty</div>').join('') : '');
    // Bracket
    const bracketEl = document.getElementById('tournBracket');
    if(t.bracket?.length){
      bracketEl.innerHTML = `<div class="bracket-round"><div class="bracket-round-title">Round ${t.round}</div>` +
        t.bracket.map(m=>`
          <div class="bracket-match">
            <div class="bracket-player ${m.winner===m.p1.id?'winner':m.winner?'loser':t.status==='playing'?'playing':''}">${esc(m.p1.username)}</div>
            <div class="bracket-vs">VS</div>
            <div class="bracket-player ${m.winner===m.p2.id?'winner':m.winner?'loser':t.status==='playing'?'playing':''}">${esc(m.p2.username)}</div>
          </div>
        `).join('') + '</div>';
    } else bracketEl.innerHTML='';
    // Join button
    const joinWrap = document.getElementById('tournJoinWrap');
    if(t.status==='open' && !isRegistered && !isFull){
      joinWrap.innerHTML=`<button class="btnP" onclick="doJoinTournament()" style="width:100%">🏆 Register Now (Free)</button>`;
    } else if(isRegistered && t.status==='open'){
      joinWrap.innerHTML=`<div style="text-align:center;color:#4ade80;font-weight:700;padding:12px">✅ You are registered! Wait for the tournament to start.</div>`;
    } else joinWrap.innerHTML='';
  }

  async function doJoinTournament(){
    if(!Tourn.current) return;
    try{
      await apiFetch(`/api/tournaments/${Tourn.current.id}/join`, { method:'POST' });
      toast('Registered! 🏆 Good luck!','s');
      const data = await apiFetch(`/api/tournaments/${Tourn.current.id}`);
      renderTournament(data.tournament);
    } catch(e){ toast(e.message||'Error','e'); }
  }

  function doJoinMatch(){
    document.getElementById('matchInvite').classList.remove('show');
    if(Tourn.pendingMatch) doJoinRoom(Tourn.pendingMatch.roomId);
  }

  function handleAuthEnter(e){
    if(e.key!=='Enter')return;
    if(document.getElementById('lf')?.style.display!=='none')doLogin();
    else doRegister();
  }

