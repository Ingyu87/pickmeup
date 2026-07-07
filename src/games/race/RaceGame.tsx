import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { useAppStore } from '../../stores/session';
import { activeParticipants, shuffle } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';

const RUNNERS = [
  '🐰', '🐢', '🦊', '🐼', '🐸', '🐥', '🦄', '🐙', '🐶', '🐱',
  '🦁', '🐷', '🐨', '🐵', '🐧', '🦖', '🐳', '🦉', '🐹', '🐮',
  '🦋', '🐞', '🦕', '🐻', '🐭', '🦜', '🐔', '🦩', '🐿️', '🦔',
];

const COURSES = {
  short: { label: '짧게', ms: 7000 },
  normal: { label: '보통', ms: 11000 },
  long: { label: '길게', ms: 15000 },
} as const;

type CourseId = keyof typeof COURSES;
type Phase = 'setup' | 'countdown' | 'racing' | 'done';

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
  const [, setFrame] = useState(0);
  const [fastForward, setFastForward] = useState(false);

  const progressRef = useRef<number[]>([]);
  const velRef = useRef<number[]>([]);
  const finishRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const ffRef = useRef(false);
  ffRef.current = fastForward;

  const courseId = (settings.mapId in COURSES ? settings.mapId : 'normal') as CourseId;
  const winnerCount = Math.min(Math.max(1, settings.winnerCount), active.length);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const beginRace = () => {
    progressRef.current = active.map(() => 0);
    velRef.current = active.map(() => 0.8 + Math.random() * 0.4);
    finishRef.current = [];
    lastTimeRef.current = 0;

    const durMs =
      COURSES[courseId].ms * (settings.speed === 'fast' ? 0.6 : 1);

    const step = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const dt = Math.min(50, now - lastTimeRef.current);
      lastTimeRef.current = now;

      const winnersDecided =
        settings.winMode === 'first' &&
        finishRef.current.length >= winnerCount;
      const mult = ffRef.current ? 4 : winnersDecided ? 3 : 1;

      for (let i = 0; i < active.length; i++) {
        if (progressRef.current[i] >= 1) continue;
        velRef.current[i] =
          velRef.current[i] * 0.9 + (0.4 + Math.random() * 1.2) * 0.1;
        progressRef.current[i] += (dt / durMs) * velRef.current[i] * mult;
        if (progressRef.current[i] >= 1) {
          progressRef.current[i] = 1;
          finishRef.current.push(i);
          if (finishRef.current.length === 1) winSfx(soundEnabled);
        }
      }
      setFrame((f) => f + 1);

      if (finishRef.current.length < active.length) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase('done');
        winSfx(soundEnabled);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const start = () => {
    if (phase !== 'setup' || active.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      finishRef.current = shuffle(active.map((_, i) => i));
      progressRef.current = active.map(() => 1);
      setPhase('done');
      return;
    }

    setPhase('countdown');
    const seq = ['3', '2', '1', 'GO!'];
    seq.forEach((s, i) => setTimeout(() => setCountdown(s), i * 800));
    setTimeout(() => {
      setPhase('racing');
      beginRace();
    }, seq.length * 800);
  };

  const winners = useMemo(() => {
    if (phase !== 'done') return [];
    const order = finishRef.current;
    return settings.winMode === 'first'
      ? order.slice(0, winnerCount)
      : [...order].reverse().slice(0, winnerCount);
  }, [phase, settings.winMode, winnerCount]);

  const finish = () => {
    setLastResult({
      gameId: 'race',
      winners: winners.map((i) => active[i].id),
      rankings: finishRef.current.map((idx, rank) => ({
        name: active[idx].name,
        rank: rank + 1,
      })),
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  const restart = () => {
    cancelAnimationFrame(rafRef.current);
    setPhase('setup');
    setFastForward(false);
  };

  const liveRanking = useMemo(() => {
    if (phase !== 'racing' && phase !== 'done') return [];
    return active
      .map((p, i) => ({ p, i, prog: progressRef.current[i] ?? 0 }))
      .sort((a, b) => {
        const fa = finishRef.current.indexOf(a.i);
        const fb = finishRef.current.indexOf(b.i);
        if (fa !== -1 && fb !== -1) return fa - fb;
        if (fa !== -1) return -1;
        if (fb !== -1) return 1;
        return b.prog - a.prog;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active, progressRef.current.reduce((s, v) => s + v, 0)]);

  const hasWeights = active.some((p) => p.weight > 1);

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

        {phase === 'setup' ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center gap-5">
            <div className="text-8xl">🏁</div>
            <p className="text-xl font-black text-ink-purple">
              {active.length}명이 달릴 준비를 마쳤어요
            </p>
            <button
              type="button"
              className="btn-primary px-12 text-3xl"
              onClick={start}
              disabled={active.length < 2}
            >
              출발!
            </button>
            {active.length < 2 && (
              <p className="text-sm font-bold text-danger">
                레이스는 2명 이상일 때 할 수 있어요
              </p>
            )}
            {hasWeights && (
              <p className="text-xs font-bold text-muted">
                레이스는 가중치 없이 모두 같은 조건으로 달려요
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-ink-purple">
                {settings.winMode === 'first' ? '🥇 1등' : '🐢 꼴찌'} {winnerCount}명 당첨
              </p>
              {phase === 'racing' && (
                <button
                  type="button"
                  className="option-chip !py-1.5 !text-sm"
                  data-selected={fastForward}
                  onClick={() => setFastForward((v) => !v)}
                >
                  ⏩ 빨리감기
                </button>
              )}
            </div>

            <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
              {active.map((p, i) => {
                const prog = progressRef.current[i] ?? 0;
                const finRank = finishRef.current.indexOf(i);
                const isWinner = phase === 'done' && winners.includes(i);
                return (
                  <div key={p.id} className="grid grid-cols-[72px_1fr] items-center gap-2">
                    <span
                      className="truncate text-right text-xs font-extrabold text-ink-purple"
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    <div
                      className={`relative h-9 overflow-hidden rounded-full border-2 ${
                        isWinner
                          ? 'border-pick-lime-400 bg-surface-lime'
                          : 'border-ink-purple/10 bg-surface-lavender'
                      }`}
                    >
                      <div className="absolute inset-y-1 right-2 w-0 border-r-4 border-dashed border-pick-purple-600/50" />
                      <div
                        className="absolute top-1/2 flex -translate-y-1/2 items-center"
                        style={{ left: `calc(${Math.min(prog, 1) * 100}% - ${prog * 40}px)` }}
                      >
                        <span className="text-2xl leading-none">
                          {RUNNERS[i % RUNNERS.length]}
                        </span>
                        {finRank !== -1 && (
                          <span className="pixel-title ml-1 text-sm text-pick-purple-600">
                            {finRank + 1}등
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === 'done' && (
              <div className="pop-win flex flex-col items-center gap-3 rounded-2xl bg-surface-lime p-4">
                <p className="pixel-title text-xl text-pick-purple-600">당첨!</p>
                <p className="text-center text-3xl font-black text-ink-purple">
                  {winners.map((i) => active[i].name).join(', ')}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" onClick={finish}>
                    결과 보기 →
                  </button>
                  <button type="button" className="btn-secondary" onClick={restart}>
                    다시 하기
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-black text-ink-purple">🏁 레이스</h1>
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
                🥇 1등
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.winMode === 'last'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ winMode: 'last' })}
              >
                🐢 꼴찌
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
            <p className="mb-1 text-sm font-extrabold text-ink-purple">코스 길이</p>
            <div className="flex gap-2">
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
                    {c.label}
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
              {liveRanking.slice(0, 10).map(({ p, i }, rank) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold ${
                    rank === 0
                      ? 'bg-gradient-to-b from-[#FFF6A8] to-pick-yellow-400 text-ink'
                      : 'bg-surface-lavender text-ink-purple'
                  }`}
                >
                  <span className="pixel-title w-6 text-center">{rank + 1}</span>
                  <span>{RUNNERS[i % RUNNERS.length]}</span>
                  <span className="truncate">{p.name}</span>
                </li>
              ))}
              {liveRanking.length > 10 && (
                <li className="px-2 text-xs font-bold text-muted">
                  … 외 {liveRanking.length - 10}명
                </li>
              )}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
