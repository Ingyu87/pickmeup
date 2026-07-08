import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import LazyLottie from '../../components/lottie/LazyLottie';
import { useAppStore } from '../../stores/session';
import { activeParticipants, drawOrder, drawUniformOrder, drawWinners } from '../../lib/draw';
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
  const [fx, setFx] = useState<{ name: string; seq: number } | null>(null);
  const fxSeqRef = useRef(0);
  const fxTimerRef = useRef<number | undefined>(undefined);

  const active = activeParticipants(participants, excludedIds);
  const quotaCapacity = Math.min(Math.max(1, settings.count), active.length);
  const maxCount = settings.mode === 'quota' ? active.length : settings.allowDuplicate ? 99 : active.length;
  const count =
    settings.mode === 'one'
      ? 1
      : settings.mode === 'order'
        ? active.length
        : settings.mode === 'quota'
          ? active.length
          : Math.min(Math.max(1, settings.count), maxCount);
  const hasWeights = active.some((p) => p.weight > 1);

  const start = () => {
    if (phase !== 'setup' || active.length === 0) return;
    const winners =
      settings.mode === 'order'
        ? drawOrder(participants, excludedIds)
        : settings.mode === 'quota'
          ? drawUniformOrder(participants, excludedIds)
        : drawWinners(
            participants,
            excludedIds,
            count,
            settings.mode === 'many' && settings.allowDuplicate,
          );
    setDrawn(winners);
    setPhase('drawing');
    const batchReveal =
      settings.revealMode === 'batch' || settings.mode === 'quota';
    setTimeout(() => {
      setPhase('reveal');
      setRevealed(batchReveal ? winners.length : 1);
      if (!batchReveal && winners[0]) showPaperFx(winners[0].name);
      winSfx(soundEnabled);
    }, 900);
  };

  const showPaperFx = (name: string) => {
    fxSeqRef.current += 1;
    setFx({ name, seq: fxSeqRef.current });
    window.clearTimeout(fxTimerRef.current);
    fxTimerRef.current = window.setTimeout(() => setFx(null), 1250);
  };

  const revealNext = () => {
    const next = drawn[revealed];
    if (next) showPaperFx(next.name);
    setRevealed((n) => Math.min(n + 1, drawn.length));
    winSfx(soundEnabled);
  };

  const finish = () => {
    const isQuota = settings.mode === 'quota';
    const selected = isQuota ? drawn.slice(0, quotaCapacity) : [];
    const waitlist = isQuota ? drawn.slice(quotaCapacity) : [];
    setLastResult({
      gameId: 'lot',
      winners:
        settings.mode === 'order'
          ? []
          : isQuota
            ? selected.map((p) => p.id)
            : drawn.map((p) => p.id),
      rankings:
        settings.mode === 'order' || isQuota
          ? drawn.map((p, i) => ({ name: p.name, rank: i + 1 }))
          : undefined,
      resultKind: isQuota ? 'quota' : settings.mode === 'order' ? 'order' : 'winners',
      quota: isQuota
        ? {
            capacity: quotaCapacity,
            total: drawn.length,
            selectedIds: selected.map((p) => p.id),
            waitlistIds: waitlist.map((p) => p.id),
            method: 'uniform-random-order',
          }
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
    <div className="game-shell max-w-6xl lg:grid-cols-[1.4fr_minmax(280px,0.9fr)] lg:items-start">
      {allRevealed && <ConfettiBurst count={40} />}

      <section className="panel game-stage relative flex flex-col items-center justify-center gap-4 overflow-hidden p-4 sm:gap-6 sm:p-6">
        {phase === 'reveal' && fx && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="relative">
              <LazyLottie
                key={fx.seq}
                src="/lottie/lot/reveal-paper/lottie.json"
                className="w-72"
              />
              <span
                className="pop-win absolute inset-0 flex items-center justify-center text-3xl font-black text-ink-purple"
                style={{ animationDelay: '0.35s' }}
              >
                {fx.name}
              </span>
            </div>
          </div>
        )}
        {phase === 'setup' && (
          <>
            <div className="text-6xl sm:text-8xl">🎁</div>
            <p className="text-xl font-black text-ink-purple">
              {settings.mode === 'order'
                ? `${active.length}명의 순서를 뽑아요`
                : settings.mode === 'quota'
                  ? `${active.length}명 중 ${quotaCapacity}명을 선발해요`
                : `쪽지 ${count}장을 뽑아요`}
            </p>
            <button type="button" className="btn-primary px-8 text-2xl sm:px-12 sm:text-3xl" onClick={start}>
              뽑기!
            </button>
            <p className="text-sm text-muted">Space 키로도 시작할 수 있어요</p>
          </>
        )}

        {phase === 'drawing' && (
          <>
            <div className="shake text-6xl sm:text-8xl">🎁</div>
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
                      {settings.mode === 'quota' && (
                        <div
                          className={`pixel-title text-lg ${
                            i < quotaCapacity ? 'text-pick-purple-600' : 'text-muted'
                          }`}
                        >
                          {i < quotaCapacity ? '선발' : `대기 ${i - quotaCapacity + 1}번`}
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
              <button type="button" className="btn-primary px-8 text-xl sm:px-10 sm:text-2xl" onClick={finish}>
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
                ['quota', '정원 추첨'],
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

        {(settings.mode === 'many' || settings.mode === 'quota') && (
          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">
              {settings.mode === 'quota' ? '모집 정원' : '인원'}
            </p>
            <input
              type="number"
              min={1}
              max={settings.mode === 'quota' ? active.length : maxCount}
              value={settings.count}
              disabled={phase !== 'setup'}
              className="input-soft !w-28"
              onChange={(e) =>
                updateLot({ count: parseInt(e.target.value, 10) || 1 })
              }
            />
            {settings.mode === 'quota' ? (
              <p className="mt-2 rounded-xl bg-surface-lavender px-3 py-2 text-sm font-bold text-ink-purple">
                전체 신청자 순번을 무작위로 만든 뒤 상위 {quotaCapacity}명을 선발하고,
                나머지는 대기 순번으로 표시해요.
              </p>
            ) : (
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
            )}
          </div>
        )}

        {count > 1 && settings.mode !== 'quota' && (
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
        {settings.mode === 'quota' && hasWeights && (
          <p className="mt-2 rounded-xl bg-surface-lime px-3 py-2 text-xs font-bold text-ink-purple">
            ⚖️ 정원 추첨은 공정성을 위해 이름*3 가중치를 적용하지 않아요.
          </p>
        )}

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
