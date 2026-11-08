export type ScanTone = 'success' | 'warning' | 'error';

export function playScanFeedback(tone: ScanTone): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(tone === 'success' ? 80 : tone === 'warning' ? [120, 80, 120] : [300, 120, 300]);
  }
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  const context = new AudioCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = tone === 'success' ? 880 : tone === 'warning' ? 620 : 220;
  gain.gain.value = 0.2;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + (tone === 'error' ? 0.5 : 0.2));
  oscillator.onended = () => void context.close();
}
