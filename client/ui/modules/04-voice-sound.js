  /* ═══════════════════════════════════════════
    SOUND SYSTEM (Web Audio API)
    ═══════════════════════════════════════════ */
  const Voice = {
    enabled: true,
    voice: null,
    _ready: false,
    _init(){
      if(!('speechSynthesis' in window)) { this.enabled = false; return; }
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice =
          voices.find(v => /en-US/i.test(v.lang) && /female|samantha|google.*us/i.test(v.name)) ||
          voices.find(v => /en-US/i.test(v.lang)) ||
          voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
        this._ready = true;
      };
      pickVoice();
      if(!this._ready) window.speechSynthesis.onvoiceschanged = pickVoice;
    },
    say(text){
      // Global mute — voice announcements disabled across the app.
      return;
    },
    sayDraw(count){
      const n = Math.max(1, count|0);
      const words = {1:'draw card',2:'draw two',3:'draw three',4:'draw four',5:'draw five',6:'draw six',7:'draw seven',8:'draw eight',9:'draw nine',10:'draw ten'};
      this.say(words[n] || `draw ${n}`);
    }
  };

  /* ═══════════════════════════════════════════
    VOICE CHAT — peer-to-peer over WebRTC
    Uses the existing socket.io connection only for SDP/ICE signaling.
    Audio itself goes directly between players (no server bandwidth).
    ═══════════════════════════════════════════ */
  const VoiceChat = {
    // ── State model (kept simple + bulletproof) ──
    //   connected : we're in the room's voice channel (peers wired up)
    //   hasMic    : we successfully captured a local microphone
    //   isMuted   : our mic track is disabled (not transmitting)
    //   isOn      : derived — connected && hasMic && !isMuted (talking)
    //   isListening: derived — connected && !isOn (hearing only)
    //
    // The big reliability win: we capture the mic ON ENTRY and keep its
    // track present but DISABLED until the user taps to talk. That means
    // every RTCPeerConnection is symmetric sendrecv from the first offer
    // — we NEVER renegotiate, which is what used to break the audio.
    connected: false,
    hasMic: false,
    isOn: false,
    isListening: false,
    isMuted: true,
    localStream: null,
    peers: new Map(),       // remoteUserId -> RTCPeerConnection
    audioEls: new Map(),    // remoteUserId -> HTMLAudioElement
    mutedPeers: new Set(),  // remote users we silenced locally
    _pendingIce: new Map(), // remoteUserId -> [candidates] buffered pre-SRD
    _level: { ctx:null, analyser:null, raf:null, lastSpeaking:false },
    _stunServers: [
      // STUN — discovers each peer's public IP for direct P2P. Works for
      // most home networks (non-symmetric NAT).
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      // TURN — relays the audio when direct P2P fails (symmetric NAT on
      // some mobile carriers / strict firewalls). Multiple transports:
      // UDP (fastest), TCP, and TLS-on-443 (punches through firewalls
      // that only allow HTTPS). Open Relay Project — free, no signup.
      { urls: 'turn:openrelay.metered.ca:80',                 username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',                username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turns:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
      // Second free relay for redundancy if openrelay is rate-limited.
      { urls: 'turn:relay.metered.ca:80',                     username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:relay.metered.ca:443',                    username: 'openrelayproject', credential: 'openrelayproject' },
    ],

    // Recompute the derived flags + refresh the button after any state
    // change. isOn = actively transmitting; isListening = connected but
    // silent (muted or mic-less).
    _syncState(){
      this.isOn = this.connected && this.hasMic && !this.isMuted;
      this.isListening = this.connected && !this.isOn;
      this._updateBtn();
    },

    // ── CONNECT — called automatically on every game entry ──
    // Joins the room's voice channel in LISTEN-ONLY mode: no mic prompt,
    // no "mic in use" OS indicator, but we hear everyone immediately
    // (each peer connection uses a recvonly audio transceiver). The mic
    // is only acquired when the player taps the mic button to talk.
    connect(){
      if (this.connected) return;
      if (!S.roomId) return;
      // Pull the deploy's ICE config once (adds the TURN relay when the server
      // has TURN_URL/TURN_USER/TURN_PASS set — fixes voice across mobile-
      // carrier NAT). Falls back silently to the hardcoded STUN list.
      if (!this._iceFetched && typeof apiFetch === 'function'){
        this._iceFetched = true;
        apiFetch('/api/voice/ice', { timeout: 4000 }).then(d => {
          if (Array.isArray(d?.iceServers) && d.iceServers.length) this._stunServers = d.iceServers;
        }).catch(() => {});
      }
      this.connected = true;
      this.hasMic = false;
      this.localStream = null;
      this.isMuted = true;
      this._syncState();
      // Tell the server we're in voice — it replies with the existing
      // participants so we can offer to them (recvonly → we hear them).
      S.socket?.emit('voice:join');
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    // Back-compat alias — game-entry hooks call listen().
    listen(){ this.connect(); },
    // Back-compat alias — older code called join() to "start talking".
    async join(){ await this.connect(); if (this.hasMic) this._setMuted(false); },

    // ── TOGGLE MIC — the button handler ──
    // First tap (no mic yet): request the mic (one-time browser prompt),
    // then symmetrically rebuild the peer connections so our outbound
    // audio is negotiated cleanly. Subsequent taps: just flip the track
    // enabled flag — instant, no renegotiation.
    async toggle(){
      if (!S.roomId) return toast('Join a game first','i');
      // Spectators are LISTEN-ONLY. They hear the table, can mute a noisy
      // player on their own end, and can vote — but must NEVER transmit
      // voice / disturb the players. Block the mic entirely for them.
      if (S.isSpectator) return toast('👀 Spectators can’t talk — you can listen, mute players & vote', 'i');
      if (!this.connected) this.connect();
      if (this.hasMic){
        this._setMuted(!this.isMuted);
        return;
      }
      // First time talking — acquire the mic.
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true },
          video: false,
        });
        this.localStream.getAudioTracks().forEach((t) => { t.enabled = true; });
        this.hasMic = true;
        this.isMuted = false;
        this._startLevelMonitor();
        // Rebuild every peer connection symmetrically so our new outbound
        // track is negotiated in (clean reset > patching a live PC).
        this._rebuildPeers();
        // Always a warm, positive confirmation. We NEVER reveal whether the
        // other seats are bots — every player should feel they're talking to
        // real people at the table.
        toast('🎤 Mic on — the table can hear you', 's');
        this._syncState();
        if (S.g?.players?.length) renderOpps(S.g.players);
      } catch(e){
        toast(e?.name === 'NotAllowedError'
          ? '🎤 Microphone permission denied — enable it in your browser’s site settings'
          : 'Could not access mic', 'e');
      }
    },

    // Flip our mic between muted + live. Track stays attached the whole
    // time, so peers never renegotiate — they just hear silence vs voice.
    _setMuted(muted){
      this.isMuted = !!muted;
      if (this.localStream){
        this.localStream.getAudioTracks().forEach((t) => { t.enabled = !this.isMuted; });
      }
      if (this.isMuted) S.socket?.emit('voice:speaking', { speaking:false });
      this._syncState();
      toast(this.isMuted ? '🔇 Mic muted — still hearing others' : '🎤 Mic live','i');
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    // Tear down + re-establish all peer connections SYMMETRICALLY. Used
    // after we acquire a mic mid-session so every peer gets a fresh
    // offer that includes our outbound audio.
    //   1. voice:leave → the server tells every peer to drop us, so
    //      their side is torn down too (no half-open connections).
    //   2. drop our own peers.
    //   3. after a short beat (so the leave propagates), voice:join →
    //      the server hands us the participant list and we re-offer to
    //      each one, this time as sendrecv (mic attached).
    _rebuildPeers(){
      S.socket?.emit('voice:leave');
      const ids = [...this.peers.keys()];
      ids.forEach((id) => this._dropPeer(id));
      this._pendingIce.clear();
      setTimeout(() => {
        if (this.connected) S.socket?.emit('voice:join');
      }, 200);
    },

    // Full disconnect — called when the player LEAVES the game.
    disconnect(){ this.leave(); },

    // Full disconnect — called when the player LEAVES the game (exit
    // game-screen, leave Ronda root, exit Dama). Tears everything down,
    // including the listening session.
    leave(){
      this.connected = false;
      this.hasMic = false;
      this.isOn = false;
      this.isListening = false;
      this.isMuted = true;
      this._stopLevelMonitor();
      // Tell peers we left so they tear down on their side too
      S.socket?.emit('voice:leave');
      // Close all peer connections
      this.peers.forEach((pc) => { try{ pc.close(); }catch(e){} });
      this.peers.clear();
      this._pendingIce.clear();
      // Remove remote audio elements
      this.audioEls.forEach((a) => { try{ a.srcObject = null; a.remove(); }catch(e){} });
      this.audioEls.clear();
      this.mutedPeers.clear();
      // Stop local mic
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }
      // Clear any speaking indicators on opponents
      document.querySelectorAll('.opp-avatar.speaking, .r-seat-av.speaking, .d-pl-av.speaking').forEach(el => el.classList.remove('speaking'));
      this._updateBtn();
      // Refresh panels so mute buttons disappear
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    // Legacy alias — some call sites used toggleMute() to mute the local
    // mic. Now routes through _setMuted so the new state model stays in
    // sync.
    toggleMute(){
      if (!this.hasMic) return;
      this._setMuted(!this.isMuted);
    },

    // Per-peer local mute — silences a specific player on YOUR end only.
    // The other player keeps their mic open and doesn't know you muted
    // them; the rest of the room still hears them normally.
    toggleMutePeer(peerId){
      if (this.mutedPeers.has(peerId)) {
        this.mutedPeers.delete(peerId);
        const a = this.audioEls.get(peerId); if (a) a.muted = false;
        toast('🔊 Unmuted player','i');
      } else {
        this.mutedPeers.add(peerId);
        const a = this.audioEls.get(peerId); if (a) a.muted = true;
        toast('🔇 Muted player on your end','i');
      }
      // Re-render opponent panels so the button reflects the new state
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    _updateBtn(){
      // Floating corner button (#micBtn) keeps its existing CSS-driven
      // look — we only flip its state classes.
      const floating = document.getElementById('micBtn');
      if (floating){
        floating.classList.toggle('on', this.isOn);
        floating.classList.toggle('muted', this.connected && this.hasMic && this.isMuted);
        floating.classList.toggle('listening', this.isListening);
        floating.title = this.isOn ? 'Turn off mic'
          : (this.connected ? 'Tap to talk' : 'Voice chat');
      }
      // Labeled hand-side buttons (one per game). Icon + label reflect
      // the live state so the player always knows if they're heard.
      const icon  = this.isOn ? '🎙️' : (this.connected ? '🔇' : '🎤');
      const label = this.isOn ? 'LIVE' : (this.connected ? 'TAP TO TALK' : 'MIC OFF');
      document.querySelectorAll('.hand-mic').forEach(btn => {
        btn.classList.toggle('on', this.isOn);
        btn.classList.toggle('listening', this.isListening);
        const ic  = btn.querySelector('.hand-mic-ic');
        const lbl = btn.querySelector('.hand-mic-lbl');
        if (ic)  ic.textContent  = icon;
        if (lbl) lbl.textContent = label;
        btn.title = this.isOn ? 'You are LIVE — tap to mute'
          : (this.connected ? 'Tap to talk' : 'Tap to enable your mic');
      });
      // Circular corner mic buttons (Dama action bar + Ronda corner).
      ['dMicBtn','rCornerMic'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('on', this.isOn);
        el.classList.toggle('listening', this.isListening);
        el.textContent = icon;
      });
    },

    _peerConfig(){ return { iceServers: this._stunServers }; },

    // Browser autoplay policies (Safari/iOS especially) block remote WebRTC
    // audio from playing until the user interacts with the page. We listen
    // ONCE for the next gesture and (re)play every audio element that's still
    // paused — this is the fix for "I'm connected but can't hear anyone".
    _armAudioUnlock(){
      if (this._audioUnlockArmed) return;
      this._audioUnlockArmed = true;
      const unlock = () => {
        let stillBlocked = false;
        this.audioEls.forEach((a) => {
          if (a && a.paused) { a.play().catch(() => { stillBlocked = true; }); }
        });
        // Once everything is playing, drop the listeners. If something is
        // still blocked, keep them so the next tap tries again.
        if (!stillBlocked) {
          ['pointerdown','touchend','click','keydown'].forEach(ev => document.removeEventListener(ev, unlock));
          this._audioUnlockArmed = false;
        }
      };
      ['pointerdown','touchend','click','keydown'].forEach(ev =>
        document.addEventListener(ev, unlock, { passive: true }));
    },

    _ensurePeer(remoteId, isInitiator){
      if (this.peers.has(remoteId)) return this.peers.get(remoteId);
      const pc = new RTCPeerConnection(this._peerConfig());

      // ── Audio direction ──
      // If we have a mic, attach our (possibly-muted) track → sendrecv.
      // If we DON'T (permission denied / listen-only), add an explicit
      // recvonly transceiver. This is the critical fix: modern browsers
      // ignore the legacy createOffer({offerToReceiveAudio:true}) hint,
      // so without a transceiver a mic-less offer has NO audio m-line and
      // we'd never receive the remote's voice. The recvonly transceiver
      // guarantees an audio m-section.
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => pc.addTrack(t, this.localStream));
      } else {
        try { pc.addTransceiver('audio', { direction: 'recvonly' }); } catch(_){}
      }

      // Receive remote audio
      pc.ontrack = (ev) => {
        let audio = this.audioEls.get(remoteId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.controls = false;
          document.getElementById('voiceAudios')?.appendChild(audio);
          this.audioEls.set(remoteId, audio);
        }
        const stream = ev.streams[0] || new MediaStream([ev.track]);
        audio.srcObject = stream;
        // Honor any prior local mute decision for this peer
        audio.muted = this.mutedPeers.has(remoteId);
        // Some browsers (esp. Safari / iOS) refuse to autoplay WebRTC audio
        // until a user gesture. If play() is blocked, arm a one-shot unlock
        // that replays every pending stream on the next tap/click — otherwise
        // you'd never hear the other player even though the call is connected.
        audio.play().catch((e) => { console.warn('[Voice] audio play() blocked — will retry on next tap:', e?.name); this._armAudioUnlock(); });
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          S.socket?.emit('voice:signal', { to: remoteId, kind: 'ice', payload: ev.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (['failed','disconnected','closed'].includes(pc.connectionState)) {
          this._dropPeer(remoteId);
        }
      };

      this.peers.set(remoteId, pc);

      if (isInitiator) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            S.socket?.emit('voice:signal', { to: remoteId, kind: 'offer', payload: pc.localDescription });
          } catch(e){ console.warn('[Voice] offer failed', e); }
        })();
      }
      return pc;
    },

    // Drain any ICE candidates we buffered before the remote description
    // was set (otherwise addIceCandidate throws "remote description is
    // null"). Called right after we setRemoteDescription.
    async _drainIce(remoteId, pc){
      const buf = this._pendingIce.get(remoteId);
      if (!buf?.length) return;
      this._pendingIce.delete(remoteId);
      for (const cand of buf){
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch(e){}
      }
    },

    async _handleSignal({ from, kind, payload }){
      // Process signals whenever we're connected to voice (talking OR
      // listening) so peers can reach us immediately on game entry.
      if (!this.connected) return;
      let pc = this.peers.get(from);
      if (!pc && kind === 'offer') pc = this._ensurePeer(from, false);
      if (!pc) return;
      try {
        if (kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await this._drainIce(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          S.socket?.emit('voice:signal', { to: from, kind: 'answer', payload: pc.localDescription });
        } else if (kind === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await this._drainIce(from, pc);
        } else if (kind === 'ice') {
          if (!payload) return;
          // Buffer candidates that arrive before the remote description
          // is in place — applying them early throws + the connection
          // silently fails to establish.
          if (!pc.remoteDescription || !pc.remoteDescription.type){
            const buf = this._pendingIce.get(from) || [];
            buf.push(payload);
            this._pendingIce.set(from, buf);
          } else {
            await pc.addIceCandidate(new RTCIceCandidate(payload));
          }
        }
      } catch(e){ console.warn('[Voice] signal handling failed', e); }
    },

    _dropPeer(remoteId){
      const pc = this.peers.get(remoteId);
      if (pc) { try{ pc.close(); }catch(e){} this.peers.delete(remoteId); }
      const a = this.audioEls.get(remoteId);
      if (a) { try{ a.srcObject = null; a.remove(); }catch(e){} this.audioEls.delete(remoteId); }
      this._setRemoteSpeaking(remoteId, false);
    },

    _setRemoteSpeaking(remoteId, speaking){
      // The speaking ring lands on whichever avatar element exists for
      // this player in the current game layout:
      //   UNO   → .opanel[data-pid] .opp-sq-av (new square panel)
      //   Ronda → #ronda-root .r-seat[data-pid] .r-seat-av
      //   Dama  → .d-pl[data-pid] .d-pl-av
      const sels = [
        `.opanel[data-pid="${remoteId}"] .opp-sq-av`,
        `.opanel[data-pid="${remoteId}"] .opp-avatar`,
        `.r-seat[data-pid="${remoteId}"] .r-seat-av`,
        `.d-pl[data-pid="${remoteId}"] .d-pl-av`,
      ];
      sels.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.classList.toggle('speaking', !!speaking);
      });
    },

    // Local mic level monitor — emits voice:speaking when above/below threshold
    _startLevelMonitor(){
      if (!this.localStream) return;
      if (this._level.raf) return;            // already running — idempotent
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(this.localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        this._level.ctx = ctx;
        this._level.analyser = analyser;
        const tick = () => {
          // Keep monitoring while we hold a mic, even when muted, so the
          // moment the user unmutes the speaking indicator fires without
          // needing to restart the loop.
          if (!this.connected || !this.hasMic) { this._level.raf = null; return; }
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const speaking = !this.isMuted && rms > 0.06;
          if (speaking !== this._level.lastSpeaking) {
            this._level.lastSpeaking = speaking;
            S.socket?.emit('voice:speaking', { speaking });
          }
          this._level.raf = requestAnimationFrame(tick);
        };
        tick();
      } catch(e){ console.warn('[Voice] level monitor failed', e); }
    },
    _stopLevelMonitor(){
      if (this._level.raf) cancelAnimationFrame(this._level.raf);
      try{ this._level.ctx?.close(); }catch(e){}
      this._level = { ctx:null, analyser:null, raf:null, lastSpeaking:false };
    },
  };
  const SFX={
    ctx:null,
    // Global mute — every game sound effect is silenced. The .play()
    // body still exists as a no-op so legacy SFX.play(...) call sites
    // throughout the app stay valid; we just bail at the top.
    init(){if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();},
    play(type){
      return;                                              // sounds disabled globally
      try{
        if(typeof soundOn!=='undefined'&&!soundOn)return;
        this.init();
        const c=this.ctx,o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);
        const now=c.currentTime;
        switch(type){
          case'play':o.frequency.setValueAtTime(523,now);o.frequency.setValueAtTime(659,now+.08);g.gain.setValueAtTime(.12,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.start(now);o.stop(now+.2);break;
          case'draw':o.frequency.setValueAtTime(330,now);g.gain.setValueAtTime(.08,now);g.gain.exponentialRampToValueAtTime(.001,now+.15);o.start(now);o.stop(now+.15);break;
          case'uno':o.frequency.setValueAtTime(440,now);o.frequency.setValueAtTime(554,now+.1);o.frequency.setValueAtTime(659,now+.2);g.gain.setValueAtTime(.15,now);g.gain.exponentialRampToValueAtTime(.001,now+.4);o.start(now);o.stop(now+.4);break;
          case'win':o.frequency.setValueAtTime(523,now);o.frequency.setValueAtTime(659,now+.15);o.frequency.setValueAtTime(784,now+.3);g.gain.setValueAtTime(.15,now);g.gain.exponentialRampToValueAtTime(.001,now+.6);o.start(now);o.stop(now+.6);break;
          case'turn':o.frequency.setValueAtTime(880,now);g.gain.setValueAtTime(.06,now);g.gain.exponentialRampToValueAtTime(.001,now+.1);o.start(now);o.stop(now+.1);break;
          case'error':o.frequency.setValueAtTime(200,now);g.gain.setValueAtTime(.1,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.start(now);o.stop(now+.2);break;
          case'hover':o.type='sine';o.frequency.setValueAtTime(1320,now);g.gain.setValueAtTime(.02,now);g.gain.exponentialRampToValueAtTime(.0008,now+.06);o.start(now);o.stop(now+.06);break;
          case'click':o.type='triangle';o.frequency.setValueAtTime(620,now);o.frequency.exponentialRampToValueAtTime(960,now+.05);g.gain.setValueAtTime(.07,now);g.gain.exponentialRampToValueAtTime(.001,now+.12);o.start(now);o.stop(now+.12);break;
          case'open':o.type='sine';o.frequency.setValueAtTime(420,now);o.frequency.exponentialRampToValueAtTime(720,now+.12);g.gain.setValueAtTime(.06,now);g.gain.exponentialRampToValueAtTime(.001,now+.18);o.start(now);o.stop(now+.18);break;
        }
      }catch(e){}
    }
  };
  // Expose audio modules on window so inline HTML handlers
  // (onclick="VoiceChat.toggle()" etc.) can resolve them even when
  // script-scoped `const` declarations aren't reachable from the
  // global event-handler scope (Safari + some PWA WebViews).
  window.VoiceChat = VoiceChat;
  window.Voice     = Voice;
  window.SFX       = SFX;
