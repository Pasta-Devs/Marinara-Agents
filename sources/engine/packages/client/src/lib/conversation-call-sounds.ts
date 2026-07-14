type CallTone = {
  frequency: number;
  start: number;
  duration: number;
  gain?: number;
};

let lastRingingCallSoundId: string | null = null;

function playShortTone(sequence: CallTone[]) {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  try {
    const audioContext = new AudioContextCtor();
    const master = audioContext.createGain();
    const now = audioContext.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    master.connect(audioContext.destination);

    for (const item of sequence) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + item.start;
      const end = start + item.duration;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(item.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(item.gain ?? 0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }

    const totalMs = (Math.max(...sequence.map((item) => item.start + item.duration), 0.3) + 0.18) * 1000;
    window.setTimeout(() => void audioContext.close(), totalMs);
  } catch {
    /* Browser autoplay policy may reject sounds until the user has interacted with the page. */
  }
}

export function playConversationCallRingingSound() {
  playShortTone([
    { frequency: 560, start: 0, duration: 0.18, gain: 0.16 },
    { frequency: 700, start: 0.22, duration: 0.22, gain: 0.18 },
    { frequency: 560, start: 0.62, duration: 0.18, gain: 0.14 },
    { frequency: 700, start: 0.84, duration: 0.22, gain: 0.16 },
  ]);
}

export function playConversationCallRingingSoundOnce(callId: string | null | undefined) {
  if (!callId) {
    playConversationCallRingingSound();
    return;
  }
  if (lastRingingCallSoundId === callId) return;
  lastRingingCallSoundId = callId;
  playConversationCallRingingSound();
}

export function playConversationCallStartSound() {
  playShortTone([
    { frequency: 420, start: 0, duration: 0.16 },
    { frequency: 540, start: 0.2, duration: 0.18 },
  ]);
}

export function playConversationCallJoinSound() {
  playShortTone([{ frequency: 760, start: 0, duration: 0.18, gain: 0.14 }]);
}

export function playConversationCallLeaveSound() {
  playShortTone([{ frequency: 420, start: 0, duration: 0.2, gain: 0.13 }]);
}

export function playConversationCallEndSound() {
  playShortTone([
    { frequency: 540, start: 0, duration: 0.15, gain: 0.16 },
    { frequency: 360, start: 0.18, duration: 0.2, gain: 0.15 },
  ]);
}
