import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket';

// useVoiceChat — WebRTC mesh voice for the in-room player set.
//
// Protocol (matches server/index.js voice:* handlers):
//   • Client emits voice:join → server replies with voice:peers
//     {peers: existing userIds}; the NEW joiner sends an offer to each
//   • Server broadcasts voice:peer_joined {peerId} to existing peers;
//     they create a half-open RTCPeerConnection and wait for the offer
//   • Both sides exchange offer / answer / ice via voice:signal
//     { to, kind: 'offer'|'answer'|'ice', payload }
//   • Speaking indicator (voice:speaking) is wired in but the auto-emit
//     based on local audio level is a follow-up — for now the hook just
//     surfaces remote speaking events to the UI.
//
// Return value:
//   inVoice      : whether the local user has joined voice
//   muted        : local microphone mute state
//   peers        : Map<userId, MediaStream> — remote streams to play back
//   speakingPeers: Set<userId> — peers currently broadcasting voice
//   join() / leave() / toggleMute()
//
// Failure cases handled:
//   • getUserMedia denial → toast via parent, hook stays in idle state
//   • Peer connection state failure → close + remove that peer
//   • Cleanup on unmount: leave + stop all tracks

const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function useVoiceChat() {
  const [inVoice, setInVoice]               = useState(false);
  const [muted, setMuted]                   = useState(false);
  const [peers, setPeers]                   = useState(new Map());      // userId → MediaStream
  const [speakingPeers, setSpeakingPeers]   = useState(new Set());

  const localStreamRef = useRef(null);
  const pcsRef         = useRef(new Map());      // userId → RTCPeerConnection

  // ── helpers ──
  const closePc = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch { /* ignore */ }
      pcsRef.current.delete(peerId);
    }
    setPeers((cur) => {
      if (!cur.has(peerId)) return cur;
      const next = new Map(cur);
      next.delete(peerId);
      return next;
    });
    setSpeakingPeers((cur) => {
      if (!cur.has(peerId)) return cur;
      const next = new Set(cur);
      next.delete(peerId);
      return next;
    });
  }, []);

  const createPc = useCallback((peerId, sk) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcsRef.current.set(peerId, pc);

    // Attach the local audio track so the remote side can hear us.
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sk.emit('voice:signal', { to: peerId, kind: 'ice', payload: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      setPeers((cur) => new Map(cur).set(peerId, stream));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePc(peerId);
      }
    };
    return pc;
  }, [closePc]);

  // ── public actions ──
  const join = useCallback(async () => {
    if (inVoice) return;
    const sk = getSocket();
    if (!sk) throw new Error('Not connected');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      throw new Error('Microphone access denied');
    }
    localStreamRef.current = stream;
    setMuted(false);
    sk.emit('voice:join');
    setInVoice(true);
  }, [inVoice]);

  const leave = useCallback(() => {
    const sk = getSocket();
    if (sk && inVoice) sk.emit('voice:leave');
    // Close all peer connections + stop the local mic.
    for (const peerId of [...pcsRef.current.keys()]) closePc(peerId);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setPeers(new Map());
    setSpeakingPeers(new Set());
    setInVoice(false);
  }, [inVoice, closePc]);

  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const next = !muted;
    s.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  // ── socket plumbing ──
  useEffect(() => {
    if (!inVoice) return;
    const sk = getSocket();
    if (!sk) return;

    // Existing peers respond to our join: we open offers to each.
    const onPeers = async ({ peers: existing = [] }) => {
      for (const peerId of existing) {
        const pc = createPc(peerId, sk);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sk.emit('voice:signal', { to: peerId, kind: 'offer', payload: offer });
        } catch { closePc(peerId); }
      }
    };

    // A peer joins after us: we just wait for their offer (createPc
    // happens lazily on the first voice:signal from them).
    const onPeerJoined = (_d) => { /* no-op until they send the offer */ };
    const onPeerLeft   = ({ peerId }) => closePc(peerId);

    const onSignal = async ({ from, kind, payload }) => {
      if (!from || !payload) return;
      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPc(from, sk);

      try {
        if (kind === 'offer') {
          await pc.setRemoteDescription(payload);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          sk.emit('voice:signal', { to: from, kind: 'answer', payload: ans });
        } else if (kind === 'answer') {
          await pc.setRemoteDescription(payload);
        } else if (kind === 'ice') {
          await pc.addIceCandidate(payload);
        }
      } catch { closePc(from); }
    };

    const onSpeaking = ({ peerId, speaking }) => {
      setSpeakingPeers((cur) => {
        const next = new Set(cur);
        if (speaking) next.add(peerId); else next.delete(peerId);
        return next;
      });
    };

    sk.on('voice:peers',       onPeers);
    sk.on('voice:peer_joined', onPeerJoined);
    sk.on('voice:peer_left',   onPeerLeft);
    sk.on('voice:signal',      onSignal);
    sk.on('voice:speaking',    onSpeaking);

    return () => {
      sk.off('voice:peers',       onPeers);
      sk.off('voice:peer_joined', onPeerJoined);
      sk.off('voice:peer_left',   onPeerLeft);
      sk.off('voice:signal',      onSignal);
      sk.off('voice:speaking',    onSpeaking);
    };
  }, [inVoice, createPc, closePc]);

  // Hard cleanup on unmount (e.g. user navigates away from /room).
  useEffect(() => {
    return () => { leave(); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return { inVoice, muted, peers, speakingPeers, join, leave, toggleMute };
}
