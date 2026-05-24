  /* ═══ LEAGUE HUB ═══ */
  const League = { data: null, liga: null, tab: 'liga' };
  async function showLeague(){
    const ov = document.getElementById('leagueOv');
    ov.classList.add('show');
    document.getElementById('leagueList').innerHTML =
      `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading...</div>`;
    try {
      const [elo, liga] = await Promise.all([
        api('GET','/competitions/me'),
        api('GET','/league/me'),
      ]);
      League.data = elo;
      League.liga = liga;
      renderLeagueHero(elo);
      switchLeagueTab(League.tab || 'liga');
    } catch(e) {
      document.getElementById('leagueList').innerHTML =
        `<div style="color:rgba(255,255,255,.7);text-align:center;padding:30px;font-weight:700">Could not load league data</div>`;
    }
  }
  function leagueIcon(name){
    return ({Bronze:'🥉',Silver:'🥈',Gold:'🥇',Diamond:'💎'})[name] || '🥉';
  }
  function renderLeagueHero(d){
    const me = d.me, league = me.league || {};
    document.getElementById('leagueHeroBadge').textContent = leagueIcon(league.name);
    document.getElementById('leagueHeroName').textContent = league.name || 'Bronze';
    document.getElementById('leagueHeroRank').textContent =
      `Rank #${me.rank} of ${d.totalPlayers} • ${me.gamesWon}/${me.gamesPlayed} wins`;
    document.getElementById('leagueHeroElo').textContent = `⚡ ${me.elo} ELO`;
    const bar = document.getElementById('leagueHeroBar');
    const lbl = document.getElementById('leagueHeroBarLbl');
    if (me.nextLeague) {
      bar.style.width = me.progress + '%';
      lbl.textContent = `${me.elo} → ${me.nextLeague.min} for ${me.nextLeague.name} ${leagueIcon(me.nextLeague.name)}`;
    } else {
      bar.style.width = '100%';
      lbl.textContent = 'Top league reached — keep winning to stay on top!';
    }
  }
  function switchLeagueTab(tab){
    League.tab = tab;
    document.getElementById('leagueTabLiga').classList.toggle('on', tab==='liga');
    document.getElementById('leagueTabProg').classList.toggle('on', tab==='programme');
    document.getElementById('leagueTabTop').classList.toggle('on', tab==='top');
    document.getElementById('leagueTabHist').classList.toggle('on', tab==='history');
    const list = document.getElementById('leagueList');
    if (tab === 'liga') return renderLigaTable(list);
    if (tab === 'programme') return renderLigaProgramme(list);
    if (!League.data) return;
    if (tab === 'history') {
      const hist = League.data.matchHistory || [];
      if (!hist.length) { list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">No matches yet — go play!</div>`; return; }
      list.innerHTML = hist.map(m => {
        const when = timeAgo(m.at);
        const opp = (m.opponents || []).map(esc).join(', ') || '?';
        const sign = m.eloChange > 0 ? '+' : '';
        return `<div class="match-row ${m.won?'win':'loss'}">
          <div class="match-result ${m.won?'win':'loss'}">${m.won?'WIN':'LOSS'}</div>
          <div class="match-vs">vs ${opp}</div>
          <div style="text-align:right">
            <div class="match-elo ${m.won?'win':'loss'}">${sign}${m.eloChange||0} ELO</div>
            <div class="match-when">${when}</div>
          </div>
        </div>`;
      }).join('');
    } else {
      const rows = tab === 'top' ? (League.data.top || []) : (League.data.neighbours || []);
      list.innerHTML = rows.map(u => {
        const isMe = u.id === S.user?.id;
        const posClass = u.rank === 1 ? 'gold' : u.rank === 2 ? 'silver' : u.rank === 3 ? 'bronze' : '';
        const av = _isImgAvatar(u.avatar)
          ? `<div class="league-mini-avatar" style="background-image:url('${u.avatar}')"></div>`
          : `<div class="league-mini-avatar">${esc(u.avatar||(u.username||'?').charAt(0).toUpperCase())}</div>`;
        const winRate = u.gamesPlayed > 0 ? Math.round((u.gamesWon / u.gamesPlayed) * 100) : 0;
        return `<div class="league-row ${isMe?'me':''}">
          <div class="league-pos ${posClass}">#${u.rank}</div>
          ${av}
          <div style="flex:1;min-width:0">
            <div class="league-row-name">${esc(u.username)}${isMe?' <span style="font-size:9px;color:#FFD700">(You)</span>':''}</div>
            <div class="league-row-meta">${u.gamesWon}W · ${u.gamesPlayed-u.gamesWon}L · ${winRate}%</div>
          </div>
          <div class="league-row-elo">${u.elo}</div>
        </div>`;
      }).join('');
    }
  }
  function renderLigaTable(list){
    if (!League.liga) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading…</div>`;
      return;
    }
    const liga = League.liga;
    const standings = liga.standings || [];
    const seasonHeader = renderLigaSeasonBar();
    const podiumBlock = renderLigaPodiumBlock();
    const rows = standings.map(p => {
      const posClass = p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : '';
      const zoneClass = p.zone === 'champions' ? 'liga-zone-champs'
                      : p.zone === 'europa'    ? 'liga-zone-europa'
                      : p.zone === 'relegation' ? 'liga-zone-relegate' : '';
      const av = p.isMe
        ? `<div class="liga-mini-av me">${(p.name||'?').charAt(0).toUpperCase()}</div>`
        : `<div class="liga-mini-av">${(p.name||'?').charAt(0).toUpperCase()}</div>`;
      const last5 = (p.last5 || []).map(r =>
        `<span class="last5-dot ${r}">${r==='W'?'W':r==='L'?'L':'D'}</span>`
      ).join('');
      const gd = p.goalDifference;
      const gdStr = gd > 0 ? '+'+gd : (gd < 0 ? gd : '0');
      const gdClass = gd > 0 ? 'pos' : gd < 0 ? 'neg' : 'zero';
      const youTag = p.isMe ? '<span class="liga-you-tag">YOU</span>' : '';
      const botTag = p.isBot ? '<span class="liga-bot-tag">BOT</span>' : '';
      return `<tr class="${p.isMe?'me':''} ${zoneClass}">
        <td><span class="liga-pos ${posClass}">${p.rank}</span></td>
        <td><div class="liga-name-cell">${av}<span class="liga-name">${esc(p.name)}${youTag}${botTag}</span></div></td>
        <td class="pts">${p.points}</td>
        <td class="col-mp">${p.played}</td>
        <td class="col-w">${p.wins}</td>
        <td class="col-l">${p.losses}</td>
        <td class="col-d">${p.draws}</td>
        <td class="col-gf">${p.goalsFor}</td>
        <td class="col-ga">${p.goalsAgainst}</td>
        <td class="col-gd ${gdClass}">${gdStr}</td>
        <td class="col-last5"><div class="last5-cell">${last5||'<span style="color:rgba(255,255,255,.25)">—</span>'}</div></td>
      </tr>`;
    }).join('');
    list.innerHTML = `${seasonHeader}${podiumBlock}<div class="liga-table-wrap"><table class="liga-table">
      <thead><tr>
        <th>#</th><th>Team</th>
        <th class="col-pts">PTS</th>
        <th class="col-mp">MP</th>
        <th class="col-w">W</th>
        <th class="col-l">L</th>
        <th class="col-d">D</th>
        <th class="col-gf">GF</th>
        <th class="col-ga">GA</th>
        <th>GD</th>
        <th class="col-last5">Last 5</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="liga-zone-legend">
      <span><i style="background:#2563EB"></i> Champions League (1-4)</span>
      <span><i style="background:#F59E0B"></i> Dawri Abtal (5-8)</span>
      <span><i style="background:#E8324A"></i> Relegation (10-14)</span>
    </div>`;
  }

  function renderLigaSeasonBar(){
    const liga = League.liga;
    if (!liga) return '';
    const totalDays = liga.daysPerSeason || 13;
    const fixturesPerDay = liga.fixturesPerDay || 2;
    let label, meta, pct;
    if (liga.finishedAt && liga.nextSeasonAt) {
      const left = Math.max(0, liga.nextSeasonAt - (liga.serverNow || Date.now()));
      const mins = Math.ceil(left / 60000);
      const human = mins > 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`;
      label = `${liga.season || 'S1'} · Finished`;
      meta = `🏁 Next season in ${human}`;
      pct = 100;
    } else {
      const playedMax = Math.max(0, ...liga.standings.map(p => p.played));
      const dayNum = Math.min(totalDays, Math.ceil(playedMax / fixturesPerDay) || 1);
      const realUsers = liga.standings.filter(p => !p.isBot).length;
      label = `${liga.season || 'S1'} · Matchday ${dayNum}/${totalDays}`;
      meta = `${realUsers}/${liga.totalPlayers} real players · best-of-2 rounds`;
      pct = Math.min(100, Math.round((dayNum / totalDays) * 100));
    }
    return `<div class="liga-season-bar">
      <div class="liga-season-trophy">🏆</div>
      <div class="liga-season-text">
        <div class="liga-season-num">${label}</div>
        <div class="liga-season-meta">${meta}</div>
      </div>
      <div class="liga-season-progress" title="Season progress"><div class="liga-season-progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  }

  function renderLigaPodiumBlock(){
    const liga = League.liga;
    const podium = liga?.podium || liga?.previousSeasonPodium;
    if (!podium || !podium.length) return '';
    const medals = ['🥇','🥈','🥉'];
    const rows = podium.map((p, i) => `
      <div class="liga-podium-row">
        <div class="liga-podium-medal">${medals[i]||''}</div>
        <div class="liga-podium-name">${esc(p.name)}${p.isMe?' <span style="font-size:9px;color:#FFD700">(You)</span>':''}</div>
        <div class="liga-podium-prize">+${(p.prize||0).toLocaleString()} 🪙</div>
      </div>
    `).join('');
    const banner = liga.finishedAt
      ? '🏆 SEASON FINISHED — PODIUM'
      : '🏆 PREVIOUS SEASON PODIUM';
    return `<div class="liga-podium">
      <div class="liga-podium-title">${banner}</div>
      ${rows}
    </div>`;
  }

  function renderLigaProgramme(list){
    if (!League.liga) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">Loading…</div>`;
      return;
    }
    const matches = League.liga.myMatches || [];
    if (!matches.length) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.6);text-align:center;padding:30px">No fixtures yet</div>`;
      return;
    }
    const now = League.liga.serverNow || Date.now();
    const today = new Date(now); today.setHours(0,0,0,0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const yesterday = new Date(today.getTime() - 86400000);
    // Group by real calendar date (YYYY-MM-DD)
    const byDate = {};
    matches.forEach(m => {
      const d = new Date(m.scheduledAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      (byDate[key] = byDate[key] || []).push(m);
    });
    const dateKeys = Object.keys(byDate).sort();
    const dateLabel = (key) => {
      const [y, mo, d] = key.split('-').map(Number);
      const dt = new Date(y, mo - 1, d);
      const sameDay = (a, b) => a.getTime() === b.getTime();
      let prefix = '';
      if (sameDay(dt, today))      prefix = 'TODAY · ';
      else if (sameDay(dt, tomorrow))  prefix = 'TOMORROW · ';
      else if (sameDay(dt, yesterday)) prefix = 'YESTERDAY · ';
      const weekday = dt.toLocaleDateString([], { weekday: 'long' });
      const dayNum  = dt.getDate();
      const month   = dt.toLocaleDateString([], { month: 'long' });
      const year    = dt.getFullYear();
      return `${prefix}${weekday}, ${dayNum} ${month} ${year}`;
    };
    list.innerHTML = dateKeys.map(key => {
      const dayMatches = byDate[key].sort((a,b)=>a.scheduledAt-b.scheduledAt);
      const rows = dayMatches.map(m => {
        const opp = m.opponent;
        const av = `<div class="liga-mini-av">${(opp?.name||'?').charAt(0).toUpperCase()}</div>`;
        const date = new Date(m.scheduledAt);
        const timeStr = date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        let resultBadge = '';
        let action = '';
        if (m.status === 'finished') {
          const cls = m.result === 'W' ? 'win' : m.result === 'L' ? 'loss' : 'draw';
          const label = m.result === 'W' ? 'WIN' : m.result === 'L' ? 'LOSS' : 'DRAW';
          resultBadge = `<span class="programme-result ${cls}">${label} ${m.score||''}</span>`;
        } else if (m.status === 'live') {
          resultBadge = `<span class="programme-result live">🔴 LIVE</span>`;
        } else if (m.playable) {
          action = `<button class="btn-play-match" onclick="startLeagueMatch('${m.id}')">▶ Play Now</button>`;
        } else if (m.upcoming) {
          const mins = Math.ceil(m.startsIn / 60000);
          let hint;
          if (mins < 60) hint = mins + 'm';
          else if (mins < 60*24) hint = Math.floor(mins/60) + 'h ' + (mins%60) + 'm';
          else hint = Math.floor(mins/(60*24)) + 'd ' + Math.floor((mins%(60*24))/60) + 'h';
          action = `<span class="programme-result" style="background:rgba(124,58,237,.18);color:#c4b5fd">⏳ in ${hint}</span>`;
        }
        return `<div class="programme-row ${m.status}">
          <div class="programme-time">${timeStr}</div>
          <div class="programme-vs">${av}<span>${esc(opp?.name||'?')}${opp?.isBot?' 🤖':''}</span></div>
          ${resultBadge || action}
        </div>`;
      }).join('');
      return `<div class="programme-day">📅 ${dateLabel(key)}</div>${rows}`;
    }).join('');
  }
  async function startLeagueMatch(matchId){
    try {
      const d = await api('POST','/league/match/'+matchId+'/start');
      toast(`Match started vs ${d.opponent}!`,'s');
      document.getElementById('leagueOv').classList.remove('show');
      document.body.classList.add('in-league-game');
      const badge = document.getElementById('roundBadge');
      if (badge) badge.textContent = 'ROUND 1 / 2';
      doJoin(d.roomId);
    } catch(e) {
      toast(e.message || 'Could not start match','e');
    }
  }
  function timeAgo(ts){
    const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  function updateSpectatorTurnUI(){
    const g = S.g;
    const stackEl = document.getElementById('hstack'), stackN = document.getElementById('hstackn');
    if ((g.stackDraw || 0) > 0) { stackEl.style.display='flex'; stackN.textContent = g.stackDraw + ' cards!'; }
    else stackEl.style.display = 'none';
    const cur = g.players.find(p => p.id === g.currentTurn);
    document.getElementById('tdisp').textContent = `🎬 ${cur?.username || '...'}'s turn`;
    document.getElementById('tdisp').className = 'turndisp';
    document.getElementById('hturn').textContent = `🎬 ${cur?.username || '...'}`;
    document.getElementById('hdir').textContent = g.direction === 1 ? '↻ Clockwise' : '↺ Counter-CW';
    document.getElementById('hphase').textContent = `👁️ Spectating`;
    // Hide the UNO button — spectators can't call UNO
    const u = document.getElementById('btnUNO'); if (u) u.classList.add('disabled');
  }

  function updateTurnUI(){
    const g=S.g;
    const stackEl=document.getElementById('hstack'),stackN=document.getElementById('hstackn');
    if((g.stackDraw||0)>0){stackEl.style.display='flex';stackN.textContent=(g.stackDraw)+' cards!';}
    else stackEl.style.display='none';
    const me=myTurn(),el=document.getElementById('tdisp'),ht=document.getElementById('hturn');
    if(me){el.textContent='⚡ YOUR TURN!';el.className='turndisp me';ht.textContent='⚡ Your Turn';}
    else{const p=g.players.find(p=>p.id===g.currentTurn);el.textContent=`${p?.username||'...'}\'s turn`;el.className='turndisp';ht.textContent=`⏳ ${p?.username||'...'}`;document.getElementById('cancelArea').style.display='none';}
    document.getElementById('hdir').textContent=g.direction===1?'↻ Clockwise':'↺ Counter-CW';
    document.getElementById('hphase').textContent=`🃏 ${g.myHand.length} cards`;
    updateUNOButton();
  }

