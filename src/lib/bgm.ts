/**
 * 잔잔한 교실용 앰비언트 BGM — 외부 음원 없이 WebAudio로 생성.
 * 8개 코드 × 8초 = 64초 화성 사이클, 멜로디는 매번 랜덤이라 반복감이 없다.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let playing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let chordIdx = 0;

const CHORD_SEC = 8;

const CHORDS: number[][] = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
  [261.63, 329.63, 392.0], // C
  [146.83, 220.0, 293.66], // Dm
  [174.61, 261.63, 349.23], // F
  [196.0, 293.66, 392.0], // G
];

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0];

function playChord(t0: number, freqs: number[]) {
  if (!ctx || !master) return;

  // 패드: 낮은 옥타브, 2초 어택 / 2초 릴리즈로 부드럽게 이어짐
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f / 2;
    const peak = 0.034 - i * 0.007;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 2.4);
    g.gain.setValueAtTime(peak, t0 + CHORD_SEC - 1.8);
    g.gain.linearRampToValueAtTime(0.0001, t0 + CHORD_SEC + 0.8);
    o.connect(g).connect(master!);
    o.start(t0);
    o.stop(t0 + CHORD_SEC + 1);
  });

  // 베이스: 근음 한 옥타브 아래, 아주 작게
  const bass = ctx.createOscillator();
  const bg = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.value = freqs[0] / 4;
  bg.gain.setValueAtTime(0.0001, t0);
  bg.gain.linearRampToValueAtTime(0.045, t0 + 1.6);
  bg.gain.setValueAtTime(0.045, t0 + CHORD_SEC - 1.6);
  bg.gain.linearRampToValueAtTime(0.0001, t0 + CHORD_SEC + 0.6);
  bass.connect(bg).connect(master);
  bass.start(t0);
  bass.stop(t0 + CHORD_SEC + 0.8);

  // 멜로디: 코드당 1~3음, 타이밍·음높이 랜덤 (반복감 제거)
  const notes = 1 + Math.floor(Math.random() * 3);
  for (let n = 0; n < notes; n++) {
    const t = t0 + 1.2 + Math.random() * (CHORD_SEC - 3.5);
    const f = PENTA[Math.floor(Math.random() * PENTA.length)];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.012, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 2.6);
  }
}

function schedule() {
  if (!playing || !ctx) return;
  const t0 = ctx.currentTime + 0.1;
  playChord(t0, CHORDS[chordIdx % CHORDS.length]);
  chordIdx += 1;
  timer = setTimeout(schedule, CHORD_SEC * 1000 - 250);
}

export function startBgm(): void {
  if (playing) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    playing = true;
    schedule();
  } catch {
    playing = false;
  }
}

export function stopBgm(): void {
  playing = false;
  clearTimeout(timer);
  if (master && ctx) {
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    const old = master;
    master = null;
    setTimeout(() => old.disconnect(), 800);
  }
}
