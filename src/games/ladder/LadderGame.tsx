import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LazyLottie from '../../components/lottie/LazyLottie';
import { useAppStore } from '../../stores/session';
import { activeParticipants, shuffle } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';
import { showToast } from '../../lib/toast';

const COL_W = 76;
const ROW_H = 40;
const TOP = 64;
const BOTTOM = 64;

type Rungs = boolean[][];

function genRungs(cols: number, rows: number): Rungs {
  const rungs: Rungs = Array.from({ length: rows }, () =>
    Array<boolean>(Math.max(0, cols - 1)).fill(false),
  );
  if (cols < 2) return rungs;

  for (let r = 0; r < rows; r++) {
    for (const c of shuffle(Array.from({ length: cols - 1 }, (_, i) => i))) {
      const leftUsed = c > 0 && rungs[r][c - 1];
      const rightUsed = c < cols - 2 && rungs[r][c + 1];
      if (!leftUsed && !rightUsed && Math.random() < 0.42) rungs[r][c] = true;
    }
  }
  for (let c = 0; c < cols - 1; c++) {
    if (rungs.some((row) => row[c])) continue;
    for (const r of shuffle(Array.from({ length: rows }, (_, i) => i))) {
      const leftUsed = c > 0 && rungs[r][c - 1];
      const rightUsed = c < cols - 2 && rungs[r][c + 1];
      if (!leftUsed && !rightUsed) {
        rungs[r][c] = true;
        break;
      }
    }
  }
  return rungs;
}

function tracePath(rungs: Rungs, cols: number, startCol: number, xOf: (c: number) => number) {
  const rows = rungs.length;
  const points: [number, number][] = [[xOf(startCol), TOP]];
  let col = startCol;
  for (let r = 0; r < rows; r++) {
    const y = TOP + (r + 0.5) * ROW_H;
    if (col < cols - 1 && rungs[r][col]) {
      points.push([xOf(col), y], [xOf(col + 1), y]);
      col++;
    } else if (col > 0 && rungs[r][col - 1]) {
      points.push([xOf(col), y], [xOf(col - 1), y]);
      col--;
    }
  }
  points.push([xOf(col), TOP + rows * ROW_H]);
  return { points, endCol: col };
}

function pathLength(points: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return len;
}

function pointAt(points: [number, number][], dist: number): [number, number] {
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (acc + seg >= dist) {
      const t = seg === 0 ? 0 : (dist - acc) / seg;
      return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
      ];
    }
    acc += seg;
  }
  return points[points.length - 1];
}

const PRESET_ROLES = ['이끔이', '기록이', '나눔이', '지킴이'];

export default function LadderGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.ladder);
  const updateLadder = useAppStore((s) => s.updateLadder);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const active = useMemo(
    () => activeParticipants(participants, excludedIds),
    [participants, excludedIds],
  );
  const cols = active.length;
  const rows = Math.min(14, Math.max(6, cols + 3));

  const [rungs, setRungs] = useState<Rungs>(() => genRungs(cols, rows));
  const [assigned, setAssigned] = useState<Record<number, number>>({});
  const [boardVisible, setBoardVisible] = useState(false);
  const [marble, setMarble] = useState<{
    col: number;
    points: [number, number][];
    dist: number;
    total: number;
  } | null>(null);
  const rafRef = useRef(0);
  const animatingRef = useRef(false);
  const revealAllRef = useRef(false);

  useEffect(() => {
    setRungs(genRungs(cols, rows));
    setAssigned({});
    setBoardVisible(false);
    setMarble(null);
  }, [cols, rows]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const xOf = (c: number) => 30 + c * COL_W;
  const width = 60 + Math.max(0, cols - 1) * COL_W;
  const height = TOP + rows * ROW_H + BOTTOM;

  const effLabels = useMemo(() => {
    const raw = settings.labels.filter((l) => l.trim());
    const base = Array.from({ length: cols }, (_, i) => {
      if (raw.length === 0) return i === 0 ? '🎉 당첨' : '꽝';
      if (raw.length === 1) return i === 0 ? raw[0] : '꽝';
      return raw[i % raw.length];
    });
    return shuffle(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.labels, cols, rungs]);

  const runTrace = (startCol: number, durMs: number) =>
    new Promise<void>((resolve) => {
      const { points, endCol } = tracePath(rungs, cols, startCol, xOf);
      const total = pathLength(points);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced || durMs <= 0) {
        setAssigned((a) => ({ ...a, [startCol]: endCol }));
        resolve();
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durMs);
        const eased = 1 - Math.pow(1 - t, 2);
        setMarble({ col: startCol, points, dist: total * eased, total });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setMarble(null);
          setAssigned((a) => ({ ...a, [startCol]: endCol }));
          winSfx(soundEnabled);
          resolve();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    });

  const traceOne = async (startCol: number) => {
    if (animatingRef.current || assigned[startCol] !== undefined) return;
    animatingRef.current = true;
    setBoardVisible(true);
    await runTrace(startCol, 1400);
    animatingRef.current = false;
  };

  const revealAll = async () => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setBoardVisible(true);
    revealAllRef.current = true;
    for (let c = 0; c < cols; c++) {
      if (!revealAllRef.current) break;
      if (assigned[c] === undefined) await runTrace(c, 650);
    }
    revealAllRef.current = false;
    animatingRef.current = false;
  };

  const regenerate = () => {
    revealAllRef.current = false;
    cancelAnimationFrame(rafRef.current);
    animatingRef.current = false;
    setRungs(genRungs(cols, rows));
    setAssigned({});
    setBoardVisible(false);
    setMarble(null);
    showToast('사다리를 새로 만들었어요');
  };

  const allDone = cols > 0 && Object.keys(assigned).length === cols;

  const finish = () => {
    if (!allDone) {
      showToast('전원 공개 후 결과를 볼 수 있어요');
      return;
    }
    setLastResult({
      gameId: 'ladder',
      resultKind: 'assignment',
      winners: [],
      assignments: active.map((p, c) => ({
        name: p.name,
        label: effLabels[assigned[c]],
      })),
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  const labelText = settings.labels.join('\n');

  if (cols < 2) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-xl font-black text-ink-purple">
          사다리타기는 2명 이상일 때 할 수 있어요
        </p>
        <Link to="/" className="btn-secondary mt-4 inline-flex no-underline">
          명단 고치기
        </Link>
      </div>
    );
  }

  return (
    <div className="game-shell lg:grid-cols-[1.6fr_minmax(260px,0.8fr)] lg:items-start">
      <section className="panel overflow-x-auto p-3 sm:p-4">
        <div className="relative mx-auto w-fit">
          <svg width={width} height={height} className="block">
            {active.map((p, c) => {
              const done = assigned[c] !== undefined;
              return (
                <g
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => void traceOne(c)}
                >
                  <circle
                    cx={xOf(c)}
                    cy={TOP - 34}
                    r={17}
                    fill={done ? '#BFFF22' : '#7551F2'}
                  />
                  <text
                    x={xOf(c)}
                    y={TOP - 33}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill={done ? '#32126A' : '#FFFFFF'}
                  >
                    {p.name.slice(0, 3)}
                  </text>
                </g>
              );
            })}

            {boardVisible && (
              <>
                {active.map((_, c) => (
                  <line
                    key={`rail-${c}`}
                    x1={xOf(c)}
                    y1={TOP}
                    x2={xOf(c)}
                    y2={TOP + rows * ROW_H}
                    stroke="#7551F2"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                ))}

                {rungs.map((row, r) =>
                  row.map((has, c) =>
                    has ? (
                      <line
                        key={`rung-${r}-${c}`}
                        x1={xOf(c)}
                        y1={TOP + (r + 0.5) * ROW_H}
                        x2={xOf(c + 1)}
                        y2={TOP + (r + 0.5) * ROW_H}
                        stroke="#B49CFF"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    ) : null,
                  ),
                )}

                {Object.entries(assigned).map(([c]) => {
                  const { points } = tracePath(rungs, cols, Number(c), xOf);
                  return (
                    <polyline
                      key={`done-${c}`}
                      points={points.map((p) => p.join(',')).join(' ')}
                      fill="none"
                      stroke="#BFFF22"
                      strokeWidth="5"
                      strokeOpacity="0.55"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}

                {marble && (
                  <>
                    <polyline
                      points={(() => {
                        const pts: [number, number][] = [];
                        let acc = 0;
                        for (let i = 0; i < marble.points.length; i++) {
                          if (i > 0) {
                            acc += Math.hypot(
                              marble.points[i][0] - marble.points[i - 1][0],
                              marble.points[i][1] - marble.points[i - 1][1],
                            );
                          }
                          if (acc > marble.dist) break;
                          pts.push(marble.points[i]);
                        }
                        pts.push(pointAt(marble.points, marble.dist));
                        return pts.map((p) => p.join(',')).join(' ');
                      })()}
                      fill="none"
                      stroke="#BFFF22"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={pointAt(marble.points, marble.dist)[0]}
                      cy={pointAt(marble.points, marble.dist)[1]}
                      r="11"
                      fill="#FF6FCF"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                    />
                  </>
                )}

                {effLabels.map((label, c) => {
                  const reached = Object.values(assigned).includes(c);
                  return (
                    <g key={`label-${c}`}>
                      <rect
                        x={xOf(c) - COL_W / 2 + 6}
                        y={TOP + rows * ROW_H + 12}
                        width={COL_W - 12}
                        height={34}
                        rx={10}
                        fill={reached ? '#F4FFD0' : '#F3EDFF'}
                        stroke={reached ? '#BFFF22' : 'transparent'}
                        strokeWidth="3"
                      />
                      <text
                        x={xOf(c)}
                        y={TOP + rows * ROW_H + 30}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fontWeight="800"
                        fill="#32126A"
                      >
                        {label.slice(0, 5)}
                      </text>
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          {!boardVisible && (
            <div
              className="absolute inset-x-0 bottom-0 top-14 flex flex-col items-center justify-center rounded-2xl bg-white/95 px-6 text-center shadow-inner"
              style={{ minWidth: width }}
            >
              <LazyLottie
                src="/lottie/ladder/curtain-reveal/lottie.json"
                loop
                className="h-44 w-64"
                fallback={<div className="text-6xl">🔒</div>}
              />
              <p className="text-lg font-black text-ink-purple">사다리는 아직 가려져 있어요</p>
              <p className="mt-1 text-sm font-bold text-muted">
                이름을 누르거나 전원 공개를 누르면 그때 결과를 확인합니다
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-ink-purple">🪜 사다리타기</h1>
          <Link to="/lobby" className="text-sm font-bold text-muted underline">
            ← 로비
          </Link>
        </div>

        <p className="mb-4 rounded-xl bg-surface-lavender px-3 py-2 text-sm font-bold text-ink-purple">
          이름을 누르면 구슬이 내려가요. 사다리는 무작위 자동 생성!
        </p>

        <div className="mb-3">
          <p className="mb-1 text-sm font-extrabold text-ink-purple">
            끝칸 라벨 <span className="font-bold text-muted">(한 줄에 하나)</span>
          </p>
          <textarea
            className="input-soft min-h-24 !text-sm"
            value={labelText}
            onChange={(e) => updateLadder({ labels: e.target.value.split(/\r?\n/) })}
            placeholder={'비워두면 당첨 1개 + 꽝\n라벨이 모자라면 순서대로 반복돼요'}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="option-chip !py-1.5 !text-xs"
              onClick={() => updateLadder({ labels: ['🎉 당첨'] })}
            >
              당첨 1개
            </button>
            <button
              type="button"
              className="option-chip !py-1.5 !text-xs"
              onClick={() => updateLadder({ labels: PRESET_ROLES })}
            >
              모둠 역할 4개
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <button type="button" className="btn-primary" onClick={() => void revealAll()}>
            전원 공개
          </button>
          <button type="button" className="btn-secondary" onClick={regenerate}>
            🔀 사다리 다시 만들기
          </button>
          {allDone && (
            <button type="button" className="btn-primary text-xl" onClick={finish}>
              결과 보기 →
            </button>
          )}
        </div>

        <p className="border-t border-ink-purple/10 pt-3 text-sm font-bold text-muted">
          참가 {cols}명 · 공개 {Object.keys(assigned).length}명
        </p>
      </section>
    </div>
  );
}
