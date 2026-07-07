let ctx: AudioContext | null = null;

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function tickSfx(enabled: boolean): void {
  if (!enabled) return;
  try {
    const c = audio();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = 850 + Math.random() * 250;
    g.gain.setValueAtTime(0.06, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.06);
  } catch {
    /* audio blocked — silent fallback */
  }
}

export function winSfx(enabled: boolean): void {
  if (!enabled) return;
  try {
    const c = audio();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = c.currentTime + i * 0.09;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.32);
    });
  } catch {
    /* audio blocked — silent fallback */
  }
}
