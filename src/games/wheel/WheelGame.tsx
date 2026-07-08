import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import LazyLottie from '../../components/lottie/LazyLottie';
import { useAppStore } from '../../stores/session';
import { activeParticipants, pickWeighted } from '../../lib/draw';
import { tickSfx, winSfx } from '../../lib/sfx';
import type { Participant } from '../../lib/types';

const SLICE_COLORS = ['#F3EDFF', '#FFF0F8', '#F4FFD0', '#FFF3D6', '#E4FBF1'];

interface Slice {
  p: Participant;
  start: number;
  end: number;
  color: string;
}

function buildSlices(list: Participant[]): Slice[] {
  const total = list.reduce((s, p) => s + Math.max(1, p.weight), 0);
  let acc = 0;
  return list.map((p, i) => {
    const start = acc / total;
    acc += Math.max(1, p.weight);
    return { p, start, end: acc / total, color: SLICE_COLORS[i % SLICE_COLORS.length] };
  });
}

function arcPath(cx: number, cy: number, r: number, f0: number, f1: number): string {
  const a0 = f0 * Math.PI * 2 - Math.PI / 2;
  const a1 = f1 * Math.PI * 2 - Math.PI / 2;
  const large = f1 - f0 > 0.5 ? 1 : 0;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

type Phase = 'idle' | 'spinning' | 'landed';

export default function WheelGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.wheel);
  const updateWheel = useAppStore((s) => s.updateWheel);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const active = useMemo(
    () => activeParticipants(participants, excludedIds),
    [participants, excludedIds],
  );

  const wheelMode = settings.wheelMode ?? 'names';
  const missions = useMemo(
    () => (settings.missions ?? []).map((m) => m.trim()).filter(Boolean),
    [settings.missions],
  );
  const missionItems = useMemo<Participant[]>(
    () => missions.map((m, i) => ({ id: `mission-${i}`, name: m, weight: 1 })),
    [missions],
  );
  const wheelSource = wheelMode === 'missions' ? missionItems : active;

  const [wheelPs, setWheelPs] = useState<Participant[]>(wheelSource);
  const [winners, setWinners] = useState<Participant[]>([]);
  const [assignments, setAssignments] = useState<{ name: string; label: string }[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rot, setRot] = useState(0);

  const rotRef = useRef(0);
  const rafRef = useRef(0);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    setWheelPs(wheelSource);
    setWinners([]);
    setAssignments([]);
    setPhase('idle');
  }, [wheelSource]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const slices = useMemo(() => buildSlices(wheelPs), [wheelPs]);
  const winnerCount = Math.min(Math.max(1, settings.winnerCount), active.length);
  const lastWinner = winners[winners.length - 1];

  const spinWith = (list: Participant[]) => {
    const localSlices = buildSlices(list);
    const winner = pickWeighted(list);
    if (!winner) return;
    const slice = localSlices.find((s) => s.p.id === winner.id);
    if (!slice) return;

    setPhase('spinning');

    const midFrac =
      (slice.start + slice.end) / 2 +
      (Math.random() - 0.5) * 0.7 * (slice.end - slice.start);
    const targetDeg = midFrac * 360 - 90;
    const from = rotRef.current;
    const delta = (((270 - targetDeg - from) % 360) + 360) % 360;
    const target = from + 360 * 5 + delta;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduced ? 0 : 4200;
    const startTime = performance.now();
    let lastIdx = -1;

    const sliceIndexAt = (frac: number) =>
      localSlices.findIndex((s) => frac >= s.start && frac < s.end);

    const step = (now: number) => {
      const t = dur === 0 ? 1 : Math.min(1, (now - startTime) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const r = from + (target - from) * eased;
      rotRef.current = r;
      setRot(r);

      const frac = (((-r % 360) + 360) % 360) / 360;
      const idx = sliceIndexAt(frac);
      if (idx !== lastIdx) {
        lastIdx = idx;
        tickSfx(soundRef.current);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setPhase('landed');
        setWinners((w) => [...w, winner]);
        winSfx(soundRef.current);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const spin = () => {
    if (phase === 'spinning' || wheelPs.length < 2) return;
    spinWith(wheelPs);
  };

  const nextSpin = () => {
    if (!lastWinner) return;
    const next = wheelPs.filter((p) => p.id !== lastWinner.id);
    setWheelPs(next);
    setPhase('idle');
    spinWith(next);
  };

  const assignWorker = () => {
    if (!lastWinner) return;
    const taken = new Set(assignments.map((a) => a.name));
    const pool = active.filter((p) => !taken.has(p.name));
    const pick = pickWeighted(pool.length > 0 ? pool : active);
    if (!pick) return;
    setAssignments((a) => [...a, { name: pick.name, label: lastWinner.name }]);
    winSfx(soundRef.current);
  };

  const nextMission = () => {
    if (!lastWinner) return;
    const next = wheelPs.filter((p) => p.id !== lastWinner.id);
    setWheelPs(next);
    setPhase('idle');
    if (next.length >= 2) spinWith(next);
  };

  const finish = () => {
    if (wheelMode === 'missions') {
      setLastResult({
        gameId: 'wheel',
        winners: [],
        assignments,
        resultKind: 'assignment',
        drawnAt: Date.now(),
      });
    } else {
      setLastResult({
        gameId: 'wheel',
        winners: winners.map((p) => p.id),
        drawnAt: Date.now(),
      });
    }
    navigate('/result');
  };

  const restart = () => {
    cancelAnimationFrame(rafRef.current);
    setWheelPs(wheelSource);
    setWinners([]);
    setAssignments([]);
    setPhase('idle');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'idle' && winners.length === 0) spin();
        else if (
          wheelMode === 'names' &&
          phase === 'landed' &&
          winners.length < winnerCount
        ) {
          nextSpin();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fontSize =
    slices.length <= 8 ? 22 : slices.length <= 16 ? 17 : slices.length <= 24 ? 13 : 10;
  const done = wheelMode === 'names' && winners.length >= winnerCount && phase === 'landed';

  return (
    <div className="game-shell max-w-6xl lg:grid-cols-[1.4fr_minmax(280px,0.9fr)] lg:items-start">
      {done && <ConfettiBurst count={50} />}

      <section className="panel relative flex flex-col items-center gap-4 p-4 sm:p-6">
        <div className="relative w-full max-w-[min(32rem,78vh)]">
          <div
            className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
            aria-hidden
          >
            <svg width="36" height="30" viewBox="0 0 36 30">
              <polygon
                points="18,30 2,0 34,0"
                fill="#BFFF22"
                stroke="#4B16B8"
                strokeWidth="3"
              />
            </svg>
          </div>

          <svg
            viewBox="0 0 400 400"
            className={`w-full ${phase === 'spinning' ? 'drop-shadow-[0_0_24px_rgba(191,255,34,0.6)]' : 'drop-shadow-xl'}`}
          >
            <circle cx="200" cy="200" r="198" fill="#4B16B8" />
            <g transform={`rotate(${rot} 200 200)`}>
              {slices.length === 1 ? (
                <circle cx="200" cy="200" r="188" fill={SLICE_COLORS[0]} />
              ) : (
                slices.map((s) => (
                  <path
                    key={s.p.id}
                    d={arcPath(200, 200, 188, s.start, s.end)}
                    fill={s.color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                ))
              )}
              {slices.map((s) => {
                const mid = ((s.start + s.end) / 2) * 360 - 90;
                return (
                  <text
                    key={`t-${s.p.id}`}
                    x="200"
                    y="200"
                    fill="#32126A"
                    fontWeight="800"
                    fontSize={fontSize}
                    textAnchor="end"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} 200 200) translate(170 0)`}
                  >
                    {s.p.name}
                  </text>
                );
              })}
            </g>
            <circle cx="200" cy="200" r="34" fill="#FFFFFF" stroke="#4B16B8" strokeWidth="4" />
            <text
              x="200"
              y="201"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="24"
            >
              🎯
            </text>
          </svg>

          {phase === 'landed' && (
            <div className="pointer-events-none absolute inset-0 z-10">
              <LazyLottie
                key={winners.length}
                src="/lottie/wheel/win-burst/lottie.json"
                className="h-full w-full"
              />
            </div>
          )}
        </div>

        {phase === 'landed' && lastWinner && (
          <div className="pop-win rounded-2xl bg-surface-lime px-8 py-4 text-center">
            <p className="pixel-title text-xl text-pick-purple-600">
              {wheelMode === 'missions' ? '📋 미션!' : '당첨!'}
            </p>
            <p className="text-4xl font-black text-ink-purple">{lastWinner.name}</p>
            {wheelMode === 'missions' &&
              assignments.filter((a) => a.label === lastWinner.name).length > 0 && (
                <p className="mt-1 text-lg font-extrabold text-pick-purple-600">
                  →{' '}
                  {assignments
                    .filter((a) => a.label === lastWinner.name)
                    .map((a) => a.name)
                    .join(', ')}
                </p>
              )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {phase === 'idle' && winners.length === 0 && (
            <button
              type="button"
              className="btn-primary px-8 text-2xl sm:px-12 sm:text-3xl"
              onClick={spin}
              disabled={wheelPs.length < 2}
            >
              돌리기!
            </button>
          )}
          {wheelMode === 'names' && phase === 'landed' && winners.length < winnerCount && (
            <button type="button" className="btn-primary" onClick={nextSpin}>
              다음 스핀 ({winners.length}/{winnerCount})
            </button>
          )}
          {wheelMode === 'missions' && phase === 'landed' && (
            <>
              <button type="button" className="btn-primary" onClick={assignWorker}>
                👤 담당자 뽑기
              </button>
              {wheelPs.length > 1 && (
                <button type="button" className="btn-secondary" onClick={nextMission}>
                  다음 미션 돌리기
                </button>
              )}
            </>
          )}
          {(done || (wheelMode === 'missions' && assignments.length > 0)) && (
            <button type="button" className="btn-primary px-8 text-xl sm:px-10 sm:text-2xl" onClick={finish}>
              결과 보기 →
            </button>
          )}
          {winners.length > 0 && (
            <button type="button" className="btn-secondary" onClick={restart}>
              다시 하기
            </button>
          )}
        </div>

        {wheelPs.length < 2 && phase === 'idle' && (
          <p className="text-sm font-bold text-danger">
            {wheelMode === 'missions'
              ? '미션을 2개 이상 입력하면 돌릴 수 있어요'
              : '돌림판은 2명 이상일 때 돌릴 수 있어요'}
          </p>
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-ink-purple">🎡 돌림판</h1>
          <Link to="/lobby" className="text-sm font-bold text-muted underline">
            ← 로비
          </Link>
        </div>

        <p className="mb-4 rounded-xl bg-surface-lavender px-3 py-2 text-sm font-bold text-ink-purple">
          {wheelMode === 'missions'
            ? '멈춘 칸의 미션을 뽑고, 담당자까지 정할 수 있어요!'
            : '돌림판을 돌려서 멈춘 칸의 친구가 당첨이에요!'}
        </p>

        <div className="mb-3">
          <p className="mb-1 text-sm font-extrabold text-ink-purple">돌림판 종류</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="option-chip"
              data-selected={wheelMode === 'names'}
              disabled={phase === 'spinning'}
              onClick={() => updateWheel({ wheelMode: 'names' })}
            >
              👥 친구 뽑기
            </button>
            <button
              type="button"
              className="option-chip"
              data-selected={wheelMode === 'missions'}
              disabled={phase === 'spinning'}
              onClick={() => updateWheel({ wheelMode: 'missions' })}
            >
              📋 미션 룰렛
            </button>
          </div>
        </div>

        {wheelMode === 'missions' ? (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">
              미션 목록 <span className="font-bold text-muted">(한 줄에 하나)</span>
            </p>
            <textarea
              className="input-soft min-h-24 !text-sm"
              value={(settings.missions ?? []).join('\n')}
              disabled={phase === 'spinning'}
              onChange={(e) => updateWheel({ missions: e.target.value.split(/\r?\n/) })}
              placeholder={'칠판 닦기\n분리수거\n우유 정리'}
            />
            <button
              type="button"
              className="option-chip mt-2 !py-1.5 !text-xs"
              onClick={() =>
                updateWheel({ missions: ['칠판 닦기', '바닥 쓸기', '분리수거', '우유 정리'] })
              }
            >
              청소 미션 4개
            </button>
          </div>
        ) : (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">당첨 인원</p>
            <input
              type="number"
              min={1}
              max={active.length}
              value={settings.winnerCount}
              disabled={phase === 'spinning' || winners.length > 0}
              className="input-soft !w-28"
              onChange={(e) =>
                updateWheel({ winnerCount: parseInt(e.target.value, 10) || 1 })
              }
            />
            {winnerCount > 1 && (
              <p className="mt-1 text-xs text-muted">
                한 번 뽑힌 친구는 빠지고 다시 돌려요
              </p>
            )}
          </div>
        )}

        {wheelMode === 'missions' && assignments.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">배정된 미션</p>
            <ol className="flex flex-col gap-1">
              {assignments.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="rounded-xl bg-surface-lime px-3 py-1.5 text-sm font-black text-ink-purple"
                >
                  {a.name} → {a.label}
                </li>
              ))}
            </ol>
          </div>
        )}

        {wheelMode === 'names' && winners.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">지금까지 당첨</p>
            <ol className="flex flex-col gap-1">
              {winners.map((w, i) => (
                <li
                  key={`${w.id}-${i}`}
                  className="rounded-xl bg-surface-lime px-3 py-1.5 text-base font-black text-ink-purple"
                >
                  {i + 1}. {w.name}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-4 border-t border-ink-purple/10 pt-3 text-sm font-bold text-muted">
          {wheelMode === 'missions'
            ? `참가 ${active.length}명 · 미션 ${wheelPs.length}개`
            : `참가 ${active.length}명 · 판에 ${wheelPs.length}명`}
        </p>
        {active.some((p) => p.weight > 1) && (
          <p className="mt-2 rounded-xl bg-surface-lime px-3 py-2 text-xs font-bold text-ink-purple">
            ⚖️ 가중치가 있는 친구는 칸이 더 넓어요
          </p>
        )}
      </section>
    </div>
  );
}
