let audioContext: AudioContext | null = null;

export function unlockNotificationAudio() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume().catch(() => undefined);
  } catch {
    // Audio is optional when the browser does not support Web Audio.
  }
}

export function playNotificationSound() {
  try {
    audioContext ??= new AudioContext();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.26);
  } catch {
    // Audio is optional and must not interrupt inbox updates.
  }
}
