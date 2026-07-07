import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { useAppStore } from '../../stores/session';
import { activeParticipants, drawOrder, drawWinners } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';
import type { Participant } from '../../lib/types';

type Phase = 'setup' | 'drawing' | 'reveal';

export default function LotGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.lot);
  const updateLot = useAppStore((s) => s.updateLot);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const [phase, setPhase] = useState<Phase>('setup');
  const [drawn, setDrawn] = useState<Participant[]>([]);
  const [revealed, setRevealed] = useState(0);

  const active = activeParticipants(participants, excludedIds);
  const maxCount = settings.allowDuplicate ? 99 : active.length;
  const count =
    settings.mode === 'one'
      ? 1
      : settings.mode === 'order'
        ? active.length
        : Math.min(Math.max(1, settings.count), maxCount);

  const start = () => {
    if (phase !== 'setup' || active.length === 0) return;
    const winners =
      settings.mode === 'order'
        ? drawOrder(participants, excludedIds)
        : drawWinners(
            participants,
            excludedIds,
            count,
            settings.mode === 'many' && settings.allowDuplicate,
          );
    setDrawn(winners);
    setPhase('drawing');
    setTimeout(() => {
      setPhase('reveal');
      setRevealed(settings.revealMode === 'batch' ? winners.length : 1);
      winSfx(soundEnabled);
    }, 900);
  };

  const revealNext = () => {
    setRevealed((n) => Math.min(n + 1, drawn.length));
    winSfx(soundEnabled);
  };

  const finish = () => {
    setLastResult({
      gameId: 'lot',
      winners: settings.mode === 'order' ? [] : drawn.map((p) => p.id),
      rankings:
        settings.mode === 'order'
          ? drawn.map((p, i) => ({ name: p.name, rank: i + 1 }))
          : undefined,
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'setup') start();
        else if (phase === 'reveal' && revealed < drawn.length) revealNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allRevealed = phase === 'reveal' && revealed >= drawn.length;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1.4fr_minmax(280px,0.9fr)] lg:items-start">
      {allRevealed && <ConfettiBurst count={40} />}

      <section className="panel flex min-h-[420px] flex-col items-center justify-center gap-6 p-6">
        {phase === 'setup' && (
          <>
            <div className="text-8xl">🎁</div>
            <p className="text-xl font-black text-ink-purple">
              {settings.mode === 'order'
                ? `${active.length}명의 순서를 뽑아요`
                : `쪽지 ${count}장을 뽑아요`}
            </p>
            <button type="button" className="btn-primary px-12 text-3xl" onClick={start}>
              뽑기!
            </button>
            <p className="text-sm text-muted">Space 키로도 시작할 수 있어요</p>
          </>
        )}

        {phase === 'drawing' && (
          <>
            <div className="shake text-8xl">🎁</div>
            <p className="text-2xl font-black text-ink-purple">두구두구...</p>
          </>
        )}

        {phase === 'reveal' && (
          <>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              {drawn.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className={`flex min-h-24 items-center justify-center rounded-2xl border-2 p-3 text-center ${
                    i < revealed
                      ? 'flip-in border-pick-lime-400 bg-surface-lime'
                      : 'border-ink-purple/10 bg-surface-lavender'
                  }`}
                >
                  {i < revealed ? (
                    <div>
                      {settings.mode === 'order' && (
                        <div className="pixel-title text-lg text-pick-purple-600">
                          {i + 1}번
                        </div>
                      )}
                      <div className="text-2xl font-black text-ink-purple">
                        {p.name}
                      </div>
                    </div>
                  ) : (
                    <span className="text-4xl">📜</span>
                  )}
                </div>
              ))}
            </div>

            {!allRevealed && (
              <div className="flex items-center gap-4">
                <button type="button" className="btn-primary" onClick={revealNext}>
                  다음 공개
                </button>
                <span className="text-base font-bold text-muted">
                  남은 쪽지 {drawn.length - revealed}장
                </span>
              </div>
            )}
            {allRevealed && (
              <button type="button" className="btn-primary px-10 text-2xl" onClick={finish}>
                결과 보기 →
              </button>
            )}
          </>
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-black text-ink-purple">📜 제비뽑기</h1>
          <Link to="/lobby" className="text-sm font-bold text-muted underline">
            ← 로비
          </Link>
        </div>

        <p className="mb-4 rounded-xl bg-surface-lavender px-3 py-2 text-sm font-bold text-ink-purple">
          상자 속 쪽지를 뽑아요. 뽑힌 쪽지의 친구가 당첨!
        </p>

        <div className="mb-3">
          <p className="mb-1 text-sm font-extrabold text-ink-purple">몇 명 뽑을까요?</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['one', '한 명'],
                ['many', '여러 명'],
                ['order', '순서 뽑기'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                className="option-chip"
                data-selected={settings.mode === m}
                disabled={phase !== 'setup'}
                onClick={() => updateLot({ mode: m })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {settings.mode === 'many' && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">인원</p>
            <input
              type="number"
              min={1}
              max={maxCount}
              value={settings.count}
              disabled={phase !== 'setup'}
              className="input-soft !w-28"
              onChange={(e) =>
                updateLot({ count: parseInt(e.target.value, 10) || 1 })
              }
            />
            <label className="mt-2 flex items-center gap-2 text-sm font-bold text-ink-purple">
              <input
                type="checkbox"
                checked={settings.allowDuplicate}
                disabled={phase !== 'setup'}
                className="size-4 accent-pick-purple-600"
                onChange={(e) => updateLot({ allowDuplicate: e.target.checked })}
              />
              같은 친구가 또 뽑혀도 돼요 (중복 허용)
            </label>
          </div>
        )}

        {count > 1 && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">공개 방법</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="option-chip"
                data-selected={settings.revealMode === 'sequential'}
                disabled={phase !== 'setup'}
                onClick={() => updateLot({ revealMode: 'sequential' })}
              >
                하나씩
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.revealMode === 'batch'}
                disabled={phase !== 'setup'}
                onClick={() => updateLot({ revealMode: 'batch' })}
              >
                한 번에
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 border-t border-ink-purple/10 pt-3 text-sm font-bold text-muted">
          참가 {active.length}명
        </p>

        {phase !== 'setup' && (
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            onClick={() => {
              setPhase('setup');
              setDrawn([]);
              setRevealed(0);
            }}
          >
            다시 하기
          </button>
        )}
      </section>
    </div>
  );
}
