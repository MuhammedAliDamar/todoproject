/**
 * iPhone-benzeri bildirim sesi (Web Audio ile üretilir, ses dosyası gerekmez).
 * Hem operatör paneli hem widget kullanır. Tarayıcı otomatik-oynatma politikası
 * gereği ilk kullanıcı etkileşiminde `unlockAudio()` çağrılmalı.
 */

let _ctx: AudioContext | null = null;
let _last = 0;

export function unlockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    _ctx = _ctx || new AC();
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

export function playPing(): void {
  const ctx = unlockAudio();
  if (!ctx) return;
  const now = Date.now();
  if (now - _last < 700) return; // çok sık çalmasın
  _last = now;
  const t0 = ctx.currentTime;
  // İki kısa marimba notası (D6 → G6) — iPhone bildirimine yakın, hoş bir tri-tone
  const notes = [
    { f: 1174.66, t: 0.0 },
    { f: 1567.98, t: 0.13 },
  ];
  for (const { f, t } of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = t0 + t;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.32, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}
