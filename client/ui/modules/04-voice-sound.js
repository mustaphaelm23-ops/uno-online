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
      try{
        if(typeof soundOn !== 'undefined' && !soundOn) return;
        if(!this.enabled) return;
        if(!this._ready) this._init();
        if(!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US'; u.rate = .95; u.pitch = 1; u.volume = .9;
        if(this.voice) u.voice = this.voice;
        window.speechSynthesis.speak(u);
      }catch(e){}
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
    isOn: false,
    isMuted: false,
    localStream: null,
    peers: new Map(),       // remoteUserId -> RTCPeerConnection
    audioEls: new Map(),    // remoteUserId -> HTMLAudioElement
    mutedPeers: new Set(),  // remote users we silenced locally
    _level: { ctx:null, analyser:null, raf:null, lastSpeaking:false },
    _stunServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free public TURN relays (Open Relay Project) — needed when both
      // peers are behind symmetric NAT (mobile carriers, some ISPs)
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],

    async toggle(){
      if (!S.roomId) return toast('Join a game first','i');
      if (this.isOn) return this.leave();
      try {
        await this.join();
      } catch(e){
        console.warn('[Voice] join failed', e);
        toast(e.name === 'NotAllowedError' ? '🎤 Microphone permission denied' : 'Voice chat failed','e');
      }
    },

    async join(){
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true },
        video: false,
      });
      this.isOn = true;
      this.isMuted = false;
      this._updateBtn();
      this._startLevelMonitor();
      // Tell others we joined — they will reach back with offers
      S.socket?.emit('voice:join');
      toast('🎤 Voice chat ON','s');
      // Refresh panels so the per-peer mute buttons can appear (3+ players only)
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    leave(){
      this.isOn = false;
      this._stopLevelMonitor();
      // Tell peers we left so they tear down on their side too
      S.socket?.emit('voice:leave');
      // Close all peer connections
      this.peers.forEach((pc) => { try{ pc.close(); }catch(e){} });
      this.peers.clear();
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
      document.querySelectorAll('.opp-avatar.speaking').forEach(el => el.classList.remove('speaking'));
      this._updateBtn();
      // Refresh panels so mute buttons disappear
      if (S.g?.players?.length) renderOpps(S.g.players);
    },

    toggleMute(){
      if (!this.isOn || !this.localStream) return;
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = !this.isMuted; });
      if (this.isMuted) S.socket?.emit('voice:speaking', { speaking:false });
      this._updateBtn();
      toast(this.isMuted ? '🔇 Mic muted' : '🎤 Mic on','i');
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
      const btn = document.getElementById('micBtn');
      if (!btn) return;
      btn.classList.toggle('on', this.isOn && !this.isMuted);
      btn.classList.toggle('muted', this.isOn && this.isMuted);
      btn.title = this.isOn ? (this.isMuted ? 'Unmute (long press to leave)' : 'Mute (long press to leave)') : 'Voice chat';
    },

    _peerConfig(){ return { iceServers: this._stunServers }; },

    _ensurePeer(remoteId, isInitiator){
      if (this.peers.has(remoteId)) return this.peers.get(remoteId);
      const pc = new RTCPeerConnection(this._peerConfig());

      // Send our local audio track(s)
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
      }

      // Receive remote audio
      pc.ontrack = (ev) => {
        console.log('[Voice] ontrack from', remoteId, 'kind:', ev.track.kind);
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
        // Some browsers/Safari refuse autoplay until we explicitly call play()
        audio.play().catch((e) => console.warn('[Voice] audio play() blocked:', e?.name));
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          S.socket?.emit('voice:signal', { to: remoteId, kind: 'ice', payload: ev.candidate });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[Voice]', remoteId, 'ice state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('[Voice]', remoteId, 'conn state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          toast('🎧 Voice connected','s');
        }
        if (['failed','disconnected','closed'].includes(pc.connectionState)) {
          this._dropPeer(remoteId);
        }
      };

      this.peers.set(remoteId, pc);

      if (isInitiator) {
        (async () => {
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            S.socket?.emit('voice:signal', { to: remoteId, kind: 'offer', payload: pc.localDescription });
          } catch(e){ console.warn('[Voice] offer failed', e); }
        })();
      }
      return pc;
    },

    async _handleSignal({ from, kind, payload }){
      if (!this.isOn) return; // Ignore if we're not in voice chat
      let pc = this.peers.get(from);
      if (!pc && kind === 'offer') pc = this._ensurePeer(from, false);
      if (!pc) return;
      try {
        if (kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          S.socket?.emit('voice:signal', { to: from, kind: 'answer', payload: pc.localDescription });
        } else if (kind === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (kind === 'ice') {
          if (payload) await pc.addIceCandidate(new RTCIceCandidate(payload));
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
      const panel = document.querySelector(`.opanel[data-pid="${remoteId}"] .opp-avatar`);
      if (!panel) return;
      panel.classList.toggle('speaking', !!speaking);
    },

    // Local mic level monitor — emits voice:speaking when above/below threshold
    _startLevelMonitor(){
      if (!this.localStream) return;
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
          if (!this.isOn) return;
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
    init(){if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();},
    play(type){
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
