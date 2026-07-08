let ctx: AudioContext | null = null;
let playing = false;
let timer: ReturnType<typeof setTimeout> | undefined;

const BEAT = 0.32;
const BASS = [130.81, 98.0, 110.0, 87.31];
const MELODY = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 659.25, 392.0];

function schedule() {
  if (!playing || !ctx) return;
  const t0 = ctx.currentTime + 0.06;

  BASS.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const t = t0 + i * BEAT * 2;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.003, t + BEAT * 1.9);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + BEAT * 2);
  });

  MELODY.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'square';
    o.frequency.value = f;
    const t = t0 + i * BEAT;
    g.gain.setValueAtTime(0.018, t);
    g.gain.exponentialRampToValueAtTime(0.002, t + BEAT * 0.85);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + BEAT);
  });

  timer = setTimeout(schedule, BEAT * 8 * 1000 - 80);
}

export function startBgm(): void {
  if (playing) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    playing = true;
    schedule();
  } catch {
    playing = false;
  }
}

export function stopBgm(): void {
  playing = false;
  clearTimeout(timer);
}
