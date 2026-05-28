  /* ═══════════════ MUSIC (GDD §9.3) ═══════════════
     Synthesized ambient music tracks via the Web Audio API. Two named tracks
     today — 'lobby' (slow modulated pad, ~80 BPM feel) and 'match' (gentle
     rhythmic pulse, ~120 BPM feel). Both are abstract synth loops, NOT real
     compositions — they're scaffolding so the lifecycle / mute / persistence
     plumbing works end-to-end. When real CC0 tracks land later, drop them
     into TRACK_URLS below and the scaffold swaps to <audio> playback without
     changing any caller.

     Lifecycle:
       * goLobby()  -> Music.switchTo('lobby')
       * game-screen active -> Music.switchTo('match')
       * auth-screen / leaving lobby -> Music.stop()
     Mute state persists in localStorage so the player's choice survives
     page refreshes. Default = ON. Browser autoplay policies require a user
     gesture before audio plays — Music defers the actual start() until the
     first click event after a track is requested. */

  const TRACK_URLS = {
    // Drop CC0 file paths here later — e.g. 'lobby':'/audio/lobby-lounge.mp3'.
    // While null, the module falls back to the synthesized ambient track below.
    lobby: null,
    match: null,
  };

  const Music = {
    ctx:           null,
    masterGain:    null,
    currentTrack:  null,                                 // 'lobby' | 'match' | null
    nodes:         [],                                   // active oscillator/filter nodes for the synth path
    audioEl:       null,                                 // <audio> when a TRACK_URL is configured
    muted:         false,
    volume:        0.18,                                 // 0..1; quiet by default — ambient, not foreground
    _pendingStart: null,                                 // track key queued behind autoplay policy
    _gestureBound: false,

    init(){
      // Restore persisted mute state.
      try{ this.muted = localStorage.getItem('uno_music_muted') === '1'; }catch(e){}
      // First user gesture unlocks autoplay; flush any pending track then.
      this._bindGesture();
    },

    _bindGesture(){
      if(this._gestureBound) return;
      this._gestureBound = true;
      const onGesture = ()=>{
        if(this._pendingStart){
          const t = this._pendingStart;
          this._pendingStart = null;
          this._startTrack(t);
        }
      };
      // pointerdown captures both mouse + touch on every modern browser.
      document.addEventListener('pointerdown', onGesture, { once:false, passive:true });
    },

    _ensureCtx(){
      if(this.ctx) return this.ctx;
      try{
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);
      }catch(e){
        console.warn('[Music] AudioContext init failed:', e?.message);
        this.ctx = null;
      }
      return this.ctx;
    },

    switchTo(track){
      if(track !== 'lobby' && track !== 'match'){
        this.stop();
        return;
      }
      if(this.currentTrack === track) return;
      this.currentTrack = track;
      // If browser hasn't accepted a user gesture yet, queue and bail.
      const ctx = this._ensureCtx();
      if(!ctx) return;
      if(ctx.state === 'suspended'){
        // Older Chrome/Safari leave ctx suspended until a gesture. Try to
        // resume; if it fails (no gesture yet), queue for the gesture handler.
        ctx.resume().then(()=>{
          if(this.currentTrack === track) this._startTrack(track);
        }).catch(()=>{ this._pendingStart = track; });
        return;
      }
      this._startTrack(track);
    },

    _startTrack(track){
      this._stopNodes();
      if(this.muted) return;                             // muted — keep nodes torn down
      const ctx = this._ensureCtx();
      if(!ctx) return;
      // Real-track path: when TRACK_URLS provides a src, use <audio>.
      const url = TRACK_URLS[track];
      if(url){
        if(!this.audioEl){
          this.audioEl = new Audio();
          this.audioEl.loop = true;
          this.audioEl.crossOrigin = 'anonymous';
          // Route through the master gain so mute + volume share one path.
          const src = ctx.createMediaElementSource(this.audioEl);
          src.connect(this.masterGain);
        }
        this.audioEl.src = url;
        this.audioEl.play().catch(()=>{ /* autoplay block — gesture handler will retry */ });
        return;
      }
      // Synth fallback path — two-oscillator pad with filter + slow LFO.
      // Cheap (~1% CPU); fine as ambient placeholder until real tracks land.
      const now = ctx.currentTime;
      const baseFreq = track === 'lobby' ? 110 : 138.6;  // A2 / C#3 ish
      const detune   = track === 'lobby' ? 7 : 12;
      const lpCutoff = track === 'lobby' ? 600 : 900;
      const lfoRate  = track === 'lobby' ? 0.10 : 0.20;
      // Two slightly detuned sines for a soft beat
      const osc1 = ctx.createOscillator(); osc1.type='sine'; osc1.frequency.value = baseFreq;
      const osc2 = ctx.createOscillator(); osc2.type='sine'; osc2.frequency.value = baseFreq + detune;
      const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value = lpCutoff; filt.Q.value = 0.4;
      const sumGain = ctx.createGain(); sumGain.gain.value = 0.5;
      osc1.connect(filt); osc2.connect(filt); filt.connect(sumGain); sumGain.connect(this.masterGain);
      // Slow tremolo LFO on the sum so the pad "breathes" rather than droning.
      const lfo = ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value = lfoRate;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.25;       // ±25% amplitude swing
      lfo.connect(lfoGain); lfoGain.connect(sumGain.gain);
      osc1.start(now); osc2.start(now); lfo.start(now);
      this.nodes = [osc1, osc2, filt, sumGain, lfo, lfoGain];
    },

    _stopNodes(){
      for(const n of this.nodes){
        try{ if(typeof n.stop === 'function') n.stop(); }catch(e){}
        try{ n.disconnect(); }catch(e){}
      }
      this.nodes = [];
      if(this.audioEl){ try{ this.audioEl.pause(); }catch(e){} }
    },

    stop(){
      this.currentTrack = null;
      this._pendingStart = null;
      this._stopNodes();
    },

    setMuted(on){
      this.muted = !!on;
      try{ localStorage.setItem('uno_music_muted', this.muted ? '1' : '0'); }catch(e){}
      if(this.masterGain){
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
      }
      // If we just unmuted and a track was requested, kick it back on.
      if(!this.muted && this.currentTrack && this.nodes.length === 0 && !this.audioEl){
        this._startTrack(this.currentTrack);
      }
    },
    toggleMuted(){ this.setMuted(!this.muted); return this.muted; },

    isMuted(){ return !!this.muted; },
  };

  // Boot — restore persisted muted state and bind the gesture flusher.
  // The first goLobby() / showScreen('game-screen') call will request a
  // track; if the browser hasn't accepted a gesture yet, the request
  // queues until pointerdown fires.
  Music.init();

  // ── Lifecycle hooks ────────────────────────────────────────────────
  // Wrap goLobby + showScreen so we don't have to edit the lobby module.
  (function _hookMusicLifecycle(){
    const origGoLobby   = window.goLobby;
    const origShowScreen= window.showScreen;
    if(typeof origGoLobby === 'function' && !origGoLobby._musicHooked){
      function goLobbyWithMusic(...args){
        const out = origGoLobby.apply(this, args);
        setTimeout(()=>Music.switchTo('lobby'), 60);
        return out;
      }
      goLobbyWithMusic._musicHooked = true;
      window.goLobby = goLobbyWithMusic;
    }
    if(typeof origShowScreen === 'function' && !origShowScreen._musicHooked){
      function showScreenWithMusic(id, ...args){
        const out = origShowScreen.call(this, id, ...args);
        if(id === 'game-screen') setTimeout(()=>Music.switchTo('match'), 60);
        else if(id === 'auth-screen') Music.stop();
        return out;
      }
      showScreenWithMusic._musicHooked = true;
      window.showScreen = showScreenWithMusic;
    }
  })();

  // Public mute toggle used by the game-menu Music item.
  function toggleMusic(){
    const muted = Music.toggleMuted();
    refreshMusicLabel(muted);
  }
  function refreshMusicLabel(muted){
    if(typeof muted !== 'boolean') muted = Music.isMuted();
    const el = document.getElementById('musicLabel');
    if(el) el.textContent = `Music: ${muted ? 'OFF' : 'ON'}`;
  }
  // Sync the menu label with the persisted mute state once the DOM is ready.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>refreshMusicLabel(), { once:true });
  } else {
    refreshMusicLabel();
  }
