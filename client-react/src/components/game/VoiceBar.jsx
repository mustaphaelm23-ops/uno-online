import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// VoiceBar — minimal in-game voice controls:
//   • 🎤 Join / Leave voice (handles mic permission flow)
//   • 🔇 Mute toggle (only visible while in voice)
//   • Peer count chip when in voice
//
// Audio playback: one <audio autoPlay /> element per remote peer,
// hidden from view. The browser handles mixing of incoming streams.

function HiddenAudioSinks({ peers }) {
  return (
    <div className="sr-only" aria-hidden>
      {[...peers.entries()].map(([peerId, stream]) => (
        <Sink key={peerId} stream={stream} />
      ))}
    </div>
  );
}

function Sink({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

export default function VoiceBar({ voice, onError }) {
  const { inVoice, muted, peers, join, leave, toggleMute } = voice;

  const handleJoin = async () => {
    try { await join(); }
    catch (err) { onError?.(err.message || 'Mic failed'); }
  };

  return (
    <div className="flex flex-col gap-2 items-end">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={inVoice ? leave : handleJoin}
        title={inVoice ? 'Leave voice' : 'Join voice'}
        aria-label={inVoice ? 'Leave voice' : 'Join voice'}
        className={`w-11 h-11 rounded-full grid place-items-center text-xl border transition shadow-card
          ${inVoice ? 'bg-emerald text-white border-emerald'
                    : 'bg-bg-2/80 text-ink border-line hover:border-violet/60'}`}
      >🎤</motion.button>

      {inVoice && (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute mic' : 'Mute mic'}
            className={`w-11 h-11 rounded-full grid place-items-center text-base border transition
              ${muted ? 'bg-rose text-white border-rose'
                      : 'bg-bg-2/80 text-ink border-line hover:border-violet/60'}`}
          >{muted ? '🔇' : '🎙️'}</motion.button>
          {peers.size > 0 && (
            <span className="chip bg-emerald/20 border border-emerald/40 text-emerald text-[10px]">
              {peers.size} on call
            </span>
          )}
        </>
      )}

      <HiddenAudioSinks peers={peers} />
    </div>
  );
}
