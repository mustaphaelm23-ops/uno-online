  /* ═══════════════ MATCH-START CINEMATIC ═══════════════
     Plays a 3-2-1-GO countdown over the freshly-rendered game screen.
     Sequence (~2.6s total):
       1. Backdrop fades in + scattered playing cards burst out from center
       2. Player avatars slide in from the edges with their name plates
       3. "3", "2", "1" big Bangers numbers whoosh in (scale + fade) — 1/sec
       4. "GO!" lands with a white flash + card explosion at center
       5. Whole overlay fades, revealing the live game underneath

     Hook: the socket handler kicks this off AFTER state is applied + the
     game screen is shown, so the live UI is fully populated underneath
     and immediately usable when the cinematic fades. */

  const MatchIntro = {
    _running: false,
    _node: null,

    /* ── public entry — returns a Promise that resolves when done ── */
    play(state){
      // Don't double-play (defensive against rapid re-entry from
      // game:state events on resync etc).
      if(this._running) return Promise.resolve();
      // Respect reduced-motion: skip the animation entirely.
      if(matchMedia('(prefers-reduced-motion:reduce)').matches) return Promise.resolve();
      // Skip the 3-2-1-GO cinematic on phones — burst particles + seat
      // slide-ins + countdown digits are pretty but they delay the
      // first playable beat by ~3s and torch GPU during that window.
      if(document.body.classList.contains('mobile-lite')) return Promise.resolve();
      _ensureIntroStyles();
      this._running = true;
      return new Promise(resolve=>{
        const ov = this._build(state);
        document.body.appendChild(ov);
        this._node = ov;
        // Trigger the entry on the next frame so the transition runs.
        requestAnimationFrame(()=>ov.classList.add('show'));

        // Phase timings (ms from overlay show)
        const t1 = 280;   // players slide in
        const t2 = 700;   // "3"
        const t3 = 1300;  // "2"
        const t4 = 1900;  // "1"
        const t5 = 2500;  // "GO!" + flash
        const tEnd = 3000;
        const tGone = 3300;

        // Players slide in
        setTimeout(()=>{
          ov.classList.add('players-in');
          if(typeof SFX !== 'undefined') SFX.play('open');
        }, t1);
        // Countdown beats — 3, 2, 1
        setTimeout(()=>this._beat(ov, '3'), t2);
        setTimeout(()=>this._beat(ov, '2'), t3);
        setTimeout(()=>this._beat(ov, '1'), t4);
        // GO!
        setTimeout(()=>{
          this._beat(ov, 'GO!', true);
          ov.classList.add('flash');
        }, t5);
        // Fade out
        setTimeout(()=>ov.classList.add('out'), tEnd);
        // Cleanup
        setTimeout(()=>{
          ov.remove();
          this._node = null;
          this._running = false;
          resolve();
        }, tGone);
      });
    },

    _beat(ov, txt, isGo){
      const wrap = ov.querySelector('.mi-count');
      if(!wrap) return;
      const span = document.createElement('span');
      span.className = 'mi-count-n' + (isGo ? ' mi-count-go' : '');
      span.textContent = txt;
      wrap.appendChild(span);
      // Auto-remove the digit after its animation ends so the DOM stays small.
      setTimeout(()=>span.remove(), 900);
      if(typeof SFX !== 'undefined') SFX.play(isGo ? 'win' : 'click');
    },

    /* ── build the overlay DOM ── */
    _build(state){
      const players = (state?.players || []);
      const meId = (window.S && S.user && S.user.id) || null;
      // Detect RANKED match — either via state.roomType from server, or
      // the client-side fallback S.currentRoomType stamped at quick-join.
      const isRanked = state?.roomType === 'RANKED'
                    || (window.S && S.currentRoomType === 'RANKED');
      // Detect game type so we can title the intro correctly + pick the
      // best layout (1v1 → VS face-off, 3+ → original seat scatter).
      const rawType = state?.roomType || (window.S && S.currentRoomType) || 'UNO';
      const TITLE_BY_TYPE = {
        DAMA:        'CHECKERS',
        RANKED:      'RANKED',
        CLASSIC:     'Cardora',
        CHILL:       'Cardora',
        PRIVATE:     'Cardora',
        RONDA:       'RONDA',
        CHESS:  'CHESS',
        UNO:         'Cardora',
      };
      const gameTitle = TITLE_BY_TYPE[rawType] || 'Cardora';
      const is1v1 = players.length === 2;

      // 1v1 path — render a proper VS face-off (LEFT = me, VS in the
      // center, RIGHT = opponent). All other player counts fall through
      // to the original seat-scatter layout.
      if(is1v1){
        return this._buildVS(state, players, meId, isRanked, gameTitle, rawType);
      }

      // Place opponents in slots around the screen (top + sides), me at
      // the bottom. The picture-style table arrangement.
      const opponents = players.filter(p => p.id !== meId);
      const slots = ['top', 'left', 'right'];

      const seatsHTML = opponents.slice(0, 3).map((p, i)=>{
        const slot = slots[i] || 'top';
        const avatarStyle = p.avatar && /^https?:|^data:|^\//.test(p.avatar)
          ? `background-image:url('${esc(p.avatar)}');`
          : '';
        const initial = !avatarStyle ? esc((p.username || '?')[0]).toUpperCase() : '';
        // Tier badge under each opponent name (RANKED only). Decorated
        // server-side via decorateRankedState — null means still in placement.
        const tierBadge = (isRanked && p.rankedTier)
          ? `<div class="mi-seat-tier" style="color:${p.rankedTier.color || '#FBBF24'}">${p.rankedTier.badge || '🏆'} ${p.rankedTier.label || p.rankedTier.name || ''}${p.rankPoints ? ' · '+p.rankPoints+' RP' : ''}</div>`
          : (isRanked && p.isPlacement)
            ? `<div class="mi-seat-tier" style="color:#FBBF24">🎯 PLACEMENT</div>`
            : '';
        return `<div class="mi-seat mi-seat-${slot}" style="--i:${i}">
          <div class="mi-seat-av" style="${avatarStyle}">${initial}</div>
          <div class="mi-seat-name">${esc(p.username || 'Player')}${verifiedBadgeHTML(p.username,{isBot:p.isBot,size:'xs'})}</div>
          ${tierBadge}
        </div>`;
      }).join('');

      // My seat at the bottom — always shown when state has my username.
      const me = players.find(p => p.id === meId);
      const myStyle = me?.avatar && /^https?:|^data:|^\//.test(me.avatar)
        ? `background-image:url('${esc(me.avatar)}');`
        : '';
      const myInit = !myStyle ? esc((me?.username || '?')[0]).toUpperCase() : '';
      const myTierBadge = (isRanked && me?.rankedTier)
        ? `<div class="mi-seat-tier" style="color:${me.rankedTier.color || '#FBBF24'}">${me.rankedTier.badge || '🏆'} ${me.rankedTier.label || me.rankedTier.name || ''}${me.rankPoints ? ' · '+me.rankPoints+' RP' : ''}</div>`
        : (isRanked && me?.isPlacement)
          ? `<div class="mi-seat-tier" style="color:#FBBF24">🎯 PLACEMENT ${me?.placementGamesPlayed || 0}/5</div>`
          : '';
      const meHTML = me
        ? `<div class="mi-seat mi-seat-me">
             <div class="mi-seat-av" style="${myStyle}">${myInit}</div>
             <div class="mi-seat-name">${esc(me.username)}${verifiedBadgeHTML(me.username,{size:'xs'})} <span class="mi-seat-tag">YOU</span></div>
             ${myTierBadge}
           </div>`
        : '';

      // 6 scattered playing-card decorations bursting outward from center.
      const burst = [0, 1, 2, 3, 4, 5].map(i=>{
        const ang = (i / 6) * 360;
        return `<span class="mi-burst-card" style="--ang:${ang}deg;--i:${i}"></span>`;
      }).join('');

      // Ranked stakes preview — what the player will win/lose at this match.
      // Approx ±25 RP base (matches RANKED_BASE in server) — the real number
      // depends on placement + opponent ranks; we deliberately keep it
      // simple here so the player reads a clean stakes line, not math.
      const meUser = (window.S && S.user) || {};
      const inPlace = (meUser.placementGamesPlayed || 0) < 5;
      const stakesHTML = isRanked
        ? `<div class="mi-stakes">
             ${inPlace
                ? `<div class="mi-stakes-eyebrow">🎯 PLACEMENT MATCH ${(meUser.placementGamesPlayed||0)+1}/5</div>
                   <div class="mi-stakes-line">Earn your starting rank · 1.5× RP swing</div>`
                : `<div class="mi-stakes-eyebrow">⚔️ RANKED</div>
                   <div class="mi-stakes-line"><span style="color:#5dd75d">+25 RP WIN</span> · <span style="color:#ff6b6b">-25 RP LOSS</span></div>`}
           </div>`
        : '';

      const eyebrow = isRanked
        ? `<div class="mi-eyebrow" style="color:#FF6B6B;letter-spacing:5px">🏆 RANKED MATCH</div>`
        : `<div class="mi-eyebrow">⚔️ MATCH STARTING</div>`;
      const titleStyle = isRanked
        ? `background:linear-gradient(180deg,#FBBF24 0%,#FF6B6B 100%);-webkit-background-clip:text;background-clip:text;color:transparent`
        : '';

      const ov = document.createElement('div');
      ov.className = 'mi-ov' + (isRanked ? ' mi-ov-ranked' : '');
      ov.innerHTML = `
        <div class="mi-bg"></div>
        <div class="mi-flash"></div>
        <div class="mi-burst" aria-hidden="true">${burst}</div>
        <div class="mi-head">
          ${eyebrow}
          <div class="mi-title" style="${titleStyle}">${esc(gameTitle)}</div>
          ${stakesHTML}
        </div>
        <div class="mi-seats">${seatsHTML}${meHTML}</div>
        <div class="mi-count" aria-hidden="true"></div>
      `;
      return ov;
    },

    /* ── 1v1 VS face-off layout ──────────────────────────────────────
       Left side: ME (huge avatar in green ring, name + tier).
       Center:    Massive gold-red "VS" with sparks + sliding lightning.
       Right side: OPPONENT (huge avatar in gold ring, name + tier).
       Below: stakes / game-type pill.
       Above: eyebrow + game-type title (CHECKERS, UNO, ...). */
    _buildVS(state, players, meId, isRanked, gameTitle, rawType){
      const me  = players.find(p => p.id === meId) || players[0];
      const opp = players.find(p => p.id !== meId) || players[1];

      const avHTML = (p, side) => {
        const style = (p?.avatar && /^https?:|^data:|^\//.test(p.avatar))
          ? `background-image:url('${esc(p.avatar)}');` : '';
        const initial = style ? '' : esc((p?.username || '?')[0]).toUpperCase();
        const tier = (isRanked && p?.rankedTier)
          ? `<div class="mi-vs-tier" style="color:${p.rankedTier.color || '#FBBF24'}">${p.rankedTier.badge || '🏆'} ${p.rankedTier.label || p.rankedTier.name || ''}${p.rankPoints ? ' · '+p.rankPoints+' RP' : ''}</div>`
          : '';
        const tag = side === 'me' ? '<span class="mi-vs-tag">YOU</span>' : '';
        return `
          <div class="mi-vs-seat mi-vs-${side}">
            <div class="mi-vs-ring">
              <div class="mi-vs-av" style="${style}">${initial}</div>
            </div>
            <div class="mi-vs-name">${esc(p?.username || 'Player')}${tag}</div>
            ${tier}
          </div>`;
      };

      // Stake / bet line (DAMA also adds 5-min badge).
      const bet = state?.bet || state?.pot || (window.S && S.currentRoomBet) || 0;
      const stakeLine = isRanked
        ? '<span class="mi-vs-stake-pill"><span style="color:#FF6B6B;font-weight:900">RANKED</span> · 25 RP swing</span>'
        : (bet ? `<span class="mi-vs-stake-pill">🪙 <b>${bet.toLocaleString()}</b> entry</span>` : '');
      const damaPill = rawType === 'DAMA'
        ? '<span class="mi-vs-stake-pill">⏱ 5:00 match</span>' : '';

      // Sparks bursting from the VS center.
      const sparks = [0,1,2,3,4,5,6,7].map(i=>
        `<span class="mi-vs-spark" style="--ang:${(i/8)*360}deg;--i:${i}"></span>`
      ).join('');

      const ov = document.createElement('div');
      ov.className = 'mi-ov mi-ov-1v1' + (isRanked ? ' mi-ov-ranked' : '');
      ov.innerHTML = `
        <div class="mi-bg"></div>
        <div class="mi-flash"></div>
        <div class="mi-head">
          <div class="mi-eyebrow">${isRanked ? '🏆 RANKED MATCH' : '⚔️ MATCH STARTING'}</div>
          <div class="mi-title">${esc(gameTitle)}</div>
          <div class="mi-vs-stakes">${stakeLine}${damaPill}</div>
        </div>
        <div class="mi-vs-row">
          ${avHTML(me, 'me')}
          <div class="mi-vs-center">
            <div class="mi-vs-sparks" aria-hidden="true">${sparks}</div>
            <div class="mi-vs-text">VS</div>
            <div class="mi-vs-bolt" aria-hidden="true"></div>
          </div>
          ${avHTML(opp, 'opp')}
        </div>
        <div class="mi-count" aria-hidden="true"></div>
      `;
      return ov;
    },
  };

  window.MatchIntro = MatchIntro;

  function _ensureIntroStyles(){
    if(document.getElementById('matchIntroStyles')) return;
    const s = document.createElement('style');
    s.id = 'matchIntroStyles';
    s.textContent = `
      /* ── Overlay shell ── */
      .mi-ov{
        position:fixed; inset:0; z-index:1500;
        display:flex; align-items:center; justify-content:center;
        opacity:0;
        transition:opacity .35s ease;
        pointer-events:none;
        font-family:'Outfit',sans-serif;
        overflow:hidden;
      }
      .mi-ov.show{ opacity:1; }
      .mi-ov.out{ opacity:0; transition:opacity .3s ease; }

      /* Animated radial backdrop */
      .mi-bg{
        position:absolute; inset:0;
        background:
          radial-gradient(ellipse at 50% 50%, rgba(251,191,36,.18) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(232,50,74,.30) 0%, transparent 70%),
          linear-gradient(180deg, rgba(4,8,18,.65) 0%, rgba(4,8,18,.90) 100%);
        backdrop-filter:blur(8px) saturate(140%);
        -webkit-backdrop-filter:blur(8px) saturate(140%);
        animation:miBgPulse 2.6s ease-in-out;
      }
      @keyframes miBgPulse{
        0%   { filter:brightness(.7) }
        40%  { filter:brightness(1.0) }
        80%  { filter:brightness(1.1) }
        100% { filter:brightness(1.0) }
      }

      /* White flash on GO! */
      .mi-flash{
        position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none;
      }
      .mi-ov.flash .mi-flash{ animation:miFlash .55s ease-out; }
      @keyframes miFlash{
        0%   { opacity:0 }
        12%  { opacity:.85 }
        100% { opacity:0 }
      }

      /* ── Header eyebrow + UNO title ── */
      .mi-head{
        position:absolute; top:14%; left:0; right:0;
        text-align:center; pointer-events:none;
        transform:translateY(-18px); opacity:0;
        transition:transform .55s cubic-bezier(.18,.89,.32,1.07), opacity .55s ease;
        transition-delay:.15s;
      }
      .mi-ov.show .mi-head{ transform:translateY(0); opacity:1; }
      .mi-eyebrow{
        font-size:12px; font-weight:900; letter-spacing:4px;
        color:#FBBF24; text-transform:uppercase;
        margin-bottom:6px;
        text-shadow:0 2px 8px rgba(0,0,0,.5), 0 0 20px rgba(251,191,36,.5);
      }
      .mi-title{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:84px; font-weight:400; letter-spacing:6px; line-height:1;
        background:linear-gradient(180deg, #FFFBEB 0%, #FDE68A 40%, #FBBF24 70%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 4px 0 rgba(0,0,0,.4)) drop-shadow(0 0 30px rgba(251,191,36,.45));
        animation:miTitleBob 2.6s ease-in-out infinite;
      }
      @keyframes miTitleBob{
        0%,100%{ transform:translateY(0) }
        50%    { transform:translateY(-4px) }
      }

      /* ── Burst cards exploding outward from center ── */
      .mi-burst{
        position:absolute; left:50%; top:50%;
        width:0; height:0; pointer-events:none;
      }
      .mi-burst-card{
        position:absolute; left:0; top:0;
        width:50px; height:70px; border-radius:8px;
        background:linear-gradient(150deg, #FFFBEB 0%, #FBBF24 60%, #D97706 100%);
        border:2px solid #FFFBEB;
        box-shadow:0 8px 22px rgba(0,0,0,.55),
                   inset 0 1px 0 rgba(255,255,255,.5);
        transform:translate(-50%, -50%) rotate(0deg) scale(.2);
        opacity:0;
        animation:miBurst 1.6s cubic-bezier(.16,1,.3,1) both;
        animation-delay:calc(.05s + var(--i) * .08s);
      }
      @keyframes miBurst{
        0%   { transform:translate(-50%, -50%) rotate(0deg) scale(.2); opacity:0; }
        20%  { opacity:.95; }
        100% {
          transform:
            translate(calc(-50% + cos(var(--ang)) * 280px),
                      calc(-50% + sin(var(--ang)) * 200px))
            rotate(calc(var(--ang) + 180deg))
            scale(1);
          opacity:0;
        }
      }
      /* Alternating colors so the burst doesn't read as monochrome */
      .mi-burst-card:nth-child(2){background:linear-gradient(150deg,#FFFBEB,#F472B6 60%,#9D174D);}
      .mi-burst-card:nth-child(3){background:linear-gradient(150deg,#FFFBEB,#60A5FA 60%,#1D4ED8);}
      .mi-burst-card:nth-child(4){background:linear-gradient(150deg,#FFFBEB,#22C55E 60%,#14532D);}
      .mi-burst-card:nth-child(5){background:linear-gradient(150deg,#FFFBEB,#A78BFA 60%,#5B21B6);}
      .mi-burst-card:nth-child(6){background:linear-gradient(150deg,#FFFBEB,#E8324A 60%,#7C1D2C);}

      /* ── Seats sliding in around the screen ── */
      .mi-seats{
        position:absolute; inset:0;
        pointer-events:none;
      }
      .mi-seat{
        position:absolute;
        display:flex; flex-direction:column; align-items:center; gap:8px;
        opacity:0;
        transition:transform .55s cubic-bezier(.18,.89,.32,1.07), opacity .55s ease;
      }
      .mi-ov.players-in .mi-seat{ opacity:1; transform:translate(var(--tx,0), var(--ty,0)) scale(1); }
      .mi-seat-top   { top:30%;    left:50%;  transform:translate(-50%, -60px); --tx:-50%; --ty:0; }
      .mi-seat-left  { top:52%;    left:13%;  transform:translate(-80px, -50%); --tx:0;    --ty:-50%; }
      .mi-seat-right { top:52%;    right:13%; transform:translate(80px, -50%);  --tx:0;    --ty:-50%; }
      .mi-seat-me    { bottom:18%; left:50%;  transform:translate(-50%, 60px);  --tx:-50%; --ty:0; }
      .mi-ov.players-in .mi-seat-left  { transform:translate(0, -50%); }
      .mi-ov.players-in .mi-seat-right { transform:translate(0, -50%); }
      .mi-ov.players-in .mi-seat-top   { transform:translate(-50%, 0); }
      .mi-ov.players-in .mi-seat-me    { transform:translate(-50%, 0); }

      .mi-seat-av{
        width:80px; height:80px; border-radius:50%;
        background:
          radial-gradient(circle at 30% 25%, rgba(255,255,255,.30), rgba(255,255,255,0) 55%),
          linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%);
        background-size:cover; background-position:center;
        border:3px solid #FBBF24;
        display:flex; align-items:center; justify-content:center;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:34px; letter-spacing:1px; color:#FFFBEB;
        text-shadow:0 2px 4px rgba(0,0,0,.6);
        box-shadow:
          0 10px 30px rgba(0,0,0,.55),
          0 0 30px rgba(251,191,36,.5),
          inset 0 2px 0 rgba(255,255,255,.2);
        animation:miSeatPulse 2s ease-in-out infinite;
      }
      @keyframes miSeatPulse{
        0%,100%{ box-shadow:0 10px 30px rgba(0,0,0,.55), 0 0 24px rgba(251,191,36,.40), inset 0 2px 0 rgba(255,255,255,.2); }
        50%    { box-shadow:0 12px 36px rgba(0,0,0,.65), 0 0 44px rgba(251,191,36,.65), inset 0 2px 0 rgba(255,255,255,.25); }
      }
      .mi-seat-me .mi-seat-av{
        border-color:#22C55E;
        animation:miSeatPulseMe 2s ease-in-out infinite;
      }
      @keyframes miSeatPulseMe{
        0%,100%{ box-shadow:0 10px 30px rgba(0,0,0,.55), 0 0 24px rgba(34,197,94,.45), inset 0 2px 0 rgba(255,255,255,.2); }
        50%    { box-shadow:0 12px 36px rgba(0,0,0,.65), 0 0 44px rgba(34,197,94,.70), inset 0 2px 0 rgba(255,255,255,.25); }
      }
      .mi-seat-name{
        font-family:'Outfit',sans-serif;
        font-size:14px; font-weight:900; letter-spacing:1.5px;
        color:#FFFBEB; text-transform:uppercase;
        padding:5px 12px; border-radius:10px;
        background:rgba(0,0,0,.45);
        border:1px solid rgba(251,191,36,.4);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.1);
        white-space:nowrap;
      }
      .mi-seat-tag{
        margin-left:6px; padding:1px 7px; border-radius:99px;
        background:linear-gradient(180deg, #22C55E, #15803D);
        color:#fff; font-size:10px; font-weight:900; letter-spacing:1px;
      }

      /* ── Ranked tier badge under each seat name ── */
      .mi-seat-tier{
        margin-top:2px;
        font-size:10px; font-weight:800; letter-spacing:1.2px;
        text-transform:uppercase; text-shadow:0 1px 4px rgba(0,0,0,.8);
        white-space:nowrap;
      }

      /* ── RANKED variant: gold/red themed ring + stakes ── */
      .mi-ov-ranked .mi-bg{
        background:
          radial-gradient(ellipse at 50% 50%, rgba(255,107,107,.22) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(251,191,36,.32) 0%, transparent 70%),
          linear-gradient(180deg, rgba(20,4,4,.75) 0%, rgba(4,4,18,.92) 100%);
      }
      .mi-ov-ranked .mi-seat-av{
        border-color:#FF6B6B;
        animation:miSeatPulseRanked 1.6s ease-in-out infinite;
      }
      @keyframes miSeatPulseRanked{
        0%,100%{ box-shadow:0 10px 30px rgba(0,0,0,.6), 0 0 30px rgba(255,107,107,.55), inset 0 2px 0 rgba(255,255,255,.2); }
        50%    { box-shadow:0 12px 36px rgba(0,0,0,.7), 0 0 55px rgba(255,107,107,.85), inset 0 2px 0 rgba(255,255,255,.25); }
      }
      .mi-ov-ranked .mi-seat-me .mi-seat-av{
        border-color:#FBBF24;
      }
      .mi-stakes{
        margin-top:14px;
        display:inline-block;
        padding:8px 18px;
        background:linear-gradient(180deg, rgba(255,107,107,.18), rgba(251,191,36,.14));
        border:1px solid rgba(255,107,107,.45);
        border-radius:99px;
        backdrop-filter:blur(6px);
      }
      .mi-stakes-eyebrow{
        font-size:10px; font-weight:900; letter-spacing:3px;
        color:#FFFBEB; text-transform:uppercase;
        margin-bottom:2px;
      }
      .mi-stakes-line{
        font-size:13px; font-weight:800; letter-spacing:1px;
        color:#FFFBEB;
      }

      /* ── Countdown numbers ── */
      .mi-count{
        position:absolute; left:50%; top:50%;
        transform:translate(-50%, -50%);
        pointer-events:none;
      }
      .mi-count-n{
        position:absolute; left:50%; top:50%;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:200px; font-weight:400; letter-spacing:6px; line-height:1;
        background:linear-gradient(180deg, #FFFBEB 0%, #FDE68A 40%, #FBBF24 70%, #D97706 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 8px 24px rgba(0,0,0,.6)) drop-shadow(0 0 40px rgba(251,191,36,.7));
        transform:translate(-50%, -50%) scale(.2);
        opacity:0;
        animation:miNumIn .9s cubic-bezier(.18,.89,.32,1.07) both;
      }
      .mi-count-go{
        font-size:170px; letter-spacing:8px;
        background:linear-gradient(180deg, #FFFBEB 0%, #FCA5A5 30%, #E8324A 60%, #B91C2C 100%);
        -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        filter:drop-shadow(0 8px 24px rgba(0,0,0,.6)) drop-shadow(0 0 60px rgba(244,63,94,.85));
        animation:miGoIn 1s cubic-bezier(.18,.89,.32,1.07) both;
      }
      @keyframes miNumIn{
        0%   { transform:translate(-50%, -50%) scale(.1) rotate(-12deg); opacity:0; }
        25%  { transform:translate(-50%, -50%) scale(1.25) rotate(0deg); opacity:1; }
        60%  { transform:translate(-50%, -50%) scale(1.05); opacity:1; }
        100% { transform:translate(-50%, -50%) scale(2.4); opacity:0; }
      }
      @keyframes miGoIn{
        0%   { transform:translate(-50%, -50%) scale(.1)  rotate(-18deg); opacity:0; }
        20%  { transform:translate(-50%, -50%) scale(1.35) rotate(2deg);   opacity:1; }
        50%  { transform:translate(-50%, -50%) scale(1.15) rotate(-1deg);  opacity:1; }
        100% { transform:translate(-50%, -50%) scale(3.5)  rotate(0);      opacity:0; }
      }

      /* Mobile tweaks */
      @media (max-width:520px){
        .mi-title{ font-size:54px; letter-spacing:4px; }
        .mi-seat-av{ width:62px; height:62px; font-size:26px; border-width:2.5px; }
        .mi-seat-name{ font-size:12px; padding:4px 10px; }
        .mi-seat-top{ top:22%; }
        .mi-seat-left{ left:8%; }
        .mi-seat-right{ right:8%; }
        .mi-seat-me{ bottom:24%; }
        .mi-count-n{ font-size:140px; }
        .mi-count-go{ font-size:120px; }
      }

      /* ════════════════════════════════════════════════════════════
         1v1 VS FACE-OFF LAYOUT
         ──────────────────────────────────────────────────────────── */
      .mi-ov-1v1 .mi-vs-row{
        position:absolute; left:0; right:0; top:50%;
        transform:translateY(-50%);
        display:flex; align-items:center; justify-content:center;
        gap:6vw;
        padding:0 4vw;
        pointer-events:none;
      }
      .mi-vs-seat{
        flex:1; max-width:280px;
        display:flex; flex-direction:column; align-items:center;
        opacity:0;
        transition:transform .65s cubic-bezier(.18,.89,.32,1.07), opacity .55s ease;
        transition-delay:.18s;
      }
      .mi-vs-me  { transform:translateX(-80px); }
      .mi-vs-opp { transform:translateX(80px);  }
      .mi-ov.show .mi-vs-seat{ opacity:1; transform:translateX(0); }

      .mi-vs-ring{
        position:relative;
        width:138px; height:138px; border-radius:50%;
        padding:6px;
        background:conic-gradient(from 0deg, #FBBF24, #E8324A, #FBBF24);
        box-shadow:
          0 18px 38px rgba(0,0,0,.55),
          0 0 32px rgba(251,191,36,.4),
          inset 0 2px 0 rgba(255,255,255,.22);
        animation:miVsRingSpin 6s linear infinite, miVsRingPulse 2.2s ease-in-out infinite;
      }
      @keyframes miVsRingSpin { to{ transform:rotate(360deg) } }
      @keyframes miVsRingPulse{
        0%,100% { filter:drop-shadow(0 0 18px rgba(251,191,36,.4)); }
        50%     { filter:drop-shadow(0 0 32px rgba(232,50,74,.7)); }
      }
      .mi-vs-me .mi-vs-ring{
        background:conic-gradient(from 0deg, #22C55E, #14B8A6, #22C55E);
        box-shadow:
          0 18px 38px rgba(0,0,0,.55),
          0 0 32px rgba(34,197,94,.5),
          inset 0 2px 0 rgba(255,255,255,.22);
        animation:miVsRingSpin 6s linear infinite, miVsRingPulseMe 2.2s ease-in-out infinite;
      }
      @keyframes miVsRingPulseMe{
        0%,100% { filter:drop-shadow(0 0 18px rgba(34,197,94,.45)); }
        50%     { filter:drop-shadow(0 0 34px rgba(34,197,94,.85)); }
      }
      .mi-vs-av{
        width:100%; height:100%; border-radius:50%;
        background:
          radial-gradient(circle at 30% 25%, rgba(255,255,255,.30), rgba(255,255,255,0) 55%),
          linear-gradient(180deg, #7C3AED 0%, #4C1D95 100%);
        background-size:cover; background-position:center;
        display:flex; align-items:center; justify-content:center;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:54px; color:#FFFBEB;
        text-shadow:0 3px 6px rgba(0,0,0,.6);
        border:3px solid rgba(0,0,0,.5);
      }
      .mi-vs-name{
        margin-top:14px;
        font-family:'Bangers','Outfit',sans-serif;
        font-size:24px; letter-spacing:1.5px;
        color:#FFFBEB;
        text-shadow:0 3px 8px rgba(0,0,0,.7), 0 0 18px rgba(251,191,36,.4);
        text-align:center;
        display:flex; align-items:center; gap:8px;
      }
      .mi-vs-tag{
        background:linear-gradient(180deg, #22C55E, #15803D);
        color:#fff; font-size:12px; font-weight:900; letter-spacing:1px;
        padding:2px 8px; border-radius:99px;
        font-family:'Outfit',sans-serif;
      }
      .mi-vs-tier{
        margin-top:4px;
        font-size:11px; font-weight:900; letter-spacing:1.5px;
        text-shadow:0 2px 4px rgba(0,0,0,.7);
      }

      /* Center "VS" with sparks + lightning */
      .mi-vs-center{
        position:relative;
        flex:0 0 auto;
        display:flex; align-items:center; justify-content:center;
        width:160px; height:160px;
        opacity:0;
        transform:scale(.4) rotate(-12deg);
        transition:transform .8s cubic-bezier(.18,.89,.32,1.4), opacity .55s ease;
        transition-delay:.45s;
      }
      .mi-ov.show .mi-vs-center{ opacity:1; transform:scale(1) rotate(0deg); }
      .mi-vs-text{
        font-family:'Bangers','Outfit',sans-serif;
        font-size:108px; letter-spacing:6px; line-height:1;
        background:linear-gradient(180deg, #FFFBEB 0%, #FBBF24 35%, #E8324A 100%);
        -webkit-background-clip:text; background-clip:text;
        -webkit-text-fill-color:transparent;
        filter:
          drop-shadow(0 6px 0 rgba(0,0,0,.5))
          drop-shadow(0 0 30px rgba(251,191,36,.7))
          drop-shadow(0 0 60px rgba(232,50,74,.6));
        animation:miVsThump 1.4s ease-in-out infinite;
        position:relative; z-index:2;
      }
      @keyframes miVsThump{
        0%,100% { transform:scale(1); }
        50%     { transform:scale(1.08); }
      }
      .mi-vs-bolt{
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 50% 50%, rgba(251,191,36,.25) 0%, transparent 55%);
        z-index:1;
        animation:miVsBoltPulse 1.8s ease-in-out infinite;
      }
      @keyframes miVsBoltPulse{
        0%,100%{ opacity:.6; }
        50%    { opacity:1; }
      }
      .mi-vs-sparks{
        position:absolute; left:50%; top:50%;
        width:0; height:0;
        pointer-events:none; z-index:0;
      }
      .mi-vs-spark{
        position:absolute; left:0; top:0;
        width:8px; height:30px;
        background:linear-gradient(180deg, rgba(251,191,36,0), #FBBF24 50%, rgba(251,191,36,0));
        transform-origin:0 0;
        opacity:0;
        animation:miVsSpark 1.6s cubic-bezier(.16,1,.3,1) infinite;
        animation-delay:calc(var(--i) * .15s);
      }
      @keyframes miVsSpark{
        0%   { opacity:0; transform:rotate(var(--ang)) translate(40px) scale(.4); }
        30%  { opacity:1; }
        100% { opacity:0; transform:rotate(var(--ang)) translate(130px) scale(1); }
      }

      /* Stake / mode pills under the title */
      .mi-vs-stakes{
        margin-top:10px;
        display:flex; gap:8px; justify-content:center; flex-wrap:wrap;
      }
      .mi-vs-stake-pill{
        display:inline-flex; align-items:center; gap:5px;
        padding:5px 12px; border-radius:99px;
        background:rgba(0,0,0,.55);
        border:1px solid rgba(251,191,36,.45);
        color:#FFFBEB;
        font-size:12px; font-weight:800; letter-spacing:1px;
        text-shadow:0 1px 4px rgba(0,0,0,.6);
      }
      .mi-vs-stake-pill b{ color:#FBBF24; }

      /* Phone tweaks for the VS layout */
      @media (max-width:520px){
        .mi-ov-1v1 .mi-vs-row{ gap:4vw; padding:0 3vw; }
        .mi-vs-ring{ width:108px; height:108px; padding:5px; }
        .mi-vs-av{ font-size:42px; }
        .mi-vs-name{ font-size:18px; margin-top:10px; }
        .mi-vs-center{ width:120px; height:120px; }
        .mi-vs-text{ font-size:76px; letter-spacing:4px; }
        .mi-vs-tier{ font-size:10px; }
      }
      @media (max-height:600px){
        .mi-ov-1v1 .mi-vs-row{ gap:5vw; }
        .mi-vs-ring{ width:100px; height:100px; padding:4px; }
        .mi-vs-av{ font-size:38px; }
        .mi-vs-center{ width:110px; height:110px; }
        .mi-vs-text{ font-size:70px; }
      }
    `;
    document.head.appendChild(s);
  }
