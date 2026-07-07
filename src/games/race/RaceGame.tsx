import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { activeParticipants, shuffle } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';
import { useAppStore } from '../../stores/session';

const RUNNERS = [
  '🤖', '📚', '✏️', '💡', '⭐', '🎒', '🧩', '🎯', '📝', '🔔',
  '🚀', '🌈', '🏆', '🎨', '🖍️', '📐', '🧪', '🔎', '🎲', '📌',
  '🟣', '🟢', '🟡', '🩷', '💜', '✅', '✨', '🌟', '📘', '📗',
];

const COLORS = [
  '#8B5CF6', '#A3E635', '#F9A8D4', '#FACC15', '#38BDF8',
  '#FB7185', '#34D399', '#C084FC', '#F97316', '#60A5FA',
];

const COURSES = {
  short: {
    label: '기본 핀볼맵',
    shortLabel: '기본',
    ms: 7000,
    rows: 6,
    gravity: 1320,
    bounce: 0.72,
    friction: 0.998,
    bgTop: '#FFF9EF',
    bgBottom: '#EFE4FF',
  },
  normal: {
    label: '지그재그 미션맵',
    shortLabel: '지그재그',
    ms: 11000,
    rows: 8,
    gravity: 1180,
    bounce: 0.76,
    friction: 0.996,
    bgTop: '#F4FFD0',
    bgBottom: '#E9F9FF',
  },
  long: {
    label: '혼돈의 롱맵',
    shortLabel: '롱맵',
    ms: 15000,
    rows: 10,
    gravity: 1080,
    bounce: 0.8,
    friction: 0.995,
    bgTop: '#2B145F',
    bgBottom: '#120A2B',
  },
} as const;

type CourseId = keyof typeof COURSES;
type Phase = 'setup' | 'countdown' | 'racing' | 'done';

interface Pin {
  nx: number;
  ny: number;
  r: number;
}

interface RunnerState {
  id: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  finished: boolean;
  finishTime: number;
}

function buildPins(courseId: CourseId): Pin[] {
  const course = COURSES[courseId];
  const pins: Pin[] = [];
  for (let row = 0; row < course.rows; row++) {
    const y = 0.19 + row * (0.58 / Math.max(1, course.rows - 1));
    const count = row % 2 === 0 ? 7 : 6;
    const offset = row % 2 === 0 ? 0 : 0.06;
    for (let col = 0; col < count; col++) {
      const spread = count === 7 ? 0.11 : 0.13;
      pins.push({
        nx: 0.15 + offset + col * spread,
        ny: y,
        r: courseId === 'long' ? 11 : 12,
      });
    }
  }

  if (courseId !== 'short') {
    pins.push(
      { nx: 0.28, ny: 0.36, r: 18 },
      { nx: 0.72, ny: 0.48, r: 18 },
    );
  }
  if (courseId === 'long') {
    pins.push(
      { nx: 0.5, ny: 0.31, r: 20 },
      { nx: 0.4, ny: 0.67, r: 16 },
      { nx: 0.6, ny: 0.72, r: 16 },
    );
  }

  return pins;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function RaceGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.race);
  const updateRace = useAppStore((s) => s.updateRace);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const active = useMemo(
    () => activeParticipants(participants, excludedIds),
    [participants, excludedIds],
  );

  const [phase, setPhase] = useState<Phase>('setup');
  const [countdown, setCountdown] = useState('3');
  const [fastForward, setFastForward] = useState(false);
  const [, setFrame] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runnersRef = useRef<RunnerState[]>([]);
  const finishRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const phaseRef = useRef<Phase>('setup');
  const fastForwardRef = useRef(false);
  fastForwardRef.current = fastForward;

  const courseId = (settings.mapId in COURSES ? settings.mapId : 'normal') as CourseId;
  const course = COURSES[courseId];
  const pins = useMemo(() => buildPins(courseId), [courseId]);
  const winnerCount = Math.min(Math.max(1, settings.winnerCount), active.length);
  const hasWeights = active.some((p) => p.weight > 1);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const drawScene = (preview = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(360, rect.width);
    const height = Math.max(420, rect.height);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, course.bgTop);
    bg.addColorStop(1, course.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = courseId === 'long' ? 0.2 : 0.35;
    ctx.strokeStyle = courseId === 'long' ? '#FFFFFF' : '#7C3AED';
    ctx.lineWidth = 1;
    for (let x = 36; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();

    const startY = 54;
    const finishY = height - 72;
    ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#3B235F';
    ctx.font = '900 18px Pretendard, sans-serif';
    ctx.fillText('START', 22, startY - 18);
    ctx.fillText('FINISH', 22, finishY + 42);

    ctx.strokeStyle = courseId === 'long' ? '#A3E635' : '#7C3AED';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(20, startY);
    ctx.lineTo(width - 20, startY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, finishY);
    ctx.lineTo(width - 20, finishY);
    ctx.stroke();
    ctx.setLineDash([]);

    pins.forEach((pin) => {
      const x = pin.nx * width;
      const y = pin.ny * height;
      const halo = ctx.createRadialGradient(x, y, 2, x, y, pin.r + 12);
      halo.addColorStop(0, 'rgba(255,255,255,0.95)');
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, pin.r + 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = courseId === 'long' ? '#A3E635' : '#FFFFFF';
      ctx.strokeStyle = courseId === 'long' ? '#FFFFFF' : '#8B5CF6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, pin.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    const slotCount = Math.min(8, Math.max(3, Math.ceil(active.length / 4)));
    const slotW = (width - 40) / slotCount;
    for (let i = 0; i < slotCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)';
      ctx.fillRect(20 + slotW * i, finishY + 10, slotW - 4, 42);
    }

    const runners = preview
      ? active.slice(0, 12).map((p, i) => ({
          id: p.id,
          name: p.name,
          icon: RUNNERS[i % RUNNERS.length],
          color: COLORS[i % COLORS.length],
          x: 60 + (i % 6) * 58,
          y: startY + 16 + Math.floor(i / 6) * 48,
          vx: 0,
          vy: 0,
          r: 18,
          spin: 0,
          finished: false,
          finishTime: 0,
        }))
      : runnersRef.current;

    runners.forEach((runner, i) => {
      const isFinished = runner.finished;
      ctx.save();
      ctx.translate(runner.x, runner.y);
      ctx.rotate(runner.spin);
      ctx.shadowColor = 'rgba(47, 25, 84, 0.24)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = isFinished ? '#A3E635' : runner.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, runner.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.font = `${runner.r + 5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(runner.icon, 0, 1);
      ctx.restore();

      if (phaseRef.current !== 'setup' || i < 8) {
        ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#2F1954';
        ctx.font = '800 12px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(runner.name.slice(0, 5), runner.x, runner.y + runner.r + 16);
      }
    });

    if (phaseRef.current === 'setup') {
      ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#2F1954';
      ctx.font = '900 30px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('핀볼 레이스 준비 완료', width / 2, height / 2 - 8);
      ctx.font = '800 16px Pretendard, sans-serif';
      ctx.fillText('출발하면 캐릭터 구슬이 장애물을 통과해 골인합니다', width / 2, height / 2 + 24);
    }
  };

  const resetPreview = () => {
    finishRef.current = [];
    runnersRef.current = [];
    drawScene(true);
  };

  useEffect(() => {
    if (phase === 'setup') {
      resetPreview();
      return;
    }
    drawScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, courseId, phase]);

  const beginRace = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(360, rect.width);
    const startY = 54;
    const shuffled = shuffle(active.map((p, i) => ({ p, i })));

    runnersRef.current = shuffled.map(({ p, i }, order) => {
      const gap = width / (shuffled.length + 1);
      return {
        id: p.id,
        name: p.name,
        icon: RUNNERS[i % RUNNERS.length],
        color: COLORS[i % COLORS.length],
        x: clamp(gap * (order + 1), 34, width - 34),
        y: startY - Math.random() * 28,
        vx: (Math.random() - 0.5) * 90,
        vy: 80 + Math.random() * 90,
        r: 18,
        spin: 0,
        finished: false,
        finishTime: 0,
      };
    });
    finishRef.current = [];
    lastTimeRef.current = 0;

    const step = (now: number) => {
      const canvasNow = canvasRef.current;
      if (!canvasNow) return;
      const rectNow = canvasNow.getBoundingClientRect();
      const widthNow = Math.max(360, rectNow.width);
      const heightNow = Math.max(420, rectNow.height);
      const finishY = heightNow - 72;

      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const rawDt = Math.min(32, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const selectedDone =
        settings.winMode === 'first' && finishRef.current.length >= winnerCount;
      const speedScale = fastForwardRef.current ? 4 : selectedDone ? 2.6 : 1;
      const dt = rawDt * speedScale;

      runnersRef.current.forEach((runner, runnerIndex) => {
        if (runner.finished) return;

        runner.vy += course.gravity * dt;
        runner.vx += (Math.random() - 0.5) * 220 * dt;
        runner.vx *= course.friction;
        runner.vy *= 0.999;
        runner.x += runner.vx * dt;
        runner.y += runner.vy * dt;
        runner.spin += runner.vx * dt * 0.02;

        if (runner.x < runner.r + 10) {
          runner.x = runner.r + 10;
          runner.vx = Math.abs(runner.vx) * course.bounce;
        }
        if (runner.x > widthNow - runner.r - 10) {
          runner.x = widthNow - runner.r - 10;
          runner.vx = -Math.abs(runner.vx) * course.bounce;
        }

        pins.forEach((pin) => {
          const px = pin.nx * widthNow;
          const py = pin.ny * heightNow;
          const dx = runner.x - px;
          const dy = runner.y - py;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = runner.r + pin.r;
          if (dist >= minDist) return;

          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          runner.x += nx * overlap;
          runner.y += ny * overlap;

          const dot = runner.vx * nx + runner.vy * ny;
          if (dot < 0) {
            runner.vx -= (1 + course.bounce) * dot * nx;
            runner.vy -= (1 + course.bounce) * dot * ny;
            runner.vx += (Math.random() - 0.5) * 80;
          }
        });

        if (runner.y >= finishY) {
          runner.y = finishY;
          runner.vx *= 0.2;
          runner.vy = 0;
          runner.finished = true;
          runner.finishTime = now;
          finishRef.current.push(runnerIndex);
          if (finishRef.current.length === 1) winSfx(soundEnabled);
        }
      });

      drawScene();
      setFrame((f) => f + 1);

      if (finishRef.current.length < runnersRef.current.length) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase('done');
        phaseRef.current = 'done';
        drawScene();
        winSfx(soundEnabled);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const start = () => {
    if (phase !== 'setup' || active.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const order = shuffle(active.map((p, i) => ({ p, i })));
      runnersRef.current = order.map(({ p, i }, rank) => ({
          id: p.id,
          name: p.name,
          icon: RUNNERS[i % RUNNERS.length],
          color: COLORS[i % COLORS.length],
          x: 70 + rank * 30,
          y: 360,
          vx: 0,
          vy: 0,
          r: 18,
          spin: 0,
          finished: true,
          finishTime: Date.now() + rank,
        }));
      finishRef.current = runnersRef.current.map((_, i) => i);
      setPhase('done');
      return;
    }

    setPhase('countdown');
    const seq = ['3', '2', '1', 'GO!'];
    seq.forEach((s, i) => setTimeout(() => setCountdown(s), i * 800));
    setTimeout(() => {
      phaseRef.current = 'racing';
      setPhase('racing');
      beginRace();
    }, seq.length * 800);
  };

  const finishOrder = useMemo(() => {
    if (phase !== 'done') return [];
    const runners = runnersRef.current;
    if (runners.length === 0) return finishRef.current;
    return finishRef.current.map((idx) => {
      const runner = runners[idx];
      return active.findIndex((p) => p.id === runner.id);
    });
  }, [active, phase]);

  const winners = useMemo(() => {
    if (phase !== 'done') return [];
    return settings.winMode === 'first'
      ? finishOrder.slice(0, winnerCount)
      : [...finishOrder].reverse().slice(0, winnerCount);
  }, [finishOrder, phase, settings.winMode, winnerCount]);

  const finish = () => {
    setLastResult({
      gameId: 'race',
      resultKind: 'order',
      winners: winners.map((i) => active[i].id),
      rankings: finishOrder.map((idx, rank) => ({
        name: active[idx].name,
        rank: rank + 1,
      })),
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  const restart = () => {
    cancelAnimationFrame(rafRef.current);
    finishRef.current = [];
    runnersRef.current = [];
    setFastForward(false);
    setPhase('setup');
  };

  const liveRanking = useMemo(() => {
    if (phase !== 'racing' && phase !== 'done') return [];
    const finished = finishRef.current.map((idx) => runnersRef.current[idx]).filter(Boolean);
    const running = runnersRef.current
      .filter((runner) => !runner.finished)
      .sort((a, b) => b.y - a.y);
    return [...finished, ...running];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finishRef.current.length, runnersRef.current.reduce((sum, r) => sum + r.y, 0)]);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[1.7fr_minmax(250px,0.7fr)] lg:items-start">
      {phase === 'done' && <ConfettiBurst count={50} />}

      <section className="panel relative flex flex-col gap-3 p-4 sm:p-6">
        {phase === 'countdown' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-pick-purple-950/80">
            <span className="pixel-title pop-win text-8xl text-pick-lime-400" key={countdown}>
              {countdown}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-ink-purple">
            {settings.winMode === 'first' ? '1등' : '마지막'} {winnerCount}명 당첨 · {course.label}
          </p>
          {phase === 'racing' && (
            <button
              type="button"
              className="option-chip !py-1.5 !text-sm"
              data-selected={fastForward}
              onClick={() => setFastForward((v) => !v)}
            >
              빨리감기
            </button>
          )}
        </div>

        <div className="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-[0_18px_45px_rgba(47,25,84,0.18)]">
          <canvas ref={canvasRef} className="block h-[560px] w-full" />
          {phase === 'setup' && (
            <div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-3 px-4">
              <button
                type="button"
                className="btn-primary px-12 text-3xl"
                onClick={start}
                disabled={active.length < 2}
              >
                출발!
              </button>
              {active.length < 2 && (
                <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-danger">
                  레이스는 2명 이상일 때 할 수 있어요
                </p>
              )}
              {hasWeights && (
                <p className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-muted">
                  레이스는 가중치 없이 모두 같은 조건으로 달려요
                </p>
              )}
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                {(Object.entries(COURSES) as [CourseId, (typeof COURSES)[CourseId]][]).map(
                  ([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      className="rounded-2xl border-2 bg-white/90 px-4 py-3 text-sm font-black text-ink-purple shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      data-selected={courseId === id}
                      disabled={phase !== 'setup'}
                      onClick={() => updateRace({ mapId: id })}
                      style={{
                        borderColor: courseId === id ? '#A3E635' : 'rgba(124, 58, 237, 0.18)',
                        background:
                          courseId === id
                            ? 'linear-gradient(180deg, rgba(244,255,208,0.96), rgba(255,255,255,0.92))'
                            : 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {c.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {phase === 'done' && (
          <div className="pop-win flex flex-col items-center gap-3 rounded-2xl bg-surface-lime p-4">
            <p className="pixel-title text-xl text-pick-purple-600">골인!</p>
            <p className="text-center text-3xl font-black text-ink-purple">
              {winners.map((i) => active[i].name).join(', ')}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={finish}>
                결과 보기
              </button>
              <button type="button" className="btn-secondary" onClick={restart}>
                다시 하기
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-black text-ink-purple">🏁 핀볼 레이스</h1>
            <Link to="/lobby" className="text-sm font-bold text-muted underline">
              ← 로비
            </Link>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">당첨 기준</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="option-chip"
                data-selected={settings.winMode === 'first'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ winMode: 'first' })}
              >
                1등
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.winMode === 'last'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ winMode: 'last' })}
              >
                마지막
              </button>
            </div>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">당첨 인원</p>
            <input
              type="number"
              min={1}
              max={active.length}
              value={settings.winnerCount}
              disabled={phase !== 'setup'}
              className="input-soft !w-28"
              onChange={(e) =>
                updateRace({ winnerCount: parseInt(e.target.value, 10) || 1 })
              }
            />
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">맵 선택</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(COURSES) as [CourseId, (typeof COURSES)[CourseId]][]).map(
                ([id, c]) => (
                  <button
                    key={id}
                    type="button"
                    className="option-chip"
                    data-selected={courseId === id}
                    disabled={phase !== 'setup'}
                    onClick={() => updateRace({ mapId: id })}
                  >
                    {c.shortLabel}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-extrabold text-ink-purple">속도</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="option-chip"
                data-selected={settings.speed === 'normal'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ speed: 'normal' })}
              >
                보통
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.speed === 'fast'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ speed: 'fast' })}
              >
                빠름
              </button>
            </div>
          </div>
        </div>

        {(phase === 'racing' || phase === 'done') && (
          <div className="panel p-4">
            <p className="mb-2 text-sm font-extrabold text-ink-purple">실시간 순위</p>
            <ol className="flex flex-col gap-1">
              {liveRanking.slice(0, 10).map((runner, rank) => (
                <li
                  key={runner.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold ${
                    rank === 0
                      ? 'bg-gradient-to-b from-[#FFF6A8] to-pick-yellow-400 text-ink'
                      : 'bg-surface-lavender text-ink-purple'
                  }`}
                >
                  <span className="pixel-title w-6 text-center">{rank + 1}</span>
                  <span>{runner.icon}</span>
                  <span className="truncate">{runner.name}</span>
                </li>
              ))}
              {liveRanking.length > 10 && (
                <li className="px-2 text-xs font-bold text-muted">
                  외 {liveRanking.length - 10}명
                </li>
              )}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
