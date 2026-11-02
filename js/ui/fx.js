const SOUND_KEY = "mpv-sound";

export function soundOn() {
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function toggleSound() {
  localStorage.setItem(SOUND_KEY, soundOn() ? "off" : "on");
  return soundOn();
}

export function playTone(ok) {
  if (!soundOn()) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = playTone.ctx || (playTone.ctx = new AudioCtx());
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = ok ? 660 : 220;
  osc.type = "sine";
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  osc.stop(ctx.currentTime + 0.2);
}

export function appear(nodes) {
  const list = [...nodes];
  if (!list.length || !window.gsap) return;
  window.gsap.from(list, {
    y: 18,
    opacity: 0,
    duration: 0.4,
    stagger: 0.06,
    ease: "power2.out",
    clearProps: "opacity,transform",
  });
}

export function reactBin(bin, ok) {
  bin.classList.remove("pop", "shake");
  void bin.offsetWidth;
  bin.classList.add(ok ? "pop" : "shake");
  if (!window.gsap) return;
  window.gsap.fromTo(bin, { scale: ok ? 0.96 : 1 }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
}

export function unlockBadges(row) {
  if (!window.gsap) return;
  window.gsap.from(row.querySelectorAll(".badge:not(.off)"), {
    scale: 0.6,
    opacity: 0,
    duration: 0.45,
    stagger: 0.08,
    ease: "back.out(1.6)",
  });
}

export function setPlanet(doneCount) {
  document.body.dataset.health = String(Math.min(doneCount, 3));
}
