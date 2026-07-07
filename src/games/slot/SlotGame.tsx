import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { useAppStore } from '../../stores/session';
import { activeParticipants, drawWinners } from '../../lib/draw';
import { tickSfx, winSfx } from '../../lib/sfx';
import type { Participant } from '../../lib/types';

const CAPSULE_COLORS = ['#FF6FCF', '#FFD84A', '#73F7C5', '#BFFF22', '#7551F2'];

type Phase = 'idle' | 'shaking' | 'dropping' | 'open';

export default function SlotGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.slot);
  const updateSlot = useAppStore((s) => s.updateSlot);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const active = useMemo(
    () => activeParticipants(participants, excludedIds),
    [participants, excludedIds],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [winners, setWinners] = useState<Participant[]>([]);
  const [reels, setReels] = useState<string[]>(['?', '?', '?']);
  const [lockedReels, setLockedReels] = useState(0);
  const lockedRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  const remaining = useMemo(
    () => active.filter((p) => !winners.some((w) => w.id === p.id)),
    [active, winners],
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const pull = () => {
    if (phase !== 'idle' || remaining.length === 0) return;
    const winner = drawWinners(remaining, [], 1, false)[0];
    if (!winner) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setWinners((w) => [...w, winner]);
      setReels([winner.name, winner.name, winner.name]);
      setLockedReels(3);
      setPhase('open');
      return;
    }

    if (settings.mode === 'gacha') {
      setPhase('shaking');
      tickSfx(soundRef.current);
      later(() => tickSfx(soundRef.current), 300);
      later(() => tickSfx(soundRef.current), 600);
      later(() => setPhase('dropping'), 900);
      later(() => {
        setWinners((w) => [...w, winner]);
        setPhase('open');
        winSfx(soundRef.current);
      }, 1800);
    } else {
      setPhase('shaking');
      setLockedReels(0);
      const spin = window.setInterval(() => {
        setReels((r) =>
          r.map((v, i) =>
            i < lockedRef.current
              ? v
              : remaining[Math.floor(Math.random() * remaining.length)].name,
          ),
        );
        tickSfx(soundRef.current);
      }, 90);
      timersRef.current.push(spin);

      [900, 1600, 2300].forEach((ms, i) => {
        later(() => {
          lockedRef.current = i + 1;
          setLockedReels(i + 1);
          setReels((r) => r.map((v, j) => (j <= i ? winner.name : v)));
          tickSfx(soundRef.current);
          if (i === 2) {
            window.clearInterval(spin);
            setWinners((w) => [...w, winner]);
            setPhase('open');
            winSfx(soundRef.current);
          }
        }, ms);
      });
    }
  };

  const again = () => {
    lockedRef.current = 0;
    setLockedReels(0);
    setReels(['?', '?', '?']);
    setPhase('idle');
  };

  const restart = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    setWinners([]);
    again();
  };

  const finish = () => {
    setLastResult({
      gameId: 'slot',
      winners: winners.map((p) => p.id),
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  const lastWinner = winners[winners.length - 1];
  const capsuleColor = CAPSULE_COLORS[winners.length % CAPSULE_COLORS.length];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1.4fr_minmax(280px,0.9fr)] lg:items-start">
      {phase === 'open' && <ConfettiBurst count={35} />}

      <section className="panel flex min-h-[440px] flex-col items-center justify-center gap-6 p-6">
        {settings.mode === 'gacha' ? (
          <>
            <div
              className={`relative flex size-60 items-center justify-center rounded-full border-8 border-pick-purple-600 bg-white shadow-xl ${
                phase === 'shaking' ? 'shake' : ''
              }`}
            >
              <div className="absolute inset-4 overflow-hidden rounded-full">
                {CAPSULE_COLORS.map((c, i) => (
                  <div
                    key={i}
                    className="absolute size-14 rounded-full border-2 border-white/60"
                    style={{
                      background: `linear-gradient(180deg, #FFFFFF 48%, ${c} 52%)`,
                      left: `${12 + (i % 3) * 30}%`,
                      top: `${20 + Math.floor(i / 3) * 34}%`,
                      transform: `rotate(${i * 40}deg)`,
                    }}
                  />
                ))}
              </div>
              <div className="absolute -bottom-3 left-1/2 h-8 w-14 -translate-x-1/2 rounded-b-xl border-4 border-pick-purple-600 bg-surface-lavender" />
            </div>

            {phase === 'dropping' && (
              <div
                className="pop-win size-20 rounded-full border-4 border-white shadow-lg"
                style={{
                  background: `linear-gradient(180deg, #FFFFFF 48%, ${capsuleColor} 52%)`,
                }}
              />
            )}

            {phase === 'open' && lastWinner && (
              <div className="pop-win rounded-3xl border-4 border-pick-lime-400 bg-surface-lime px-10 py-5 text-center">
                <p className="pixel-title text-xl text-pick-purple-600">당첨!</p>
                <p className="text-4xl font-black text-ink-purple">{lastWinner.name}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-3">
              {reels.map((name, i) => (
                <div
                  key={i}
                  className={`flex h-24 w-32 items-center justify-center rounded-2xl border-4 px-2 text-center ${
                    i < lockedReels
                      ? 'border-pick-lime-400 bg-surface-lime'
                      : 'border-pick-purple-600/30 bg-surface-lavender'
                  } ${phase === 'shaking' && i >= lockedReels ? 'blur-[1px]' : ''}`}
                >
                  <span className="truncate text-xl font-black text-ink-purple">
                    {name}
                  </span>
                </div>
              ))}
            </div>
            {phase === 'open' && lastWinner && (
              <div className="pop-win rounded-3xl border-4 border-pick-lime-400 bg-surface-lime px-10 py-4 text-center">
                <p className="pixel-title text-xl text-pick-purple-600">당첨!</p>
                <p className="text-4xl font-black text-ink-purple">{lastWinner.name}</p>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {phase === 'idle' && (
            <button
              type="button"
              className="btn-primary px-12 text-3xl"
              onClick={pull}
              disabled={remaining.length === 0}
            >
              뽑기!
            </button>
          )}
          {phase === 'open' && (
            <>
              {remaining.length > 0 && (
                <button type="button" className="btn-secondary" onClick={again}>
                  한 번 더 (남은 {remaining.length}명)
                </button>
              )}
              <button type="button" className="btn-primary px-8 text-xl" onClick={finish}>
                결과 보기 →
              </button>
              <button type="button" className="btn-secondary" onClick={restart}>
                처음부터
              </button>
            </>
          )}
        </div>

        <p className="text-xs font-bold text-muted">
          모두에게 공평한 확률이에요 🍀
        </p>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-ink-purple">🎁 캡슐 뽑기</h1>
          <Link to="/lobby" className="text-sm font-bold text-muted underline">
            ← 로비
          </Link>
        </div>

        <p className="mb-4 rounded-xl bg-surface-lavender px-3 py-2 text-sm font-bold text-ink-purple">
          캡슐이 데구르르! 오늘의 주인공을 뽑아요.
        </p>

        <div className="mb-3">
          <p className="mb-1 text-sm font-extrabold text-ink-purple">뽑기 방법</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="option-chip"
              data-selected={settings.mode === 'gacha'}
              disabled={phase !== 'idle'}
              onClick={() => updateSlot({ mode: 'gacha' })}
            >
              🥚 캡슐
            </button>
            <button
              type="button"
              className="option-chip"
              data-selected={settings.mode === 'slot'}
              disabled={phase !== 'idle'}
              onClick={() => updateSlot({ mode: 'slot' })}
            >
              🎲 이름 맞추기
            </button>
          </div>
        </div>

        {winners.length > 0 && (
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

        <p className="border-t border-ink-purple/10 pt-3 text-sm font-bold text-muted">
          참가 {active.length}명 · 남은 {remaining.length}명
        </p>
      </section>
    </div>
  );
}
