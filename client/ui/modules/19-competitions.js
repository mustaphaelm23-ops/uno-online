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

  /* ═══ NEW RANKED HUB (Phases 1-4) ═══ */
  // Reads rankPoints + placement + tier + season + DC warning from the
  // backend ranked endpoints. Renders the hero card, season pill, stats
  // row, top-20 leaderboard, and a "Play Ranked" CTA that drops the user
  // straight into MMR queue.
  // Progressive boundaries — must mirror server LEAGUES.
  const RANKED_TIERS_CLIENT = [
    { name:'Bronze',      min:0,    badge:'🥉', color:'#CD7F32', img:'/ranks/bronze.png' },
    { name:'Silver',      min:500,  badge:'🥈', color:'#C0C0C0', img:'/ranks/silver.png' },
    { name:'Gold',        min:1300, badge:'🥇', color:'#FFD700', img:'/ranks/gold.png' },
    { name:'Platinum',    min:2400, badge:'💠', color:'#5FD6E8', img:'/ranks/platinum.png' },
    { name:'Diamond',     min:3900, badge:'💎', color:'#7EA8FF', img:'/ranks/diamond.png' },
    { name:'Master',      min:6000, badge:'👑', color:'#B07CFF', img:'/ranks/master.png' },
    { name:'Grandmaster', min:9000, badge:'🏆', color:'#FF6B6B', img:'/ranks/grandmaster.png' },
  ];
  function rpTier(rp){
    return [...RANKED_TIERS_CLIENT].reverse().find(t => (rp||0) >= t.min) || RANKED_TIERS_CLIENT[0];
  }
  function rpNextTier(rp){
    return RANKED_TIERS_CLIENT.find(t => t.min > (rp||0));
  }
  function fmtCountdown(ms){
    if(ms <= 0) return 'ending soon';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if(d > 0) return `${d}d ${h}h`;
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  async function showRanked(){
    _ensureRankedHubStyles();
    const ov = document.getElementById('rankedHubOv');
    const body = document.getElementById('rankedHubBody');
    if(!ov || !body) return;
    // Cinematic loading state — already feels alive while data lands.
    body.innerHTML = `
      <div class="rh-load">
        <div class="rh-load-emblem">⚔️</div>
        <div class="rh-load-title">PREPARING THE ARENA</div>
        <div class="rh-load-bar"><span></span></div>
      </div>`;
    ov.classList.add('show');
    try{
      const [lb, season] = await Promise.all([
        apiFetch('/api/leaderboard/ranked'),
        apiFetch('/api/ranked/season'),
      ]);
      const u = S.user || {};
      const rp        = u.rankPoints || 0;
      const peak      = u.peakRankPoints || rp;
      const placed    = u.placementGamesPlayed || 0;
      const inPlace   = placed < 5;
      const wins      = u.rankedWins || 0;
      const losses    = u.rankedLosses || 0;
      const streak    = u.winStreak || 0;
      const abandons  = u.rankedAbandonCount || 0;
      const tier      = inPlace ? null : rpTier(rp);
      const nextTier  = inPlace ? null : rpNextTier(rp);
      const span      = nextTier ? (nextTier.min - tier.min) : 1;
      const into      = nextTier ? (rp - tier.min) : 1;
      const pct       = nextTier ? Math.min(100, Math.max(0, Math.round(into/span*100))) : 100;
      const rpToPromo = nextTier ? (nextTier.min - rp) : 0;
      const promoZone = !inPlace && nextTier && rpToPromo <= 100;

      const endsIn = Math.max(0, (season.endsAt || 0) - Date.now());

      // Tier color used as the dominant CSS accent across the whole hub.
      const accent = inPlace ? '#FBBF24' : (tier?.color || '#FBBF24');
      const tierBadge = inPlace ? '🎯' : (tier?.badge || '🥉');
      const tierImg   = inPlace ? null : (tier?.img || null);
      const tierName  = inPlace ? 'PLACEMENT' : tier?.name?.toUpperCase() || 'BRONZE';
      const division  = inPlace ? '' : ((tier?.division || tier?.label || '').replace(tier?.name||'', '').trim() || '');

      // ── HERO — animated tier emblem with rotating energy rings + RP ──
      const heroBlock = `
        <div class="rh-hero" style="--rh-accent:${accent}">
          <div class="rh-hero-bg"></div>
          <div class="rh-hero-spotlight rh-spot-l"></div>
          <div class="rh-hero-spotlight rh-spot-r"></div>
          <div class="rh-hero-stage">
            <div class="rh-hero-ring rh-hero-ring-outer"></div>
            <div class="rh-hero-ring rh-hero-ring-inner"></div>
            <div class="rh-hero-emblem">${tierImg ? `<img class="rh-hero-emblem-img" src="${tierImg}" alt="${esc(tierName)}" draggable="false">` : tierBadge}</div>
          </div>
          <div class="rh-hero-eyebrow">⚔️  COMPETITIVE LADDER  ⚔️</div>
          <div class="rh-hero-tier">${esc(tierName)}${division ? ` <span class="rh-hero-div">${esc(division)}</span>` : ''}</div>
          <div class="rh-hero-rp">
            ${inPlace
              ? `<span class="rh-hero-rp-lbl">${5-placed} match${5-placed===1?'':'es'} until your rank is set</span>`
              : `<span class="rh-hero-rp-val">${rp.toLocaleString()}</span><span class="rh-hero-rp-unit">RP</span>
                 <span class="rh-hero-rp-peak">PEAK ${peak.toLocaleString()}</span>`}
          </div>
          ${inPlace
            ? `<div class="rh-progress rh-progress-placement">
                 <div class="rh-progress-bar"><div class="rh-progress-fill" style="width:${placed*20}%;background:linear-gradient(90deg,#FBBF24,#FF6B6B)"></div></div>
                 <div class="rh-progress-meta"><span>Placement</span><span>${placed} / 5</span></div>
               </div>`
            : nextTier
              ? `<div class="rh-progress">
                   <div class="rh-progress-bar"><div class="rh-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},#FFE9B0)"></div></div>
                   <div class="rh-progress-meta"><span>${rp.toLocaleString()} RP</span><span>${nextTier.badge} ${esc(nextTier.name)} · ${nextTier.min.toLocaleString()} RP</span></div>
                 </div>`
              : `<div class="rh-topcrown">⭐ TOP TIER REACHED ⭐</div>`}
        </div>`;

      // ── PROMOTION ALERT — urgent red glow when ≤100 RP from promo ──
      const promoAlert = promoZone ? `
        <div class="rh-promo">
          <div class="rh-promo-glow"></div>
          <div class="rh-promo-icon">🔥</div>
          <div class="rh-promo-txt">
            <div class="rh-promo-eyebrow">PROMOTION INCOMING</div>
            <div class="rh-promo-line">${rpToPromo} RP from <b>${nextTier.badge} ${esc(nextTier.name)}</b> — close the deal.</div>
          </div>
        </div>` : '';

      // ── STREAK FIRE — only when on a heat streak ──
      const streakBlock = streak >= 2 ? `
        <div class="rh-streak">
          <div class="rh-streak-fire">🔥</div>
          <div class="rh-streak-txt">
            <div class="rh-streak-num">${streak}-WIN STREAK</div>
            <div class="rh-streak-sub">You're on fire — bonus RP active</div>
          </div>
        </div>` : '';

      // ── SEASON PILL with live ticking countdown via setInterval ──
      const seasonPill = `
        <div class="rh-season">
          <div class="rh-season-lbl">SEASON ${season.seasonId || 1}</div>
          <div class="rh-season-cd" data-rh-cd data-endsat="${season.endsAt || 0}">${fmtCountdown(endsIn)}</div>
        </div>`;

      const dcWarning = abandons > 0
        ? `<div class="rh-warn">
             <div class="rh-warn-icon">⚠️</div>
             <div class="rh-warn-txt">
               <b>${abandons} abandon offense${abandons===1?'':'s'}</b> on record. Next abandon = ${abandons>=3?'6h ban':abandons===2?'2h ban':'1h ban'} + extra RP loss.
             </div>
           </div>`
        : '';

      // ── STATS strip — W/L + WR + Streak in a coliseum-style bar ──
      const total = wins + losses;
      const winrate = total ? Math.round(wins/total*100) : 0;
      const statsRow = !inPlace
        ? `<div class="rh-stats">
             <div class="rh-stat rh-stat-w">
               <div class="rh-stat-val">${wins}</div>
               <div class="rh-stat-lbl">Victories</div>
             </div>
             <div class="rh-stat rh-stat-l">
               <div class="rh-stat-val">${losses}</div>
               <div class="rh-stat-lbl">Defeats</div>
             </div>
             <div class="rh-stat rh-stat-r">
               <div class="rh-stat-val">${winrate}<span style="font-size:18px">%</span></div>
               <div class="rh-stat-lbl">Win Rate</div>
             </div>
             <div class="rh-stat rh-stat-s">
               <div class="rh-stat-val">${streak}${streak>=2?' 🔥':''}</div>
               <div class="rh-stat-lbl">Streak</div>
             </div>
           </div>`
        : '';

      // ── BATTLE CTA — enters the full RONDA game, ranked (2v2 team ladder,
      //    free entry, rank points on win/loss). ──
      const playBtn = `
        <button class="rh-cta" style="--rh-accent:${accent}"
          onclick="document.getElementById('rankedHubOv').classList.remove('show');if(typeof showRankedReady==='function')showRankedReady();else quickJoin('RANKED')">
          <span class="rh-cta-glow"></span>
          <span class="rh-cta-shine"></span>
          <span class="rh-cta-body">
            <span class="rh-cta-sword">⚔️</span>
            <span class="rh-cta-text">
              <span class="rh-cta-main">${inPlace ? 'ENTER PLACEMENT' : 'ENTER RANKED'}</span>
              <span class="rh-cta-sub">🃏 Ronda · 2v2 · free entry · ${inPlace ? `${5-placed} placement left` : 'climb the ladder'}</span>
            </span>
            <span class="rh-cta-sword">⚔️</span>
          </span>
        </button>`;

      // ── CLIMB PATH — modern vertical ladder w/ animated marker ──
      const climbRows = [...RANKED_TIERS_CLIENT].reverse().map((t) => {
        const isMine    = !inPlace && tier && tier.name === t.name;
        const unlocked  = !inPlace && rp >= t.min;
        const rpToGo    = Math.max(0, t.min - rp);
        const status = isMine
          ? `<span class="rh-climb-status rh-climb-here">★ YOU ARE HERE</span>`
          : unlocked
            ? `<span class="rh-climb-status rh-climb-unlocked">✓ CONQUERED</span>`
            : `<span class="rh-climb-status rh-climb-locked">⭐ ${rpToGo.toLocaleString()} RP</span>`;
        return `
          <div class="rh-climb-row ${isMine?'is-mine':''} ${unlocked?'is-unlocked':''}" style="--rh-tier:${t.color}">
            <div class="rh-climb-marker">${t.img ? `<img class="rh-climb-img" src="${t.img}" alt="${esc(t.name)}" loading="lazy" draggable="false">` : `<span>${t.badge}</span>`}</div>
            <div class="rh-climb-info">
              <div class="rh-climb-name">${esc(t.name)}</div>
              <div class="rh-climb-thresh">${t.min.toLocaleString()} RP</div>
            </div>
            ${status}
          </div>`;
      }).join('');

      const climbBlock = inPlace ? '' : `
        <div class="rh-section">
          <div class="rh-section-head">
            <div class="rh-section-title">🪜 CLIMB PATH</div>
            <div class="rh-section-sub">${wins}W · ${losses}L · 🔥${streak}</div>
          </div>
          <div class="rh-climb">${climbRows}</div>
        </div>`;

      // ── RANK REWARDS — exclusive banner frames you earn by ranking up. Shown
      //    here on the play screen so the goal is front-and-centre. Uses the
      //    shared premium renderer (defined in the battlepass module). ──
      const _rw = (typeof renderRankRewards === 'function')
        ? renderRankRewards(peak)
        : { html:'', earned:0, total:4 };
      const rewardsBlock = _rw.html ? `
        <div class="rh-section">
          <div class="rh-section-head">
            <div class="rh-section-title">🎁 RANK REWARDS</div>
            <div class="rh-section-sub">${_rw.earned}/${_rw.total} banners earned</div>
          </div>
          ${_rw.html}
        </div>` : '';

      // ── RECENT RANKED MATCHES ──
      // Latest 5 ranked matches with the RP delta, opponents, and
      // when it happened. Pulled from user.matchHistory (server stores
      // the last 20 entries), filtered to RANKED room type. Lets the
      // player see their momentum at a glance.
      const allHistory = Array.isArray(u.matchHistory) ? u.matchHistory : [];
      const rankedHistory = allHistory.filter(m => m.roomType === 'RANKED').slice(0, 5);
      const histTimeAgo = (ts) => {
        if(!ts) return '';
        const diff = Date.now() - ts;
        if(diff < 60_000) return 'just now';
        if(diff < 3_600_000) return Math.floor(diff/60_000) + 'm ago';
        if(diff < 86_400_000) return Math.floor(diff/3_600_000) + 'h ago';
        return Math.floor(diff/86_400_000) + 'd ago';
      };
      const historyBlock = rankedHistory.length ? `
        <div class="rh-section">
          <div class="rh-section-head">
            <div class="rh-section-title">📜 RECENT BATTLES</div>
            <div class="rh-section-sub">Last 5 ranked matches</div>
          </div>
          <div class="rh-history">
            ${rankedHistory.map(m => {
              const rp = m.rpChange || 0;
              const sign = rp > 0 ? '+' : '';
              const cls = rp > 0 ? 'win' : rp < 0 ? 'loss' : 'draw';
              const opp = (m.opponents || []).slice(0, 2).map(esc).join(', ') + ((m.opponents || []).length > 2 ? ' …' : '');
              return `
                <div class="rh-match rh-match-${cls}">
                  <div class="rh-match-tag">${m.won ? 'WIN' : 'LOSS'}</div>
                  <div class="rh-match-info">
                    <div class="rh-match-vs">vs ${opp || '?'}</div>
                    <div class="rh-match-time">${histTimeAgo(m.at)}</div>
                  </div>
                  <div class="rh-match-rp">${rp ? sign+rp+' RP' : '—'}</div>
                </div>`;
            }).join('')}
          </div>
        </div>` : '';

      // ── PODIUM — top 3 players in a coliseum-style ranked podium ──
      const lbList = (lb.leaderboard || []);
      const top3   = lbList.slice(0, 3);
      const rest   = lbList.slice(3, 10);
      // Podium positions: silver (left), gold (center), bronze (right)
      const podiumHTML = top3.length ? (() => {
        const slot = (idx, podiumClass, label, medal, color) => {
          const r = top3[idx];
          if(!r) return `<div class="rh-podium-slot ${podiumClass} rh-podium-empty"><div class="rh-podium-medal">${medal}</div><div class="rh-podium-label">${label}</div></div>`;
          const isMe = r.username === u.username;
          const clk = r.id ? ` onclick="if(typeof showOpponentProfile==='function')showOpponentProfile('${esc(r.id)}')" style="cursor:pointer" title="View ${esc(r.username)}'s profile"` : '';
          return `<div class="rh-podium-slot ${podiumClass} ${isMe?'is-me':''}"${clk}>
            <div class="rh-podium-medal">${medal}</div>
            <div class="rh-podium-name">${esc(r.username)}${verifiedBadgeHTML(r.username,{size:'xs'})}${isMe?' <span style="color:#FBBF24">(You)</span>':''}</div>
            <div class="rh-podium-rp" style="color:${color}">${r.rankPoints.toLocaleString()} RP</div>
            <div class="rh-podium-tier">${r.badge} ${esc(r.label || r.league || '')}</div>
          </div>`;
        };
        return `<div class="rh-podium">
          ${slot(1, 'rh-podium-2nd', '2ND',  '🥈', '#C0C0C0')}
          ${slot(0, 'rh-podium-1st', 'CHAMPION', '🥇', '#FFD700')}
          ${slot(2, 'rh-podium-3rd', '3RD',  '🥉', '#CD7F32')}
        </div>`;
      })() : '';
      const restHTML = rest.length ? `
        <div class="rh-lb-rest">
          ${rest.map(r => {
            const isMe = r.username === u.username;
            const clk = r.id ? ` onclick="if(typeof showOpponentProfile==='function')showOpponentProfile('${esc(r.id)}')" style="cursor:pointer" title="View ${esc(r.username)}'s profile"` : '';
            return `<div class="rh-lb-row ${isMe?'is-me':''}"${clk}>
              <div class="rh-lb-rank">#${r.rank}</div>
              <div class="rh-lb-name">${esc(r.username)}${verifiedBadgeHTML(r.username,{size:'xs'})}${isMe?' <span style="color:#FBBF24;font-size:9px">(YOU)</span>':''}<div class="rh-lb-tier">${r.badge} ${esc(r.label || r.league || '')} · ${r.gamesWon}W</div></div>
              <div class="rh-lb-rp" style="color:${r.color||'#FBBF24'}">${r.rankPoints.toLocaleString()}</div>
            </div>`;
          }).join('')}
        </div>` : '';
      const lbBlock = (top3.length || rest.length) ? `
        <div class="rh-section">
          <div class="rh-section-head">
            <div class="rh-section-title">🏆 SEASON ${season.seasonId || 1} CHAMPIONS</div>
            <div class="rh-section-sub">Top of the ladder</div>
          </div>
          ${podiumHTML}
          ${restHTML}
        </div>` : `
        <div class="rh-section">
          <div class="rh-section-head">
            <div class="rh-section-title">🏆 SEASON ${season.seasonId || 1} CHAMPIONS</div>
          </div>
          <div class="rh-lb-empty">No-one has finished placement yet — be the first to claim the throne!</div>
        </div>`;

      const closeBtn = `<button class="rh-close" onclick="document.getElementById('rankedHubOv').classList.remove('show')" aria-label="Close">×</button>`;

      body.innerHTML = `
        ${closeBtn}
        <div class="rh-shell">
          ${heroBlock}
          ${promoAlert}
          ${streakBlock}
          ${seasonPill}
          ${dcWarning}
          ${statsRow}
          ${playBtn}
          ${rewardsBlock}
          ${climbBlock}
          ${historyBlock}
          ${lbBlock}
        </div>
      `;

      // Live season countdown — ticks once a second so the player feels
      // the timer breathing down. Cleared when the modal closes.
      _startRhCountdown(season.endsAt || 0);
    } catch(e){
      console.warn('[Ranked] showRanked failed:', e);
      body.innerHTML = `<div class="rh-err">Could not summon the arena. <a href="#" onclick="event.preventDefault();showRanked()">Try again</a></div>`;
    }
  }

  // Live season-end countdown that re-runs every second across the
  // panel. Stops when the modal closes.
  let _rhCdInt = null;
  function _startRhCountdown(endsAt){
    if(_rhCdInt){ clearInterval(_rhCdInt); _rhCdInt = null; }
    const tick = () => {
      const ov = document.getElementById('rankedHubOv');
      if(!ov?.classList.contains('show')){
        if(_rhCdInt){ clearInterval(_rhCdInt); _rhCdInt = null; }
        return;
      }
      const left = Math.max(0, endsAt - Date.now());
      document.querySelectorAll('[data-rh-cd]').forEach(el => {
        el.textContent = fmtCountdown(left);
      });
    };
    tick();
    _rhCdInt = setInterval(tick, 1000);
  }
  window.showRanked = showRanked;

  // ════════════════════════════════════════════════════════════════════════
  //  RANKED READY — the pre-match screen (like big competitive games): your
  //  badge, RP, points to the next tier, season record, entry fee, and the
  //  Bronze→GM ladder — then START begins the queue. Same premium design
  //  system as the ranked RESULT screen (.rmo-* / .wr-* in main.css).
  // ════════════════════════════════════════════════════════════════════════
  const _RR_ENTRY = { Placement:500, Bronze:800, Silver:1200, Gold:1800, Platinum:2500, Diamond:5000, Master:10000, Grandmaster:25000 };  // mirrors server RANKED_ENTRY_BY_TIER
  function showRankedReady(){
    const u = S.user || {};
    const tp = window._rankedTierProgress, tiers = window._rankedTiers || [];
    if(typeof tp !== 'function'){ return quickJoin('RANKED'); }         // helpers missing → old flow
    document.getElementById('rankedReadyOv')?.remove();
    const inPlace = (u.placementGamesPlayed || 0) < 5;
    const rp    = u.rankPoints || 0;
    const prog  = tp(rp);
    const tier  = inPlace ? { name:'Placement', badge:'🎯', color:'#C4B5FD' } : prog.tier;
    const tc    = tier.color || '#B9F2FF';
    const div   = prog.pct>=75?'I':prog.pct>=50?'II':prog.pct>=25?'III':'IV';
    const nextTier = tiers[prog.idx+1] || null;
    const toNext   = nextTier ? Math.max(0, nextTier.min - rp) : 0;
    const entry = _RR_ENTRY[tier.name] ?? 800;
    const canPay = (u.coins || 0) >= entry;
    const wins = u.rankedWins||0, losses = u.rankedLosses||0;
    const wrate = (wins+losses)>0 ? Math.round(wins/(wins+losses)*100) : 0;
    const streak = u.winStreak||0;

    const emb = (name,c) => (typeof window._rankEmblemHTML==='function') ? window._rankEmblemHTML(name,c)
                          : (typeof window._rankEmblemSVG==='function') ? window._rankEmblemSVG(c) : null;
    // CAREER-HIGH MEMORY — the highest tier ever reached this season. Peak RP
    // never drops (server preserves it), so even after demotions the player
    // always sees "you reached Master" as a permanent badge of pride.
    const peakRP   = Math.max(u.peakRankPoints || 0, rp);
    const peakTier = (typeof window._rankedTierForRP === 'function')
      ? window._rankedTierForRP(peakRP)
      : [...tiers].reverse().find(t => peakRP >= (t.min||0)) || tiers[0];
    // Show the memory only once they've actually climbed above their current
    // standing (i.e. they've been demoted) — otherwise it's redundant.
    const showPeakMemory = !inPlace && peakTier && peakRP > rp + 20 &&
      (peakTier.name !== tier.name);
    const peakMemoryHTML = showPeakMemory ? `
      <div class="rr-peak" title="Your highest rank this season — kept as a memory even after demotions">
        <span class="rr-peak-ic">${emb(peakTier.name, peakTier.color)||peakTier.badge||'🏅'}</span>
        <span class="rr-peak-txt"><b>Career High</b><span style="color:${peakTier.color}">${esc(peakTier.name)}</span></span>
        <span class="rr-peak-rp">${peakRP.toLocaleString()} RP</span>
      </div>` : '';
    const hero = inPlace
      ? `<div class="wr-badge-wrap" style="--tc:#9F70FD"><div class="wr-badge-rings"></div><div class="wr-badge">🎯</div></div>
         <div class="wr-tier-name" style="color:#C4B5FD">PLACEMENT ${u.placementGamesPlayed||0}/5</div>
         <div class="wr-prog-sub">Win your first 5 ranked matches to earn a tier</div>`
      : `<div class="wr-badge-wrap" style="--tc:${tc}"><div class="wr-badge-rings"></div><div class="wr-badge">${emb(tier.name,tc)||tier.badge||'🎖️'}</div></div>
         <div class="wr-tier-name" style="color:${tc}">${esc((tier.name||'').toUpperCase())} ${div}</div>
         <div class="wr-prog-label">Rank Progress</div>
         <div class="wr-prog"><div class="wr-bar"><div class="wr-bar-fill" style="width:${prog.pct}%"></div></div></div>
         ${nextTier ? `<div class="wr-delta" style="color:#7ee787;font-size:22px">${toNext.toLocaleString()} RP</div><div class="wr-prog-sub">to ${nextTier.badge} ${esc(nextTier.name)}</div>` : `<div class="wr-prog-sub">Top of the ladder — defend the throne 👑</div>`}
         <div class="wr-msg">${rp.toLocaleString()} RP · Peak ${(u.peakRankPoints||rp).toLocaleString()}<span id="rrLadderPos"></span></div>`;

    const ladder = tiers.map(t=>{
      const on = !inPlace && t.name === prog.tier.name;
      return `<div class="wr-tier ${on?'on':''}" style="--tc:${t.color}"><span class="wr-tier-badge">${emb(t.name,t.color)||t.badge}</span><span class="wr-tier-lbl">${t.name}</span><span class="wr-tier-pct">${on?prog.pct+'%':'0%'}</span></div>`;
    }).join('');

    const ov = document.createElement('div');
    ov.id = 'rankedReadyOv';
    ov.className = 'rmo-premium rr-throne';
    ov.innerHTML = `
      <div class="rmo-scroll">
        <div class="wr-header rmo-header"><div class="wr-header-badge" style="--tc:${tc}">${(!inPlace&&emb(tier.name,tc))||tier.badge||'🎖️'}</div><div><div class="wr-header-title">Ranked</div><div class="wr-header-sub" style="color:${tc}">${inPlace?'Placement matches':esc(tier.name)+' Division'}</div></div></div>
        <div class="rmo-title w">RANKED</div>
        <div class="rmo-sub">2v2 to 41 &nbsp;•&nbsp; Win together, climb together</div>
        <div class="rr-season-line" id="rrSeasonLine" style="display:none"><span class="rr-orn">─❖─</span><span id="rrSeason"></span><span class="rr-orn">─❖─</span></div>
        <div class="win-ranked" style="display:flex">
          <div class="wr-grid">
            <div class="wr-col">
              <div class="wr-card"><div class="wr-card-h">📈 My Season</div><div class="wr-stats">
                <div class="wr-stat"><div class="wr-stat-val" style="color:#7ee787">${wins}</div><div class="wr-stat-lbl">Wins</div></div>
                <div class="wr-stat"><div class="wr-stat-val" style="color:#ff9b9b">${losses}</div><div class="wr-stat-lbl">Losses</div></div>
                <div class="wr-stat"><div class="wr-stat-val">${wrate}%</div><div class="wr-stat-lbl">Win Rate</div></div>
                <div class="wr-stat"><div class="wr-stat-val">${streak}${streak>=2?' 🔥':''}</div><div class="wr-stat-lbl">Win Streak</div></div>
              </div>
              <div class="rr-wrbar"><div style="width:${wrate}%"></div></div>
              <div class="rr-wrbar-lbl">Season win rate</div></div>
            </div>
            <div class="wr-hero">${hero}${peakMemoryHTML}</div>
            <div class="wr-col">
              <div class="wr-card"><div class="wr-card-h">🎟️ Match Info</div><div class="wr-breakdown">
                <div class="wr-row"><span class="wr-row-ic">🪙</span><span class="wr-row-lbl">Entry</span><span class="wr-row-val ${canPay?'zero':'neg'}">${entry.toLocaleString()}</span></div>
                <div class="wr-row"><span class="wr-row-ic">🏆</span><span class="wr-row-lbl">Winners take the prize</span><span class="wr-row-val pos">2v2</span></div>
                <div class="wr-row"><span class="wr-row-ic">⚖️</span><span class="wr-row-lbl">Fair matchmaking</span><span class="wr-row-val zero">±200 RP</span></div>
                ${streak>=2?`<div class="wr-row wr-row-streak"><span class="wr-row-ic">🔥</span><span class="wr-row-lbl">${streak} Win Streak — bonus RP active</span><span class="wr-row-val streak">ON FIRE</span></div>`:''}
              </div></div>
              ${!canPay?`<div class="wr-card" style="border-color:rgba(255,107,107,.4)"><div class="wr-result-meta" style="color:#ff9b9b">Not enough coins for the entry (${entry.toLocaleString()} 🪙) — you have ${(u.coins||0).toLocaleString()}.</div></div>`:''}
            </div>
          </div>
          <div class="wr-ladder" style="--ladder-fill:${inPlace ? 0 : Math.round((prog.idx / Math.max(1, tiers.length - 1)) * 100)}">${ladder}</div>
          <div class="wr-tip">💡 Tip: the bigger your winning score margin, the more RP you earn.</div>
        </div>
        <div class="rmo-actions">
          <button class="rmo-btn rmo-btn-secondary" onclick="closeRankedReady()">Back</button>
          <button class="rmo-btn rmo-btn-primary rr-start" ${canPay?'':'disabled style="opacity:.55;cursor:default"'} onclick="startRankedReady()">⚔ START RANKED MATCH ⚔</button>
          <button class="rmo-btn rmo-btn-blue" onclick="closeRankedReady(); if(typeof showRanked==='function') showRanked()">🏆 Season & Champions</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>ov.classList.add('show'));
    // Live server data — real season countdown + your REAL ladder position.
    // Async so the screen opens instantly; the spans fill when the data lands.
    apiFetch('/api/ranked/season', { timeout: 6000 }).then(sn=>{
      const el = document.getElementById('rrSeason');
      if(!el || !sn?.endsAt) return;
      const days = Math.max(0, Math.ceil((sn.endsAt - Date.now()) / 86400000));
      el.textContent = `Season ${sn.seasonId || 1} ends in ${days}d`;
      const line = document.getElementById('rrSeasonLine'); if(line) line.style.display = '';
    }).catch(()=>{});
    apiFetch('/api/leaderboard/board?type=global', { timeout: 6000 }).then(d=>{
      const el = document.getElementById('rrLadderPos');
      if(!el || !d?.me?.rank) return;
      el.textContent = ` · #${d.me.rank} on the ladder`;
    }).catch(()=>{});
  }
  function closeRankedReady(){ const o=document.getElementById('rankedReadyOv'); if(o){ o.classList.remove('show'); setTimeout(()=>o.remove(),250); } }
  function startRankedReady(){ closeRankedReady(); if(typeof quickJoin==='function') quickJoin('RANKED'); }
  window.showRankedReady  = showRankedReady;
  window.closeRankedReady = closeRankedReady;
  window.startRankedReady = startRankedReady;

  async function showRankedLb(){
    try{
      const data = await apiFetch('/api/leaderboard/ranked');
      const list = data.leaderboard || [];
      const myId = S.user?.id;
      document.getElementById('rankedLbList').innerHTML = list.map(r => `
        <div class="ranked-row ${r.username===S.user?.username?'me':''}">
          <div class="ranked-rank ${r.rank===1?'gold':r.rank===2?'silver':r.rank===3?'bronze':''}">${r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank}</div>
          <div class="ranked-name">${esc(r.username)}${verifiedBadgeHTML(r.username,{size:'xs'})}<br><span style="font-size:10px;color:var(--muted)">${r.badge} ${r.league}</span></div>
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
    _ensureTournHubStyles();
    document.getElementById('tournOv').classList.add('show');
    _renderTournamentsList([], true); // loading state
    try{
      const data = await apiFetch('/api/tournaments');
      _renderTournamentsList(data.tournaments || [], false);
    } catch(e){
      _renderTournamentsList([], false, 'Could not load tournaments');
    }
  }

  // Categorize a tournament by entry stake — drives the colored TIER
  // band the card lives under (BRONZE → SILVER → GOLD → DIAMOND).
  function _tournTier(t){
    const stake = (t.entryFee || 0) + (t.pot || t.prizeCoins || 0);
    if(stake >= 10000) return { key:'diamond', label:'DIAMOND CUP', icon:'💎', accent:'#22D3EE', glow:'rgba(34,211,238,.55)' };
    if(stake >= 2000)  return { key:'gold',    label:'GOLD CUP',    icon:'🥇', accent:'#FBBF24', glow:'rgba(251,191,36,.55)' };
    if(stake >= 500)   return { key:'silver',  label:'SILVER CUP',  icon:'🥈', accent:'#D1D5DB', glow:'rgba(209,213,219,.45)' };
    return                  { key:'bronze',  label:'BRONZE CUP',  icon:'🥉', accent:'#F59E0B', glow:'rgba(245,158,11,.45)' };
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

    // ── LIVE STATS — computed across the FULL list, not the filter ──
    const all = rawList || [];
    const totalPlayers = all.reduce((s,t)=> s + (t.players?.length||0), 0);
    const totalPool    = all.reduce((s,t)=> s + (t.pot || t.prizeCoins || 0), 0);
    const playingNow   = counts.playing;
    const biggestPot   = all.length ? Math.max(...all.map(t => t.pot || t.prizeCoins || 0)) : 0;

    // ── FEATURED SPOTLIGHT — the OPEN tournament with the biggest pot ──
    const openList    = all.filter(t => t.status === 'open' && (t.players?.length||0) < (t.maxPlayers||0));
    const featured    = openList.sort((a,b) => (b.pot||b.prizeCoins||0) - (a.pot||a.prizeCoins||0))[0];

    // ── BODY: hero + featured + actions + filter + grouped cards ──
    let body;
    if(loading){
      body = `<div class="th-loading"><div class="th-spinner"></div><div class="th-loading-text">Summoning the arena…</div></div>`;
    } else if(errMsg){
      body = `<div class="th-err">⚠️ ${esc(errMsg)}<br><a href="#" onclick="event.preventDefault();showTournaments()">Try again</a></div>`;
    } else {
      // Group tournaments by tier for visual hierarchy.
      const grouped = { diamond:[], gold:[], silver:[], bronze:[] };
      list.forEach(t => { const tier = _tournTier(t); grouped[tier.key].push(t); });
      let groups = '';
      const tierOrder = ['diamond','gold','silver','bronze'];
      const tierMeta = {
        diamond:{ label:'💎 DIAMOND CUPS', accent:'#22D3EE', sub:'High-stakes — for the fearless' },
        gold:   { label:'🥇 GOLD CUPS',    accent:'#FBBF24', sub:'Mid-stake elite — top prizes' },
        silver: { label:'🥈 SILVER CUPS',  accent:'#D1D5DB', sub:'Worthy competition — fair pots' },
        bronze: { label:'🥉 BRONZE CUPS',  accent:'#F59E0B', sub:'Warm up — low entry, fast games' },
      };
      tierOrder.forEach(k => {
        if(!grouped[k].length) return;
        const m = tierMeta[k];
        groups += `<div class="th-tier">
          <div class="th-tier-head">
            <div class="th-tier-bar" style="background:linear-gradient(90deg,${m.accent},transparent)"></div>
            <div class="th-tier-title" style="color:${m.accent}">${m.label}</div>
            <div class="th-tier-sub">${m.sub}</div>
          </div>
          <div class="th-tier-grid">${grouped[k].map(t=>_tournamentCardHTML(t)).join('')}</div>
        </div>`;
      });
      if(!list.length){
        const emptyMsg = filter==='mine' ? 'You haven\'t joined or hosted any tournament yet.'
                        : filter==='open' ? 'No open tournaments right now — be the first to host one and call out the realm.'
                        : filter==='playing' ? 'Nothing in battle right now. Open tournaments will appear here once they kick off.'
                        : 'The arena is quiet. Be the first champion — host a cup and stake the prize.';
        groups = `<div class="th-empty">
          <div class="th-empty-trophy">🏆</div>
          <div class="th-empty-title">The arena awaits</div>
          <div class="th-empty-sub">${emptyMsg}</div>
          <button class="th-empty-btn" onclick="showCreateTournamentModal()">＋ Host a Tournament</button>
        </div>`;
      }
      body = groups;
    }

    const tab = (k,lbl,emoji) => `<button class="th-tab ${filter===k?'on':''}" onclick="_setTournFilter('${k}')">
      <span class="th-tab-emoji">${emoji}</span>${lbl}<span class="th-tab-n">${counts[k]}</span></button>`;

    const featuredHTML = (!loading && !errMsg && featured) ? _featuredSpotlightHTML(featured) : '';

    box.innerHTML = `
      <div class="th-shell">
        <button class="th-close" onclick="document.getElementById('tournOv').classList.remove('show')" aria-label="Close">✕</button>

        <!-- HERO -->
        <div class="th-hero">
          <div class="th-hero-trophy">🏆</div>
          <div class="th-hero-eyebrow">⚔️  TOURNAMENTS HUB  ⚔️</div>
          <div class="th-hero-title">FIGHT FOR GLORY</div>
          <div class="th-hero-sub">Enter with coins · Build your bracket · Take the crown.</div>
        </div>

        <!-- LIVE STATS -->
        <div class="th-stats">
          <div class="th-stat th-stat-1">
            <div class="th-stat-val">${all.length}</div>
            <div class="th-stat-lbl">Active Cups</div>
          </div>
          <div class="th-stat th-stat-2">
            <div class="th-stat-val">${totalPlayers}</div>
            <div class="th-stat-lbl">Competing</div>
          </div>
          <div class="th-stat th-stat-3">
            <div class="th-stat-val">🪙 ${totalPool.toLocaleString()}</div>
            <div class="th-stat-lbl">Total Prize Pool</div>
          </div>
          <div class="th-stat th-stat-4">
            <div class="th-stat-val">🪙 ${biggestPot.toLocaleString()}</div>
            <div class="th-stat-lbl">Biggest Prize</div>
          </div>
        </div>

        ${featuredHTML}

        <!-- QUICK ACTIONS -->
        <div class="th-actions">
          <button class="th-action th-action-create" onclick="showCreateTournamentModal()">
            <span class="th-action-icon">＋</span>
            <span class="th-action-txt"><b>Host</b><span>your own cup</span></span>
          </button>
          <button class="th-action th-action-quick" onclick="_quickJoinTournament()">
            <span class="th-action-icon">⚡</span>
            <span class="th-action-txt"><b>Quick Join</b><span>open seats now</span></span>
          </button>
          <button class="th-action th-action-rules" onclick="_showTournRules()">
            <span class="th-action-icon">📖</span>
            <span class="th-action-txt"><b>How It Works</b><span>read the rules</span></span>
          </button>
        </div>

        <!-- FILTERS -->
        <div class="th-tabs">
          ${tab('all','All','📜')}${tab('open','Open','🟢')}${tab('playing','Live','⚔️')}${tab('mine','Mine','⭐')}
        </div>

        <!-- BODY -->
        <div class="th-body">${body}</div>
      </div>
    `;
  }

  /* The FEATURED SPOTLIGHT — top-of-page hero card for the highest-pot
   * open tournament. Animated gold glow, big prize, fill bar, one-tap
   * Register CTA. */
  function _featuredSpotlightHTML(t){
    const me   = S.user?.id;
    const tier = _tournTier(t);
    const filled = t.players.length;
    const total  = t.maxPlayers;
    const pct    = Math.max(6, Math.round(filled / total * 100));
    const pot    = t.pot != null ? t.pot : t.prizeCoins;
    const registered = !!t.players.find(p=>p.id===me);
    const isCreator  = t.creatorId === me;
    let cta;
    if(isCreator && filled >= 2){
      cta = `<button class="th-feat-cta" onclick="event.stopPropagation();doStartTournament('${t.id}')">⚔️ START NOW</button>`;
    } else if(registered){
      cta = `<div class="th-feat-cta th-feat-cta-wait">✅ You're registered — waiting for tip-off</div>`;
    } else if(filled >= total){
      cta = `<div class="th-feat-cta th-feat-cta-wait">Cup is full — battle imminent</div>`;
    } else {
      const feeLbl = t.entryFee > 0 ? ` · 🪙 ${t.entryFee.toLocaleString()}` : ' · FREE';
      cta = `<button class="th-feat-cta" onclick="event.stopPropagation();doJoinTournamentId('${t.id}')">🏆 REGISTER${feeLbl}</button>`;
    }
    return `<div class="th-featured" style="--th-feat-accent:${tier.accent};--th-feat-glow:${tier.glow}">
      <div class="th-feat-shine"></div>
      <div class="th-feat-eyebrow">
        <span class="th-feat-eyebrow-dot"></span>
        FEATURED  ·  ${tier.icon} ${tier.label}
      </div>
      <div class="th-feat-row">
        <div class="th-feat-info">
          <div class="th-feat-name">${esc(t.name)}</div>
          <div class="th-feat-meta">${filled}/${total} players · ${total-filled} seat${(total-filled)===1?'':'s'} open</div>
          <div class="th-feat-bar"><div class="th-feat-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="th-feat-prize">
          <div class="th-feat-prize-eyebrow">PRIZE POOL</div>
          <div class="th-feat-prize-val">🪙 ${pot.toLocaleString()}</div>
        </div>
      </div>
      ${cta}
    </div>`;
  }

  // Auto-join the best open tournament — picks the one with the most
  // players already registered (most likely to start), tie-breaks on pot.
  async function _quickJoinTournament(){
    const list = Tourn.lastList || [];
    const me = S.user?.id;
    const open = list.filter(t => t.status === 'open'
                              && (t.players?.length||0) < (t.maxPlayers||0)
                              && !t.players.find(p=>p.id===me));
    if(!open.length){
      toast('No open seats right now — try creating one!','i');
      return;
    }
    open.sort((a,b) => {
      const pa = a.players?.length||0, pb = b.players?.length||0;
      if(pb !== pa) return pb - pa;
      return (b.pot||b.prizeCoins||0) - (a.pot||a.prizeCoins||0);
    });
    return doJoinTournamentId(open[0].id);
  }

  function _showTournRules(){
    const old = document.getElementById('thRulesModal'); if(old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'thRulesModal';
    ov.className = 'th-rules-ov';
    ov.innerHTML = `
      <div class="th-rules-box">
        <button class="th-rules-x" onclick="document.getElementById('thRulesModal').remove()">✕</button>
        <div class="th-rules-eyebrow">📖 HOW IT WORKS</div>
        <div class="th-rules-title">Tournament Rules</div>
        <div class="th-rules-list">
          <div class="th-rule"><span class="th-rule-n">1</span><div><b>Host a cup</b> — set name, size (2/4/8/16), entry fee &amp; stake the prize.</div></div>
          <div class="th-rule"><span class="th-rule-n">2</span><div><b>Players register</b> — every entry fee paid grows the prize pool.</div></div>
          <div class="th-rule"><span class="th-rule-n">3</span><div><b>Empty seats fill with AI bots</b> on start — your cup never stalls.</div></div>
          <div class="th-rule"><span class="th-rule-n">4</span><div><b>Single-elimination bracket</b> — win to advance, lose &amp; you're out.</div></div>
          <div class="th-rule"><span class="th-rule-n">5</span><div><b>Champion takes the entire pot</b> — winner-takes-all, no consolation prizes.</div></div>
        </div>
        <div class="th-rules-tip">💡 Tier is set by the total stake. Bigger pot = higher tier = louder crown.</div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
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
    const tier = _tournTier(t);
    const statusBadge = t.status==='open'
      ? `<span class="th-card-status open">🟢 OPEN</span>`
      : t.status==='playing'
        ? `<span class="th-card-status playing">⚔️ ROUND ${t.round}</span>`
        : `<span class="th-card-status done">🏆 ENDED</span>`;
    let action = '';
    if(t.status==='open'){
      if(isCreator && t.players.length>=2){
        action = `<button class="th-card-cta th-card-cta-start" onclick="event.stopPropagation();doStartTournament('${t.id}')">⚔️ START NOW${t.players.length<t.maxPlayers?' · bots fill':''}</button>`;
      } else if(registered){
        action = `<div class="th-card-cta th-card-cta-wait">✅ Registered — tip-off pending</div>`;
      } else if(!isFull){
        const feeLbl = t.entryFee>0 ? ` · 🪙 ${t.entryFee.toLocaleString()}` : ' · FREE';
        action = `<button class="th-card-cta th-card-cta-join" onclick="event.stopPropagation();doJoinTournamentId('${t.id}')">🏆 REGISTER${feeLbl}</button>`;
      } else {
        action = `<div class="th-card-cta th-card-cta-wait">⏳ Cup is full</div>`;
      }
    } else if(t.status==='playing'){
      action = registered
        ? `<div class="th-card-cta th-card-cta-live">⚔️ Your match is live</div>`
        : `<div class="th-card-cta th-card-cta-wait">⚔️ Round ${t.round} in progress</div>`;
    } else if(t.status==='finished'){
      action = `<div class="th-card-cta th-card-cta-wait">🏆 Champion: ${esc(t.winner?.username||'?')}</div>`;
    }
    const creator = t.creatorId ? (t.players.find(p=>p.id===t.creatorId)?.username || 'someone') : 'system';
    const pot = t.pot != null ? t.pot : t.prizeCoins;
    const filled = t.players.length;
    const total = t.maxPlayers;
    const pct = filled === 0 ? 0 : Math.max(8, Math.round(filled / total * 100));

    // Up to 4 player avatar chips + a "+N" overflow.
    const avChips = t.players.slice(0, 4).map(p => {
      const isBot = !!p.isBot;
      const isMe = p.id === me;
      const initial = esc((p.username||'?').charAt(0).toUpperCase());
      return `<div class="th-card-av ${isMe?'me':''} ${isBot?'bot':''}" title="${esc(p.username||'')}">${initial}</div>`;
    }).join('');
    const moreChip = filled > 4 ? `<div class="th-card-av more">+${filled-4}</div>` : '';
    const emptyChips = Array(Math.max(0, total - filled)).fill('<div class="th-card-av empty">·</div>').join('');
    const bracketHTML = expanded ? _tournamentBracketHTML(t) : '';

    return `<div class="th-card ${expanded?'open':''} th-card-${tier.key}"
                 style="--th-card-accent:${tier.accent};--th-card-glow:${tier.glow}"
                 onclick="_toggleTournBracket('${t.id}')">
      <div class="th-card-tier"><span>${tier.icon}</span>${tier.label}</div>
      <div class="th-card-head">
        <div class="th-card-name">${esc(t.name)}</div>
        ${statusBadge}
      </div>
      <div class="th-card-pot">
        <div class="th-card-pot-lbl">PRIZE POOL</div>
        <div class="th-card-pot-val">🪙 ${pot.toLocaleString()}</div>
        ${t.entryFee>0 ? `<div class="th-card-pot-fee">Entry · 🪙 ${t.entryFee.toLocaleString()}</div>` : `<div class="th-card-pot-fee free">Free entry</div>`}
      </div>
      <div class="th-card-players">
        <div class="th-card-av-row">${avChips}${moreChip}${emptyChips}</div>
        <div class="th-card-fill">
          <div class="th-card-fill-bar"><div class="th-card-fill-cur" style="width:${pct}%"></div></div>
          <div class="th-card-fill-lbl">${filled}/${total} players · Host <b>${esc(creator)}</b></div>
        </div>
      </div>
      ${action}
      ${bracketHTML}
      <div class="th-card-expand">${expanded?'▴ HIDE BRACKET':'▾ BRACKET & PLAYERS'}</div>
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
        <div class="fg"><label>Tournament Name</label><input id="ctName" type="text" placeholder="My Cardora Cup" maxlength="30"/></div>
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
        <div style="font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin:-4px 0 14px;line-height:1.55">You put up the prize (you have <b style="color:#FFD700">${coins.toLocaleString()}🪙</b>). Every player who joins pays the entry fee — it grows the prize pool. Empty slots fill with AI bots on start. <b style="color:#fff">Winner takes the full prize.</b></div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('createTournModal').remove()" style="flex:0 0 auto;padding:13px 22px;background:transparent;border:1.5px solid rgba(255,255,255,.12);border-radius:11px;color:rgba(255,255,255,.65);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">Cancel</button>
          <button class="btnP" style="flex:1" onclick="doCreateTournament()">⚔️ Create</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    setTimeout(()=>document.getElementById('ctName')?.focus(),60);
  }

  /* Injects all the new Tournaments-Hub styles (th-*) the first time
   * the overlay opens. One stylesheet, idempotent. */
  /* Injects the cinematic RANKED-hub stylesheet — idempotent. The hub
   * lives inside the existing #rankedHubOv modal but completely owns
   * its interior with rh-* classes. */
  function _ensureRankedHubStyles(){
    if(document.getElementById('rhHubStyles')) return;
    const s = document.createElement('style');
    s.id = 'rhHubStyles';
    s.textContent = `
      /* ═══ RANKED HUB — cinematic arena layout ═══ */
      #rankedHubOv .mbox{
        width:min(720px, 96vw) !important;
        max-height:92vh !important;
        padding:0 !important;
        background:linear-gradient(180deg, #0B0E20 0%, #050816 100%) !important;
        border:1px solid rgba(251,191,36,.18) !important;
        box-shadow:
          0 50px 120px rgba(0,0,0,.85),
          0 0 60px rgba(251,191,36,.10),
          inset 0 1px 0 rgba(255,255,255,.06) !important;
      }
      #rankedHubOv #rankedHubBody{ padding:0 !important; position:relative; }

      .rh-shell{ position:relative; padding:0 0 22px; }

      .rh-close{
        position:absolute; top:14px; right:14px; z-index:40;
        width:38px; height:38px; border-radius:50%;
        background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.12);
        color:rgba(255,255,255,.8); cursor:pointer; font-size:18px; line-height:1;
        display:flex; align-items:center; justify-content:center;
        transition:background .2s, transform .25s, border-color .2s, color .2s;
      }
      .rh-close:hover{
        background:linear-gradient(135deg,#E8324A,#991B1B); color:#fff;
        transform:rotate(90deg); border-color:#E8324A;
      }

      /* ── LOADING ── */
      .rh-load{
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:60px 24px;
      }
      .rh-load-emblem{
        font-size:48px; margin-bottom:14px;
        filter:drop-shadow(0 6px 18px rgba(251,191,36,.45));
        animation:rhLoadSpin 1.6s ease-in-out infinite;
      }
      @keyframes rhLoadSpin{ 50%{ transform:scale(1.12) rotate(8deg); } }
      .rh-load-title{
        font-family:'Outfit',sans-serif;
        font-size:12px; font-weight:900; letter-spacing:3px;
        color:rgba(255,255,255,.6); margin-bottom:14px;
      }
      .rh-load-bar{
        width:200px; height:4px; border-radius:99px;
        background:rgba(255,255,255,.06); overflow:hidden;
      }
      .rh-load-bar span{
        display:block; width:40%; height:100%;
        background:linear-gradient(90deg, transparent, #FBBF24, transparent);
        animation:rhLoadSweep 1.4s ease-in-out infinite;
      }
      @keyframes rhLoadSweep{
        0%  { transform:translateX(-100%); }
        100%{ transform:translateX(300%); }
      }

      /* ── HERO — emblem + RP + progress in a spotlit arena ── */
      .rh-hero{
        position:relative; overflow:hidden;
        text-align:center;
        padding:40px 24px 26px;
      }
      .rh-hero-bg{
        position:absolute; inset:0;
        background:
          radial-gradient(ellipse 80% 70% at 50% 0%, color-mix(in srgb, var(--rh-accent) 28%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 50% 100%, rgba(232,50,74,.18) 0%, transparent 70%);
        pointer-events:none;
      }
      .rh-hero-spotlight{
        position:absolute; top:0; bottom:0; width:50%;
        pointer-events:none;
        background:linear-gradient(180deg, color-mix(in srgb, var(--rh-accent) 12%, transparent) 0%, transparent 70%);
        filter:blur(4px);
        animation:rhSpotSweep 4.6s ease-in-out infinite;
      }
      .rh-spot-l{ left:0;  transform-origin:bottom right; transform:rotate(-8deg) translateX(-15%); }
      .rh-spot-r{ right:0; transform-origin:bottom left;  transform:rotate( 8deg) translateX( 15%); animation-delay:-2.3s; }
      @keyframes rhSpotSweep{ 50%{ opacity:.4; } }

      .rh-hero-stage{
        position:relative;
        width:140px; height:140px;
        margin:0 auto 14px;
        display:flex; align-items:center; justify-content:center;
      }
      .rh-hero-ring{
        position:absolute; inset:0;
        border-radius:50%;
        border:2px solid color-mix(in srgb, var(--rh-accent) 60%, transparent);
        box-shadow:0 0 30px color-mix(in srgb, var(--rh-accent) 40%, transparent);
      }
      .rh-hero-ring-outer{ animation:rhRingSpin 18s linear infinite; border-style:dashed; }
      .rh-hero-ring-inner{ inset:14px; border-color:color-mix(in srgb, var(--rh-accent) 85%, transparent); animation:rhRingPulse 2.6s ease-in-out infinite; }
      @keyframes rhRingSpin{ to{ transform:rotate(360deg); } }
      @keyframes rhRingPulse{ 50%{ transform:scale(1.05); opacity:.6; } }
      .rh-hero-emblem{
        position:relative; z-index:2;
        font-size:62px; line-height:1;
        filter:drop-shadow(0 8px 22px color-mix(in srgb, var(--rh-accent) 65%, transparent))
               drop-shadow(0 0 30px color-mix(in srgb, var(--rh-accent) 50%, transparent));
        animation:rhEmblemFloat 3.6s ease-in-out infinite;
      }
      @keyframes rhEmblemFloat{
        0%, 100%{ transform:translateY(0) rotate(-3deg); }
        50%     { transform:translateY(-6px) rotate(3deg); }
      }
      /* Real tier-badge artwork in the hero — floats straight up (no tilt). */
      .rh-hero-emblem-img{
        width:120px; height:120px; object-fit:contain; display:block;
      }
      .rh-hero-emblem:has(.rh-hero-emblem-img){ animation:rhEmblemFloatUp 3.6s ease-in-out infinite; }
      @keyframes rhEmblemFloatUp{
        0%, 100%{ transform:translateY(0); }
        50%     { transform:translateY(-7px); }
      }

      .rh-hero-eyebrow{
        position:relative; z-index:2;
        font-family:'Outfit',sans-serif;
        font-size:10.5px; font-weight:900; letter-spacing:4px;
        color:var(--rh-accent);
        text-shadow:0 0 14px color-mix(in srgb, var(--rh-accent) 60%, transparent);
        margin-bottom:8px;
      }
      .rh-hero-tier{
        position:relative; z-index:2;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:44px; line-height:1; letter-spacing:3px;
        background:linear-gradient(180deg, #FFFBEB 0%, var(--rh-accent) 60%, color-mix(in srgb, var(--rh-accent) 50%, #000) 100%);
        -webkit-background-clip:text; background-clip:text; color:transparent;
        filter:drop-shadow(0 4px 14px rgba(0,0,0,.6)) drop-shadow(0 0 22px color-mix(in srgb, var(--rh-accent) 35%, transparent));
        margin-bottom:6px;
      }
      .rh-hero-div{
        font-size:24px;
        color:rgba(255,255,255,.55);
        -webkit-text-fill-color:rgba(255,255,255,.55);
        margin-left:6px; letter-spacing:1.8px;
      }
      .rh-hero-rp{
        position:relative; z-index:2;
        display:flex; align-items:baseline; justify-content:center; gap:8px;
        margin-bottom:18px; flex-wrap:wrap;
      }
      .rh-hero-rp-val{
        font-family:'Bangers',cursive;
        font-size:36px; line-height:1; letter-spacing:1.5px;
        color:#fff;
        text-shadow:0 2px 6px rgba(0,0,0,.6);
      }
      .rh-hero-rp-unit{
        font-family:'Outfit',sans-serif;
        font-size:12px; font-weight:900; letter-spacing:2.4px;
        color:var(--rh-accent);
      }
      .rh-hero-rp-peak{
        font-size:10px; font-weight:800; letter-spacing:1.8px;
        color:rgba(255,255,255,.42);
        padding:2px 8px; border-radius:99px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.06);
        margin-left:6px;
      }
      .rh-hero-rp-lbl{
        font-size:13px; font-weight:700; color:rgba(255,255,255,.7);
      }
      .rh-progress{ position:relative; z-index:2; margin:0 auto; max-width:420px; }
      .rh-progress-bar{
        height:8px; border-radius:99px;
        background:rgba(255,255,255,.06);
        overflow:hidden;
        box-shadow:inset 0 1px 0 rgba(0,0,0,.4), inset 0 -1px 0 rgba(255,255,255,.04);
      }
      .rh-progress-fill{
        height:100%; border-radius:99px;
        box-shadow:0 0 12px color-mix(in srgb, var(--rh-accent, #FBBF24) 60%, transparent);
        transition:width .8s cubic-bezier(.34,1.56,.64,1);
      }
      .rh-progress-meta{
        display:flex; justify-content:space-between;
        font-size:10.5px; font-weight:800;
        color:rgba(255,255,255,.55);
        margin-top:7px; letter-spacing:.4px;
      }
      .rh-topcrown{
        font-family:'Bangers',cursive;
        font-size:18px; letter-spacing:2px;
        color:#FFD700;
        text-shadow:0 0 16px rgba(255,215,0,.6);
        animation:rhRingPulse 2s ease-in-out infinite;
      }

      /* ── PROMOTION ALERT ── */
      .rh-promo{
        position:relative; overflow:hidden;
        display:flex; align-items:center; gap:14px;
        margin:14px 22px 0;
        padding:14px 16px; border-radius:14px;
        background:linear-gradient(135deg, rgba(232,50,74,.20), rgba(232,50,74,.06));
        border:1.5px solid rgba(232,50,74,.55);
        box-shadow:
          0 12px 30px rgba(0,0,0,.45),
          0 0 24px rgba(232,50,74,.30);
        animation:rhPromoPulse 1.8s ease-in-out infinite;
      }
      @keyframes rhPromoPulse{
        50%{ box-shadow:0 12px 30px rgba(0,0,0,.45), 0 0 38px rgba(232,50,74,.55); }
      }
      .rh-promo-glow{
        position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.12) 50%, transparent 62%);
        background-size:300% 100%;
        animation:rhFeatShine 3.6s ease-in-out infinite;
      }
      @keyframes rhFeatShine{ 0%{ background-position:200% 0; } 100%{ background-position:-200% 0; } }
      .rh-promo-icon{ font-size:30px; line-height:1; filter:drop-shadow(0 0 12px rgba(232,50,74,.6)); }
      .rh-promo-eyebrow{
        font-family:'Outfit',sans-serif;
        font-size:10.5px; font-weight:900; letter-spacing:2.6px;
        color:#FCA5A5; margin-bottom:3px;
      }
      .rh-promo-line{ font-size:13px; font-weight:700; color:rgba(255,255,255,.92); }
      .rh-promo-line b{ color:#FBBF24; }

      /* ── STREAK FIRE ── */
      .rh-streak{
        display:flex; align-items:center; gap:12px;
        margin:12px 22px 0;
        padding:12px 16px; border-radius:14px;
        background:linear-gradient(135deg, rgba(251,146,60,.20), rgba(220,38,38,.10));
        border:1px solid rgba(251,146,60,.40);
        box-shadow:0 10px 24px rgba(0,0,0,.4), 0 0 18px rgba(251,146,60,.20);
      }
      .rh-streak-fire{
        font-size:32px; line-height:1;
        filter:drop-shadow(0 0 14px rgba(251,146,60,.7));
        animation:rhEmblemFloat 1.4s ease-in-out infinite;
      }
      .rh-streak-num{
        font-family:'Bangers',cursive;
        font-size:20px; letter-spacing:1.4px; line-height:1;
        color:#FBBF24; margin-bottom:3px;
      }
      .rh-streak-sub{ font-size:11px; color:rgba(255,255,255,.6); font-weight:700; }

      /* ── SEASON PILL ── */
      .rh-season{
        display:flex; align-items:center; justify-content:space-between;
        margin:14px 22px 0;
        padding:11px 16px; border-radius:12px;
        background:rgba(251,191,36,.08);
        border:1px solid rgba(251,191,36,.25);
      }
      .rh-season-lbl{
        font-family:'Outfit',sans-serif;
        font-size:11.5px; font-weight:900; letter-spacing:2.2px;
        color:rgba(255,255,255,.75);
      }
      .rh-season-cd{
        font-family:'Bangers',cursive;
        font-size:18px; letter-spacing:1.4px;
        color:#FBBF24;
        text-shadow:0 0 12px rgba(251,191,36,.45);
      }

      /* ── WARNING ── */
      .rh-warn{
        display:flex; align-items:center; gap:12px;
        margin:12px 22px 0;
        padding:11px 14px; border-radius:11px;
        background:rgba(239,68,68,.10);
        border:1px solid rgba(239,68,68,.30);
        font-size:12px; color:#FCA5A5; font-weight:700;
      }
      .rh-warn-icon{ font-size:20px; flex:0 0 auto; }

      /* ── STATS ROW ── */
      .rh-stats{
        display:grid; grid-template-columns:repeat(4, 1fr);
        gap:8px;
        margin:14px 22px 0;
      }
      .rh-stat{
        position:relative; overflow:hidden;
        padding:14px 8px 12px; border-radius:12px; text-align:center;
        background:linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%);
        border:1px solid rgba(255,255,255,.06);
      }
      .rh-stat::before{
        content:""; position:absolute; left:0; right:0; top:0; height:2.5px;
        background:linear-gradient(90deg, transparent, var(--rh-stat-c, #FBBF24), transparent);
      }
      .rh-stat-w{ --rh-stat-c:#22C55E; }
      .rh-stat-l{ --rh-stat-c:#E8324A; }
      .rh-stat-r{ --rh-stat-c:#A855F7; }
      .rh-stat-s{ --rh-stat-c:#F97316; }
      .rh-stat-val{
        font-family:'Bangers',cursive;
        font-size:24px; line-height:1; letter-spacing:.6px;
        color:#fff; margin-bottom:4px;
        text-shadow:0 2px 5px rgba(0,0,0,.55);
      }
      .rh-stat-lbl{
        font-size:9.5px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.55);
        text-transform:uppercase;
      }

      /* ── BATTLE CTA — enter the arena ── */
      .rh-cta{
        position:relative; overflow:hidden;
        display:block; width:calc(100% - 44px);
        margin:18px 22px 0; padding:18px;
        border:none; border-radius:16px; cursor:pointer;
        background:linear-gradient(180deg, color-mix(in srgb, var(--rh-accent) 90%, #FFE9B0) 0%, color-mix(in srgb, var(--rh-accent) 60%, #000) 100%);
        color:#1A0F03;
        font-family:'Bangers','Outfit',sans-serif;
        box-shadow:
          0 16px 38px color-mix(in srgb, var(--rh-accent) 45%, transparent),
          inset 0 1px 0 rgba(255,255,255,.45),
          inset 0 -4px 8px rgba(0,0,0,.30);
        transition:transform .18s, filter .18s, box-shadow .25s;
        animation:rhCtaBreathe 2.6s ease-in-out infinite;
      }
      @keyframes rhCtaBreathe{
        50%{ box-shadow:0 22px 48px color-mix(in srgb, var(--rh-accent) 60%, transparent),
                       inset 0 1px 0 rgba(255,255,255,.45),
                       inset 0 -4px 8px rgba(0,0,0,.30); }
      }
      .rh-cta:hover{ filter:brightness(1.08); transform:translateY(-3px); }
      .rh-cta:active{ transform:translateY(0) scale(.985); }
      .rh-cta-locked{
        background:rgba(255,255,255,.04);
        color:rgba(255,255,255,.4);
        box-shadow:none;
        cursor:not-allowed;
        animation:none;
      }
      .rh-cta-glow{
        position:absolute; inset:-50% -10%;
        background:radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.25) 0%, transparent 60%);
        pointer-events:none;
      }
      .rh-cta-shine{
        position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.35) 50%, transparent 62%);
        background-size:280% 100%;
        animation:rhFeatShine 2.8s ease-in-out infinite;
      }
      .rh-cta-locked .rh-cta-shine,
      .rh-cta-locked .rh-cta-glow{ display:none; }
      .rh-cta-body{
        position:relative; z-index:2;
        display:flex; align-items:center; justify-content:center; gap:14px;
      }
      .rh-cta-sword{
        font-size:28px; line-height:1;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));
        animation:rhSwordSway 2s ease-in-out infinite;
      }
      .rh-cta-sword:last-child{ animation-delay:-1s; transform:scaleX(-1); }
      @keyframes rhSwordSway{ 50%{ transform:rotate(-6deg); } }
      .rh-cta-text{ display:flex; flex-direction:column; align-items:center; line-height:1; }
      .rh-cta-main{
        font-size:24px; letter-spacing:3px;
        text-shadow:0 1px 0 rgba(255,255,255,.4), 0 2px 4px rgba(0,0,0,.25);
      }
      .rh-cta-sub{
        font-family:'Outfit',sans-serif;
        font-size:10.5px; font-weight:900; letter-spacing:1.6px;
        margin-top:4px;
        color:rgba(40,20,0,.7);
        text-transform:uppercase;
      }
      .rh-cta-locked .rh-cta-sub{ color:rgba(255,255,255,.4); }

      /* ── SECTIONS (climb / history / leaderboard) ── */
      .rh-section{ margin:24px 22px 0; }
      .rh-section-head{
        display:flex; align-items:baseline; justify-content:space-between;
        margin-bottom:12px;
        padding-bottom:8px;
        border-bottom:1px solid rgba(255,255,255,.06);
      }
      .rh-section-title{
        font-family:'Bangers',cursive;
        font-size:18px; letter-spacing:2px;
        color:#FFE9B0;
        text-shadow:0 1px 4px rgba(0,0,0,.45);
      }
      .rh-section-sub{
        font-size:10.5px; font-weight:800; letter-spacing:1.2px;
        color:rgba(255,255,255,.45);
        text-transform:uppercase;
      }

      /* ── CLIMB PATH ── */
      .rh-climb{ display:flex; flex-direction:column; gap:6px; }
      .rh-climb-row{
        position:relative;
        display:flex; align-items:center; gap:12px;
        padding:10px 14px; border-radius:11px;
        background:rgba(255,255,255,.02);
        border:1px solid rgba(255,255,255,.04);
        opacity:.55;
        transition:opacity .3s, transform .25s;
      }
      .rh-climb-row.is-unlocked{ opacity:1; }
      .rh-climb-row.is-mine{
        opacity:1;
        background:linear-gradient(90deg, color-mix(in srgb, var(--rh-tier) 18%, transparent), transparent);
        border-color:var(--rh-tier);
        box-shadow:0 0 22px color-mix(in srgb, var(--rh-tier) 28%, transparent);
        transform:translateX(2px);
      }
      .rh-climb-marker{
        flex:0 0 auto;
        width:52px; height:52px; border-radius:50%;
        background:radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--rh-tier) 18%, #000), rgba(0,0,0,.55));
        border:1.5px solid color-mix(in srgb, var(--rh-tier) 70%, transparent);
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 0 14px color-mix(in srgb, var(--rh-tier) 45%, transparent);
      }
      .rh-climb-marker span{ font-size:18px; }
      .rh-climb-img{
        width:46px; height:46px; object-fit:contain; display:block;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.55))
               drop-shadow(0 0 7px color-mix(in srgb, var(--rh-tier) 45%, transparent));
      }
      .rh-climb-info{ flex:1; min-width:0; }
      .rh-climb-name{
        font-family:'Bangers',cursive;
        font-size:15px; letter-spacing:1.5px;
        color:var(--rh-tier);
        line-height:1; margin-bottom:3px;
      }
      .rh-climb-thresh{
        font-size:10.5px; font-weight:700;
        color:rgba(255,255,255,.45);
      }
      .rh-climb-status{
        font-size:10.5px; font-weight:900; letter-spacing:1.2px;
        padding:4px 9px; border-radius:99px;
        flex-shrink:0;
      }
      .rh-climb-here{
        background:rgba(251,191,36,.25);
        color:#FBBF24;
        border:1px solid rgba(251,191,36,.5);
        animation:rhRingPulse 1.6s ease-in-out infinite;
      }
      .rh-climb-unlocked{
        background:rgba(34,197,94,.15);
        color:#4ade80;
      }
      .rh-climb-locked{
        background:rgba(255,255,255,.04);
        color:rgba(255,255,255,.5);
      }

      /* ── RECENT BATTLES ── */
      .rh-history{ display:flex; flex-direction:column; gap:6px; }
      .rh-match{
        display:flex; align-items:center; gap:12px;
        padding:10px 12px; border-radius:11px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.04);
        transition:transform .2s, border-color .2s;
      }
      .rh-match:hover{ transform:translateX(3px); border-color:rgba(255,255,255,.1); }
      .rh-match-tag{
        font-size:9.5px; font-weight:900; letter-spacing:1.4px;
        padding:3px 8px; border-radius:5px;
        flex-shrink:0;
      }
      .rh-match-win .rh-match-tag{
        background:linear-gradient(135deg, #22C55E, #15803D); color:#fff;
        box-shadow:0 2px 6px rgba(34,197,94,.4);
      }
      .rh-match-loss .rh-match-tag{
        background:linear-gradient(135deg, #E8324A, #991B1B); color:#fff;
        box-shadow:0 2px 6px rgba(232,50,74,.4);
      }
      .rh-match-draw .rh-match-tag{ background:rgba(255,255,255,.06); color:rgba(255,255,255,.55); }
      .rh-match-info{ flex:1; min-width:0; }
      .rh-match-vs{
        font-size:12px; font-weight:800; color:rgba(255,255,255,.85);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .rh-match-time{ font-size:10px; color:rgba(255,255,255,.4); font-weight:700; margin-top:2px; }
      .rh-match-rp{
        font-family:'Bangers',cursive;
        font-size:16px; letter-spacing:.6px;
        min-width:60px; text-align:right;
        flex-shrink:0;
      }
      .rh-match-win .rh-match-rp{ color:#4ade80; text-shadow:0 0 8px rgba(74,222,128,.35); }
      .rh-match-loss .rh-match-rp{ color:#FCA5A5; }
      .rh-match-draw .rh-match-rp{ color:rgba(255,255,255,.5); }

      /* ── PODIUM ── */
      .rh-podium{
        display:grid; grid-template-columns:1fr 1.2fr 1fr;
        gap:10px;
        margin-bottom:14px;
        align-items:end;
      }
      .rh-podium-slot{
        position:relative; overflow:hidden;
        text-align:center;
        padding:14px 10px 14px;
        border-radius:14px;
        background:linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%);
        border:1px solid rgba(255,255,255,.06);
        transition:transform .18s ease, box-shadow .2s ease, border-color .2s ease;
      }
      .rh-podium-slot:hover{ transform:translateY(-3px); border-color:rgba(255,255,255,.2); }
      .rh-podium-1st:hover{ transform:translateY(-11px); }
      .rh-podium-1st{
        padding-top:18px; padding-bottom:18px;
        background:linear-gradient(180deg, rgba(255,215,0,.16) 0%, rgba(217,119,6,.06) 100%);
        border:1.5px solid rgba(255,215,0,.45);
        box-shadow:0 12px 30px rgba(0,0,0,.5), 0 0 24px rgba(255,215,0,.25);
        transform:translateY(-8px);
      }
      .rh-podium-2nd{ background:linear-gradient(180deg, rgba(192,192,192,.12) 0%, rgba(160,160,160,.04) 100%); border-color:rgba(192,192,192,.30); }
      .rh-podium-3rd{ background:linear-gradient(180deg, rgba(205,127,50,.14) 0%, rgba(146,64,14,.04) 100%); border-color:rgba(205,127,50,.35); }
      .rh-podium-slot.is-me{ border-color:#FBBF24; box-shadow:0 0 22px rgba(251,191,36,.45); }
      .rh-podium-empty{ opacity:.4; }
      .rh-podium-medal{ font-size:36px; line-height:1; margin-bottom:6px; filter:drop-shadow(0 4px 10px rgba(0,0,0,.4)); }
      .rh-podium-1st .rh-podium-medal{ font-size:46px; animation:rhEmblemFloat 3s ease-in-out infinite; }
      .rh-podium-name{
        font-weight:900; font-size:13px;
        color:#fff;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        margin-bottom:3px;
      }
      .rh-podium-rp{
        font-family:'Bangers',cursive;
        font-size:15px; letter-spacing:.6px;
        margin-bottom:3px;
      }
      .rh-podium-tier{
        font-size:10px; font-weight:800; letter-spacing:.4px;
        color:rgba(255,255,255,.5);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .rh-podium-label{
        font-family:'Outfit',sans-serif;
        font-size:10.5px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.5);
      }

      /* ── LEADERBOARD rest ── */
      .rh-lb-rest{ display:flex; flex-direction:column; gap:5px; }
      .rh-lb-row{
        display:flex; align-items:center; gap:12px;
        padding:9px 12px; border-radius:10px;
        background:rgba(255,255,255,.025);
        border:1px solid rgba(255,255,255,.04);
        transition:transform .2s, border-color .2s;
      }
      .rh-lb-row:hover{ transform:translateX(3px); border-color:rgba(255,255,255,.1); }
      .rh-lb-row.is-me{
        background:rgba(251,191,36,.08);
        border-color:rgba(251,191,36,.40);
      }
      .rh-lb-rank{
        font-family:'Bangers',cursive;
        font-size:15px; letter-spacing:.6px;
        color:rgba(255,255,255,.5);
        min-width:32px; text-align:center;
        flex-shrink:0;
      }
      .rh-lb-name{
        flex:1; min-width:0;
        font-size:12.5px; font-weight:800; color:rgba(255,255,255,.85);
      }
      .rh-lb-tier{
        font-size:10px; font-weight:700;
        color:rgba(255,255,255,.4);
        margin-top:1px;
      }
      .rh-lb-rp{
        font-family:'Bangers',cursive;
        font-size:14px; letter-spacing:.4px;
        text-align:right;
        min-width:60px;
        flex-shrink:0;
      }
      .rh-lb-empty{
        text-align:center; padding:24px;
        font-size:12.5px; font-weight:700;
        color:rgba(255,255,255,.5);
      }
      .rh-err{ text-align:center; padding:60px 24px; color:rgba(255,255,255,.6); font-weight:700; }
      .rh-err a{ color:#FBBF24; display:inline-block; margin-left:8px; }

      /* ── MOBILE ── */
      @media (max-width:520px){
        .rh-hero{ padding:30px 18px 22px; }
        .rh-hero-stage{ width:110px; height:110px; }
        .rh-hero-emblem{ font-size:50px; }
        .rh-hero-emblem-img{ width:94px; height:94px; }
        .rh-hero-tier{ font-size:34px; letter-spacing:2px; }
        .rh-hero-rp-val{ font-size:30px; }
        .rh-promo, .rh-streak, .rh-season, .rh-warn, .rh-stats{ margin-left:16px; margin-right:16px; }
        .rh-cta{ width:calc(100% - 32px); margin-left:16px; margin-right:16px; padding:15px; }
        .rh-cta-main{ font-size:20px; letter-spacing:2.2px; }
        .rh-cta-sword{ font-size:22px; }
        .rh-section{ margin-left:16px; margin-right:16px; }
        .rh-section-title{ font-size:15px; }
        .rh-stats{ grid-template-columns:repeat(2, 1fr); }
        .rh-podium{ gap:6px; }
        .rh-podium-1st .rh-podium-medal{ font-size:38px; }
        .rh-podium-medal{ font-size:28px; }
        .rh-podium-name{ font-size:11.5px; }
      }
    `;
    document.head.appendChild(s);
  }

  function _ensureTournHubStyles(){
    if(document.getElementById('thHubStyles')) return;
    const s = document.createElement('style');
    s.id = 'thHubStyles';
    s.textContent = `
      /* ═══ TOURNAMENTS HUB — modern arena layout ═══ */
      #tournOv .tourn-box{
        padding:0 !important;
        width:min(720px, 96vw) !important;
        max-height:92vh !important;
        background:linear-gradient(180deg, #11142A 0%, #07091A 100%) !important;
        border:1px solid rgba(251,191,36,.12) !important;
        box-shadow:
          0 50px 120px rgba(0,0,0,.85),
          0 0 60px rgba(251,191,36,.10),
          inset 0 1px 0 rgba(255,255,255,.06) !important;
      }
      .th-shell{ position:relative; padding:0; }
      .th-close{
        position:absolute; top:14px; right:14px; z-index:30;
        width:38px; height:38px; border-radius:50%;
        background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
        color:rgba(255,255,255,.8); cursor:pointer; font-size:18px;
        display:flex; align-items:center; justify-content:center;
        transition:background .2s, transform .25s, border-color .2s, color .2s;
      }
      .th-close:hover{
        background:linear-gradient(135deg,#E8324A,#991B1B); color:#fff;
        transform:rotate(90deg); border-color:#E8324A;
      }

      /* ── HERO ───────────────────────────────────────────── */
      .th-hero{
        position:relative; text-align:center; padding:36px 24px 22px;
        background:
          radial-gradient(ellipse 80% 80% at 50% 0%, rgba(251,191,36,.22) 0%, rgba(251,191,36,0) 60%),
          radial-gradient(ellipse 60% 60% at 80% 100%, rgba(232,50,74,.18) 0%, transparent 70%),
          radial-gradient(ellipse 60% 60% at 20% 100%, rgba(124,58,237,.18) 0%, transparent 70%);
        overflow:hidden;
      }
      .th-hero::before{
        content:""; position:absolute; inset:0; pointer-events:none; opacity:.45;
        background:
          radial-gradient(circle at 20% 20%, #FBBF24 0 1.5px, transparent 2px),
          radial-gradient(circle at 80% 30%, #FFFBEB 0 1px, transparent 1.6px),
          radial-gradient(circle at 30% 70%, #FBBF24 0 1px, transparent 1.6px),
          radial-gradient(circle at 70% 80%, #FFFBEB 0 1.5px, transparent 2px),
          radial-gradient(circle at 50% 50%, transparent 0, transparent 100%);
        animation:thStars 12s linear infinite;
      }
      @keyframes thStars{ 50%{ opacity:.85; } }
      .th-hero-trophy{
        font-size:62px; line-height:1; margin-bottom:6px;
        filter:drop-shadow(0 8px 18px rgba(251,191,36,.55)) drop-shadow(0 0 26px rgba(251,191,36,.4));
        animation:thTrophyFloat 3.6s ease-in-out infinite;
      }
      @keyframes thTrophyFloat{
        0%, 100%{ transform:translateY(0) rotate(-2deg); }
        50%     { transform:translateY(-6px) rotate(2deg); }
      }
      .th-hero-eyebrow{
        font-family:'Outfit',sans-serif;
        font-size:11px; font-weight:900; letter-spacing:4px;
        color:#FBBF24;
        text-shadow:0 0 14px rgba(251,191,36,.6);
        margin-bottom:8px;
      }
      .th-hero-title{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:46px; line-height:1; letter-spacing:3.2px;
        background:linear-gradient(180deg, #FFE9B0 0%, #FBBF24 45%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; color:transparent;
        filter:drop-shadow(0 4px 12px rgba(0,0,0,.55)) drop-shadow(0 0 22px rgba(251,191,36,.35));
        margin-bottom:10px;
      }
      .th-hero-sub{
        font-family:'Outfit',sans-serif;
        font-size:13px; font-weight:600;
        color:rgba(255,255,255,.65); letter-spacing:.4px;
      }

      /* ── STATS STRIP ────────────────────────────────────── */
      .th-stats{
        display:grid; grid-template-columns:repeat(4, 1fr);
        gap:8px; padding:18px 18px 8px;
      }
      .th-stat{
        position:relative; overflow:hidden;
        padding:14px 10px 12px; border-radius:14px; text-align:center;
        background:linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%);
        border:1px solid rgba(255,255,255,.06);
        transition:transform .25s cubic-bezier(.34,1.56,.64,1), border-color .2s;
      }
      .th-stat::before{
        content:""; position:absolute; left:0; right:0; top:0; height:2.5px;
        background:linear-gradient(90deg, transparent, var(--th-stat-c, #FBBF24), transparent);
        opacity:.85;
      }
      .th-stat-1{ --th-stat-c:#22C55E; } .th-stat-2{ --th-stat-c:#A855F7; }
      .th-stat-3{ --th-stat-c:#FBBF24; } .th-stat-4{ --th-stat-c:#E8324A; }
      .th-stat:hover{ transform:translateY(-2px); border-color:rgba(255,255,255,.14); }
      .th-stat-val{
        font-family:'Bangers',cursive;
        font-size:22px; line-height:1; letter-spacing:.8px;
        color:#fff; margin-bottom:4px;
        text-shadow:0 1px 4px rgba(0,0,0,.5);
      }
      .th-stat-lbl{
        font-size:9.5px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.55); text-transform:uppercase;
      }

      /* ── FEATURED SPOTLIGHT ─────────────────────────────── */
      .th-featured{
        position:relative; overflow:hidden;
        margin:14px 18px 0;
        padding:18px 18px 16px; border-radius:18px;
        background:
          radial-gradient(120% 80% at 50% 0%, var(--th-feat-glow, rgba(251,191,36,.35)) 0%, transparent 65%),
          linear-gradient(180deg, rgba(28,22,46,.95) 0%, rgba(14,10,28,.95) 100%);
        border:1.5px solid var(--th-feat-accent, #FBBF24);
        box-shadow:
          0 18px 50px rgba(0,0,0,.55),
          0 0 32px var(--th-feat-glow, rgba(251,191,36,.30)),
          inset 0 1px 0 rgba(255,255,255,.08);
        animation:thFeatPulse 3.4s ease-in-out infinite;
      }
      @keyframes thFeatPulse{
        50%{ box-shadow:
          0 22px 60px rgba(0,0,0,.65),
          0 0 42px var(--th-feat-glow, rgba(251,191,36,.40)),
          inset 0 1px 0 rgba(255,255,255,.08); }
      }
      .th-feat-shine{
        position:absolute; inset:0; pointer-events:none;
        background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.16) 50%, transparent 62%);
        background-size:300% 100%;
        animation:thFeatShine 4s ease-in-out infinite;
      }
      @keyframes thFeatShine{ 0%{ background-position:200% 0; } 100%{ background-position:-200% 0; } }
      .th-feat-eyebrow{
        display:inline-flex; align-items:center; gap:6px;
        font-family:'Outfit',sans-serif;
        font-size:10.5px; font-weight:900; letter-spacing:2.8px;
        color:var(--th-feat-accent, #FBBF24);
        text-shadow:0 0 10px var(--th-feat-glow, rgba(251,191,36,.5));
        margin-bottom:10px;
      }
      .th-feat-eyebrow-dot{
        width:8px; height:8px; border-radius:50%;
        background:var(--th-feat-accent, #FBBF24);
        box-shadow:0 0 10px var(--th-feat-glow, rgba(251,191,36,.7));
        animation:thFeatDot 1.4s ease-in-out infinite;
      }
      @keyframes thFeatDot{ 50%{ opacity:.4; transform:scale(.8); } }
      .th-feat-row{
        display:flex; align-items:center; gap:14px;
        margin-bottom:14px;
      }
      .th-feat-info{ flex:1; min-width:0; }
      .th-feat-name{
        font-family:'Bangers',cursive;
        font-size:24px; letter-spacing:1.6px; line-height:1;
        color:#fff; margin-bottom:6px;
        text-shadow:0 2px 6px rgba(0,0,0,.5);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .th-feat-meta{
        font-size:11.5px; font-weight:700;
        color:rgba(255,255,255,.65); margin-bottom:8px;
      }
      .th-feat-bar{
        height:6px; border-radius:99px;
        background:rgba(255,255,255,.06);
        overflow:hidden;
      }
      .th-feat-bar-fill{
        height:100%; border-radius:99px;
        background:linear-gradient(90deg, var(--th-feat-accent, #FBBF24), #FFE9B0);
        box-shadow:0 0 12px var(--th-feat-glow, rgba(251,191,36,.5));
        transition:width .5s cubic-bezier(.34,1.56,.64,1);
      }
      .th-feat-prize{
        flex:0 0 auto; text-align:right;
      }
      .th-feat-prize-eyebrow{
        font-size:9px; font-weight:900; letter-spacing:2px;
        color:rgba(255,255,255,.5); margin-bottom:2px;
      }
      .th-feat-prize-val{
        font-family:'Bangers',cursive;
        font-size:26px; line-height:1; letter-spacing:.8px;
        background:linear-gradient(180deg, #FFE9B0, #FBBF24, #D97706);
        -webkit-background-clip:text; background-clip:text; color:transparent;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));
      }
      .th-feat-cta{
        width:100%; padding:13px;
        border:none; border-radius:12px; cursor:pointer;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:17px; letter-spacing:2.4px;
        background:linear-gradient(180deg, #FBBF24 0%, #D97706 100%);
        color:#1A0F03;
        box-shadow:0 10px 26px var(--th-feat-glow, rgba(251,191,36,.45)),
                   inset 0 1px 0 rgba(255,255,255,.4),
                   inset 0 -3px 6px rgba(80,40,0,.3);
        transition:transform .15s, filter .15s;
      }
      .th-feat-cta:hover{ filter:brightness(1.08); transform:translateY(-2px); }
      .th-feat-cta:active{ transform:translateY(0) scale(.98); }
      .th-feat-cta-wait{
        background:rgba(255,255,255,.06); color:rgba(255,255,255,.6);
        cursor:default; box-shadow:none;
        border:1px dashed rgba(255,255,255,.14);
        font-family:'Outfit',sans-serif; font-size:12px; letter-spacing:.6px;
      }

      /* ── QUICK ACTIONS ──────────────────────────────────── */
      .th-actions{
        display:grid; grid-template-columns:repeat(3, 1fr);
        gap:8px; padding:14px 18px 6px;
      }
      .th-action{
        display:flex; align-items:center; gap:10px;
        padding:12px 12px; border-radius:13px; cursor:pointer;
        background:linear-gradient(180deg, rgba(255,255,255,.05) 0%, rgba(255,255,255,.02) 100%);
        border:1px solid rgba(255,255,255,.08);
        color:#fff; text-align:left;
        transition:transform .2s cubic-bezier(.34,1.56,.64,1), border-color .2s, box-shadow .2s;
      }
      .th-action:hover{
        transform:translateY(-2px);
        border-color:rgba(251,191,36,.4);
        box-shadow:0 12px 26px rgba(0,0,0,.45), 0 0 16px rgba(251,191,36,.15);
      }
      .th-action-icon{
        flex:0 0 auto; width:36px; height:36px; border-radius:10px;
        display:flex; align-items:center; justify-content:center;
        font-size:18px;
        background:rgba(255,255,255,.06);
      }
      .th-action-create .th-action-icon{ background:linear-gradient(135deg,#A855F7,#4C1D95); }
      .th-action-quick  .th-action-icon{ background:linear-gradient(135deg,#FBBF24,#D97706); color:#1A0F03; }
      .th-action-rules  .th-action-icon{ background:linear-gradient(135deg,#06B6D4,#0E7490); }
      .th-action-txt{ display:flex; flex-direction:column; line-height:1.15; min-width:0; }
      .th-action-txt b{
        font-family:'Outfit',sans-serif;
        font-size:13px; font-weight:900; letter-spacing:.3px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .th-action-txt span{
        font-size:10px; font-weight:700;
        color:rgba(255,255,255,.5); letter-spacing:.3px;
      }

      /* ── FILTER TABS ────────────────────────────────────── */
      .th-tabs{
        display:flex; gap:4px; margin:12px 18px 4px;
        padding:5px; border-radius:13px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.05);
      }
      .th-tab{
        flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
        padding:9px 10px; border:none; border-radius:9px; cursor:pointer;
        background:transparent; color:rgba(255,255,255,.55);
        font-family:'Outfit',sans-serif;
        font-size:11px; font-weight:900; letter-spacing:1px;
        text-transform:uppercase;
        transition:all .22s cubic-bezier(.34,1.56,.64,1);
      }
      .th-tab:hover{ color:#fff; background:rgba(255,255,255,.04); }
      .th-tab.on{
        background:linear-gradient(135deg, rgba(251,191,36,.22), rgba(217,119,6,.10));
        color:#FBBF24;
        box-shadow:0 4px 14px rgba(251,191,36,.20), inset 0 1px 0 rgba(255,255,255,.08);
      }
      .th-tab-emoji{ font-size:13px; line-height:1; }
      .th-tab-n{
        font-size:10px; padding:1.5px 6px; border-radius:99px;
        background:rgba(255,255,255,.1); color:rgba(255,255,255,.8);
        font-weight:900; letter-spacing:.4px;
      }
      .th-tab.on .th-tab-n{ background:rgba(251,191,36,.30); color:#FFE9B0; }

      /* ── BODY ──────────────────────────────────────────── */
      .th-body{ padding:12px 18px 22px; }

      /* Tier grouping */
      .th-tier{ margin-bottom:22px; }
      .th-tier-head{
        position:relative; padding:8px 0 12px; margin-bottom:10px;
      }
      .th-tier-bar{
        position:absolute; left:0; right:0; bottom:0; height:1.5px;
        opacity:.5;
      }
      .th-tier-title{
        font-family:'Bangers',cursive;
        font-size:18px; line-height:1; letter-spacing:1.8px;
        text-shadow:0 1px 4px rgba(0,0,0,.4);
        margin-bottom:3px;
      }
      .th-tier-sub{
        font-size:11px; font-weight:700;
        color:rgba(255,255,255,.5);
      }
      .th-tier-grid{
        display:grid; gap:10px;
        grid-template-columns:1fr;
      }

      /* ── TOURNAMENT CARD ───────────────────────────────── */
      .th-card{
        position:relative; overflow:hidden; cursor:pointer;
        padding:16px 16px 12px; border-radius:18px;
        background:
          radial-gradient(140% 60% at 50% 0%, rgba(255,255,255,.04) 0%, transparent 50%),
          linear-gradient(180deg, rgba(22,26,46,.85) 0%, rgba(12,14,28,.85) 100%);
        border:1.5px solid rgba(255,255,255,.06);
        box-shadow:0 8px 24px rgba(0,0,0,.4);
        transition:transform .25s cubic-bezier(.34,1.56,.64,1), border-color .2s, box-shadow .2s;
        animation:thCardIn .45s cubic-bezier(.16,1,.3,1) both;
      }
      @keyframes thCardIn{
        from{ opacity:0; transform:translateY(8px); }
        to  { opacity:1; transform:translateY(0); }
      }
      .th-card::before{
        content:""; position:absolute; left:0; right:0; top:0; height:3px;
        background:linear-gradient(90deg, transparent, var(--th-card-accent, #FBBF24), transparent);
      }
      .th-card:hover{
        transform:translateY(-3px);
        border-color:var(--th-card-accent, rgba(251,191,36,.4));
        box-shadow:0 16px 36px rgba(0,0,0,.55), 0 0 22px var(--th-card-glow, rgba(251,191,36,.18));
      }
      .th-card.open{
        border-color:var(--th-card-accent, rgba(251,191,36,.6));
        box-shadow:0 18px 40px rgba(0,0,0,.55), 0 0 30px var(--th-card-glow, rgba(251,191,36,.30));
      }
      .th-card-tier{
        display:inline-flex; align-items:center; gap:5px;
        font-family:'Outfit',sans-serif;
        font-size:9.5px; font-weight:900; letter-spacing:2px;
        color:var(--th-card-accent, #FBBF24);
        padding:3px 9px 3px 7px; border-radius:99px;
        background:rgba(0,0,0,.3);
        border:1px solid var(--th-card-accent, rgba(251,191,36,.4));
        margin-bottom:8px;
      }
      .th-card-tier span{ font-size:11px; }
      .th-card-head{
        display:flex; align-items:center; justify-content:space-between;
        gap:10px; margin-bottom:12px;
      }
      .th-card-name{
        font-family:'Outfit',sans-serif;
        font-size:18px; font-weight:900; color:#fff;
        letter-spacing:.3px; flex:1;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .th-card-status{
        font-size:9.5px; font-weight:900; letter-spacing:1.4px;
        padding:4px 9px; border-radius:99px; flex-shrink:0;
      }
      .th-card-status.open{
        background:rgba(34,197,94,.18); color:#4ade80;
        border:1px solid rgba(34,197,94,.4);
      }
      .th-card-status.playing{
        background:rgba(251,191,36,.22); color:#FBBF24;
        border:1px solid rgba(251,191,36,.5);
        animation:thStatusBlink 1.4s ease-in-out infinite;
      }
      @keyframes thStatusBlink{ 50%{ filter:brightness(1.4); } }
      .th-card-status.done{
        background:rgba(255,255,255,.06); color:rgba(255,255,255,.5);
        border:1px solid rgba(255,255,255,.1);
      }
      /* Prize block */
      .th-card-pot{
        display:flex; align-items:baseline; gap:10px;
        flex-wrap:wrap;
        padding:10px 12px; border-radius:11px;
        background:
          radial-gradient(100% 100% at 0% 0%, rgba(251,191,36,.10) 0%, transparent 60%),
          rgba(0,0,0,.25);
        border:1px solid rgba(251,191,36,.15);
        margin-bottom:12px;
      }
      .th-card-pot-lbl{
        font-size:9.5px; font-weight:900; letter-spacing:1.6px;
        color:rgba(255,255,255,.55);
      }
      .th-card-pot-val{
        font-family:'Bangers',cursive;
        font-size:22px; line-height:1; letter-spacing:.8px;
        background:linear-gradient(180deg, #FFE9B0, #FBBF24, #D97706);
        -webkit-background-clip:text; background-clip:text; color:transparent;
        filter:drop-shadow(0 1px 3px rgba(0,0,0,.45));
        flex:1;
      }
      .th-card-pot-fee{
        font-size:10.5px; font-weight:800; letter-spacing:.4px;
        color:rgba(255,255,255,.65);
        padding:3px 8px; border-radius:99px;
        background:rgba(0,0,0,.35);
      }
      .th-card-pot-fee.free{ color:#4ade80; }
      /* Avatars + fill bar */
      .th-card-players{ margin-bottom:12px; }
      .th-card-av-row{
        display:flex; gap:4px; margin-bottom:6px;
        flex-wrap:wrap;
      }
      .th-card-av{
        width:26px; height:26px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:900;
        background:linear-gradient(135deg,#A855F7,#4C1D95);
        color:#fff;
        border:2px solid rgba(255,255,255,.1);
        box-shadow:0 2px 6px rgba(0,0,0,.4);
      }
      .th-card-av.me{
        background:linear-gradient(135deg,#FBBF24,#D97706);
        color:#1A0F03;
        border-color:#FFE9B0;
        box-shadow:0 2px 8px rgba(251,191,36,.5);
      }
      .th-card-av.bot{
        background:linear-gradient(135deg,#6B7280,#374151);
        font-size:9px;
      }
      .th-card-av.empty{
        background:transparent; border:1.5px dashed rgba(255,255,255,.14);
        color:rgba(255,255,255,.3); font-weight:700;
      }
      .th-card-av.more{
        background:rgba(255,255,255,.08); font-size:10px; color:rgba(255,255,255,.7);
      }
      .th-card-fill{ display:flex; align-items:center; gap:10px; }
      .th-card-fill-bar{
        flex:1; height:5px; border-radius:99px;
        background:rgba(255,255,255,.05); overflow:hidden;
      }
      .th-card-fill-cur{
        height:100%; border-radius:99px;
        background:linear-gradient(90deg, var(--th-card-accent, #FBBF24), #FFE9B0);
        box-shadow:0 0 8px var(--th-card-glow, rgba(251,191,36,.4));
        transition:width .5s cubic-bezier(.34,1.56,.64,1);
      }
      .th-card-fill-lbl{
        font-size:10px; font-weight:800; color:rgba(255,255,255,.5);
        letter-spacing:.3px; white-space:nowrap;
      }
      .th-card-fill-lbl b{ color:rgba(255,255,255,.85); font-weight:900; }
      /* Card CTA */
      .th-card-cta{
        width:100%; padding:11px 14px;
        border:none; border-radius:12px; cursor:pointer;
        font-family:'Outfit',sans-serif;
        font-size:12.5px; font-weight:900; letter-spacing:1.2px;
        text-align:center;
        transition:transform .15s, filter .15s, box-shadow .2s;
      }
      .th-card-cta-join{
        background:linear-gradient(135deg, #22C55E 0%, #15803D 100%);
        color:#fff;
        box-shadow:0 8px 20px rgba(34,197,94,.35), inset 0 1px 0 rgba(255,255,255,.2);
      }
      .th-card-cta-join:hover{ filter:brightness(1.1); transform:translateY(-2px); }
      .th-card-cta-start{
        background:linear-gradient(135deg, #FBBF24 0%, #D97706 100%);
        color:#1A0F03;
        box-shadow:0 8px 20px rgba(251,191,36,.45), inset 0 1px 0 rgba(255,255,255,.3);
      }
      .th-card-cta-start:hover{ filter:brightness(1.08); transform:translateY(-2px); }
      .th-card-cta-live{
        background:linear-gradient(135deg, #E8324A 0%, #991B1B 100%);
        color:#fff;
        box-shadow:0 8px 20px rgba(232,50,74,.45), inset 0 1px 0 rgba(255,255,255,.2);
        cursor:default; animation:thLivePulse 1.4s ease-in-out infinite;
      }
      @keyframes thLivePulse{ 50%{ filter:brightness(1.2); } }
      .th-card-cta-wait{
        background:rgba(255,255,255,.04); color:rgba(255,255,255,.6);
        cursor:default; border:1px dashed rgba(255,255,255,.12);
      }
      .th-card-expand{
        text-align:center; margin-top:10px;
        font-size:10px; font-weight:900; letter-spacing:1.8px;
        color:rgba(255,255,255,.32);
      }
      .th-card.open .th-card-expand{ color:var(--th-card-accent, #FBBF24); }

      /* ── EMPTY / LOADING / ERROR ────────────────────────── */
      .th-loading{
        display:flex; flex-direction:column; align-items:center; gap:14px;
        padding:60px 20px;
      }
      .th-spinner{
        width:44px; height:44px; border-radius:50%;
        border:3px solid rgba(251,191,36,.15); border-top-color:#FBBF24;
        animation:spin .8s linear infinite;
      }
      .th-loading-text{
        font-family:'Outfit',sans-serif;
        font-size:13px; font-weight:800; letter-spacing:1.2px;
        color:rgba(255,255,255,.55);
      }
      .th-empty{
        text-align:center; padding:46px 24px 36px; border-radius:18px;
        background:radial-gradient(ellipse at 50% 0%, rgba(251,191,36,.06), transparent 70%);
        border:1.5px dashed rgba(251,191,36,.20);
      }
      .th-empty-trophy{
        font-size:64px; line-height:1; margin-bottom:14px;
        filter:drop-shadow(0 6px 18px rgba(251,191,36,.4));
        opacity:.7;
        animation:thTrophyFloat 3.6s ease-in-out infinite;
      }
      .th-empty-title{
        font-family:'Bangers',cursive;
        font-size:24px; letter-spacing:1.6px;
        color:#FFE9B0; margin-bottom:8px;
      }
      .th-empty-sub{
        font-size:12.5px; font-weight:700; line-height:1.55;
        color:rgba(255,255,255,.55);
        margin:0 auto 18px; max-width:380px;
      }
      .th-empty-btn{
        border:none; cursor:pointer;
        padding:12px 24px; border-radius:12px;
        font-family:'Outfit',sans-serif; font-weight:900;
        font-size:12.5px; letter-spacing:1.4px;
        background:linear-gradient(135deg, #FBBF24 0%, #D97706 100%);
        color:#1A0F03;
        box-shadow:0 8px 22px rgba(251,191,36,.45);
        transition:transform .12s, filter .12s;
      }
      .th-empty-btn:hover{ filter:brightness(1.08); transform:translateY(-1px); }
      .th-err{
        text-align:center; padding:50px 20px;
        color:#f87171; font-weight:800;
      }
      .th-err a{ color:#FBBF24; display:inline-block; margin-top:10px; }

      /* ── RULES MODAL ────────────────────────────────────── */
      .th-rules-ov{
        position:fixed; inset:0; z-index:1500;
        display:flex; align-items:center; justify-content:center;
        padding:20px;
        background:rgba(4,6,14,.85);
        backdrop-filter:blur(14px);
        animation:avFadeIn .25s ease;
      }
      .th-rules-box{
        position:relative;
        width:min(460px, 95vw); padding:26px 26px 22px;
        border-radius:22px;
        background:linear-gradient(180deg, #1E1830 0%, #100918 100%);
        border:1px solid rgba(251,191,36,.18);
        box-shadow:0 40px 100px rgba(0,0,0,.85);
        animation:avPanelIn .4s cubic-bezier(.2,.9,.3,1.2);
      }
      .th-rules-x{
        position:absolute; top:14px; right:14px;
        width:32px; height:32px; border-radius:50%;
        background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
        color:rgba(255,255,255,.7); cursor:pointer; font-size:16px;
        display:flex; align-items:center; justify-content:center;
        transition:transform .25s, background .2s;
      }
      .th-rules-x:hover{ background:rgba(232,50,74,.4); color:#fff; transform:rotate(90deg); }
      .th-rules-eyebrow{
        font-size:10.5px; font-weight:900; letter-spacing:2.6px;
        color:#FBBF24; margin-bottom:6px;
      }
      .th-rules-title{
        font-family:'Bangers',cursive;
        font-size:28px; letter-spacing:1.8px;
        color:#FFE9B0; margin-bottom:18px;
      }
      .th-rules-list{ display:flex; flex-direction:column; gap:12px; margin-bottom:16px; }
      .th-rule{
        display:flex; gap:12px; align-items:flex-start;
        padding:10px 12px; border-radius:12px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.05);
        font-size:13px; line-height:1.5;
        color:rgba(255,255,255,.85);
      }
      .th-rule b{ color:#FBBF24; }
      .th-rule-n{
        flex:0 0 auto;
        width:26px; height:26px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:linear-gradient(135deg, #FBBF24, #D97706);
        color:#1A0F03;
        font-family:'Bangers',cursive; font-size:14px;
      }
      .th-rules-tip{
        font-size:11.5px; font-weight:700; line-height:1.5;
        color:rgba(255,255,255,.55);
        padding:10px 12px; border-radius:10px;
        background:rgba(251,191,36,.06);
        border:1px solid rgba(251,191,36,.14);
      }

      /* ── Mobile tightening ──────────────────────────────── */
      @media (max-width:520px){
        .th-hero{ padding:24px 18px 16px; }
        .th-hero-trophy{ font-size:48px; }
        .th-hero-title{ font-size:34px; letter-spacing:2px; }
        .th-hero-sub{ font-size:11.5px; }
        .th-stats{ grid-template-columns:repeat(2, 1fr); padding:14px 14px 4px; }
        .th-stat-val{ font-size:18px; }
        .th-stat-lbl{ font-size:8.5px; letter-spacing:1.2px; }
        .th-actions{ grid-template-columns:1fr; padding:10px 14px 4px; }
        .th-action{ padding:10px 12px; }
        .th-tabs{ margin:10px 14px 4px; padding:4px; }
        .th-tab{ padding:8px 6px; font-size:10px; letter-spacing:.6px; }
        .th-tab-emoji{ display:none; }
        .th-body{ padding:10px 14px 18px; }
        .th-featured{ margin:12px 14px 0; padding:14px 14px 12px; }
        .th-feat-name{ font-size:20px; }
        .th-feat-prize-val{ font-size:22px; }
        .th-card{ padding:14px; }
        .th-card-name{ font-size:16px; }
        .th-card-pot-val{ font-size:19px; }
        .th-tier-title{ font-size:15px; }
      }
    `;
    document.head.appendChild(s);
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
    if(Tourn.pendingMatch) doJoin(Tourn.pendingMatch.roomId);
  }

  function handleAuthEnter(e){
    if(e.key!=='Enter')return;
    if(document.getElementById('lf')?.style.display!=='none')doLogin();
    else doRegister();
  }

