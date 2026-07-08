import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../components/ConfettiBurst';
import RobotFigure from '../components/RobotFigure';
import { useAppStore } from '../stores/session';
import { displayName } from '../lib/parseRoster';
import { GAME_LABELS } from '../lib/types';
import { showToast } from '../lib/toast';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const lastResult = useAppStore((s) => s.lastResult);
  const participants = useAppStore((s) => s.participants);
  const className = useAppStore((s) => s.className);
  const excludeIds = useAppStore((s) => s.excludeIds);
  const captureRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showSeats, setShowSeats] = useState(false);
  const [groupSize, setGroupSize] = useState(4);
  const [seatCols, setSeatCols] = useState(6);

  const winnerNames = useMemo(
    () => (lastResult?.winners ?? []).map((id) => displayName(participants, id)),
    [lastResult, participants],
  );

  const quotaSelectedNames = useMemo(
    () => (lastResult?.quota?.selectedIds ?? []).map((id) => displayName(participants, id)),
    [lastResult, participants],
  );

  const quotaWaitlistNames = useMemo(
    () => (lastResult?.quota?.waitlistIds ?? []).map((id) => displayName(participants, id)),
    [lastResult, participants],
  );

  const layoutSource = useMemo(() => {
    if (!lastResult) return [];
    if (lastResult.rankings?.length) return lastResult.rankings.map((r) => r.name);
    return winnerNames;
  }, [lastResult, winnerNames]);

  const assignGroups = useMemo(() => {
    if (!lastResult?.assignments?.length) return [];
    const m = new Map<string, string[]>();
    for (const a of lastResult.assignments) {
      const list = m.get(a.label) ?? [];
      list.push(a.name);
      m.set(a.label, list);
    }
    return [...m.entries()];
  }, [lastResult]);

  if (!lastResult) return <Navigate to="/lobby" replace />;

  const isOrder = !!lastResult.rankings && lastResult.winners.length === 0;
  const isAssign = !!lastResult.assignments?.length;
  const isQuota = lastResult.resultKind === 'quota' && !!lastResult.quota;
  const gameLabel = GAME_LABELS[lastResult.gameId];
  const canLayout = !isQuota && layoutSource.length >= 4;

  const hasWeights = participants.some((p) => p.weight > 1);
  const fairnessLabel = isQuota
    ? '균등 무작위 (가중치 미적용)'
    : lastResult.gameId === 'race'
      ? '물리 시뮬레이션 (가중치 미적용)'
      : lastResult.gameId === 'ladder'
        ? '무작위 사다리 (가중치 미적용)'
        : hasWeights
          ? '가중치 반영 무작위'
          : '균등 무작위';

  const copyText = () => {
    const lines = [
      `[픽미업!] ${className ? `${className} · ` : ''}${isQuota ? '정원 추첨' : gameLabel} 결과`,
    ];
    if (isQuota && lastResult.quota) {
      lines.push(
        `신청 ${lastResult.quota.total}명 · 정원 ${lastResult.quota.capacity}명 · 대기 ${lastResult.quota.waitlistIds.length}명`,
      );
      lines.push('선발자');
      quotaSelectedNames.forEach((name, i) => lines.push(`${i + 1}. ${name}`));
      if (quotaWaitlistNames.length > 0) {
        lines.push('대기자');
        quotaWaitlistNames.forEach((name, i) => lines.push(`대기 ${i + 1}번. ${name}`));
      }
      lines.push('전체 신청자 명단을 무작위 순번으로 섞어 상위 정원 수만 선발했습니다.');
    } else if (winnerNames.length > 0) {
      lines.push(`🎉 당첨: ${winnerNames.join(', ')}`);
    }
    if (!isQuota && lastResult.rankings) {
      lines.push(...lastResult.rankings.map((r) => `${r.rank}. ${r.name}`));
    }
    if (lastResult.assignments) {
      lines.push(...lastResult.assignments.map((a) => `${a.name} → ${a.label}`));
    }
    if (showGroups && canLayout) {
      chunk(layoutSource, groupSize).forEach((g, i) =>
        lines.push(`${i + 1}조: ${g.join(', ')}`),
      );
    }
    lines.push(
      `🔒 공정 추첨 · ${fairnessLabel} · ${new Date(lastResult.drawnAt).toLocaleString('ko-KR')}`,
    );
    void navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => showToast('결과를 복사했어요'))
      .catch(() => showToast('복사할 수 없어요'));
  };

  const saveImage = async () => {
    if (!captureRef.current || saving) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#F3EDFF',
        scale: 2,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `픽미업-결과-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      showToast('이미지로 저장했어요');
    } catch {
      showToast('이미지를 저장할 수 없어요');
    } finally {
      setSaving(false);
    }
  };

  const redraw = () => {
    excludeIds(lastResult.winners);
    navigate(`/game/${lastResult.gameId}`);
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-6">
      <ConfettiBurst count={70} />

      <div ref={captureRef} className="flex flex-col gap-4">
        <div className="panel p-4 text-center sm:p-10">
          <p className="text-sm font-extrabold text-muted">
            {className && `${className} · `}
            {isQuota ? '정원 추첨' : gameLabel}
          </p>
          <h1 className="pixel-title pop-win my-3 text-4xl text-pick-purple-600 sm:text-7xl">
            {isQuota ? '선발 결과' : isOrder ? '순서 결과' : isAssign ? '배정 완료!' : '당첨!'}
          </h1>

          {isQuota && lastResult.quota && (
            <div className="mx-auto mb-6 max-w-2xl rounded-2xl bg-surface-lavender px-4 py-3 text-center">
              <p className="text-lg font-black text-ink-purple">
                신청 {lastResult.quota.total}명 · 정원 {lastResult.quota.capacity}명 · 대기{' '}
                {lastResult.quota.waitlistIds.length}명
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                전체 신청자 순번을 무작위로 섞어 상위 정원 수만 선발했습니다.
              </p>
            </div>
          )}

          {isQuota ? (
            <div className="mx-auto mb-6 grid max-w-3xl gap-4 text-left lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-3xl border-4 border-pick-lime-400 bg-surface-lime p-4">
                <p className="mb-3 text-xl font-black text-pick-purple-600">선발자</p>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {quotaSelectedNames.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      className="rounded-xl bg-white/75 px-3 py-2 text-lg font-black text-ink-purple"
                    >
                      {i + 1}. {name}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-3xl border-2 border-pick-purple-600/20 bg-surface-lavender p-4">
                <p className="mb-3 text-xl font-black text-pick-purple-600">대기 순번</p>
                {quotaWaitlistNames.length > 0 ? (
                  <ol className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                    {quotaWaitlistNames.map((name, i) => (
                      <li
                        key={`${name}-${i}`}
                        className="rounded-xl bg-white px-3 py-2 text-base font-extrabold text-ink-purple"
                      >
                        대기 {i + 1}번. {name}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm font-bold text-muted">대기자가 없어요.</p>
                )}
              </section>
            </div>
          ) : winnerNames.length > 0 && (
            <div
              className={`mx-auto mb-6 grid max-w-2xl gap-3 ${
                winnerNames.length === 1
                  ? 'grid-cols-1'
                  : winnerNames.length <= 4
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {winnerNames.map((name, i) => (
                <div
                  key={i}
                  className="flip-in rounded-3xl border-4 border-pick-lime-400 bg-surface-lime px-4 py-6"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span
                    className={`font-black text-ink-purple ${
                      winnerNames.length === 1 ? 'text-4xl sm:text-7xl' : 'text-2xl sm:text-3xl'
                    }`}
                  >
                    {name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!isQuota && lastResult.rankings && (
            <ol className="mx-auto mb-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
              {lastResult.rankings.map((r) => (
                <li
                  key={r.rank}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left font-bold ${
                    r.rank === 1
                      ? 'bg-gradient-to-b from-[#FFF6A8] to-pick-yellow-400 text-ink'
                      : 'bg-surface-lavender text-ink-purple'
                  }`}
                >
                  <span className="pixel-title text-lg">{r.rank}</span>
                  <span className="text-lg">{r.name}</span>
                </li>
              ))}
            </ol>
          )}

          {assignGroups.length > 0 && (
            <div className="mx-auto mb-6 grid max-w-2xl gap-3 sm:grid-cols-2">
              {assignGroups.map(([label, names]) => (
                <div
                  key={label}
                  className="rounded-2xl border-2 border-pick-purple-600/20 bg-surface-lavender p-4 text-left"
                >
                  <p className="mb-2 text-lg font-black text-pick-purple-600">{label}</p>
                  <p className="text-xl font-extrabold leading-relaxed text-ink-purple">
                    {names.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}

          <RobotFigure scene="celebrate" className="mx-auto w-40 sm:w-52" />

          <p className="mt-4 border-t border-ink-purple/10 pt-3 text-xs font-bold text-muted">
            🔒 공정 추첨 · {fairnessLabel} ·{' '}
            {new Date(lastResult.drawnAt).toLocaleString('ko-KR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}{' '}
            · 픽미업!
          </p>
        </div>

        {showGroups && canLayout && (
          <div className="panel p-4 sm:p-6">
            <p className="mb-3 text-xl font-black text-ink-purple">
              👥 조 배치 <span className="text-sm font-bold text-muted">(순서대로 {groupSize}명씩)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chunk(layoutSource, groupSize).map((g, i) => (
                <div key={i} className="rounded-2xl bg-surface-lavender p-4">
                  <p className="pixel-title mb-2 text-lg text-pick-purple-600">{i + 1}조</p>
                  <p className="text-lg font-extrabold leading-relaxed text-ink-purple">
                    {g.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showSeats && canLayout && (
          <div className="panel overflow-x-auto p-4 sm:p-6">
            <p className="mb-3 text-xl font-black text-ink-purple">
              🪑 자리 배치 <span className="text-sm font-bold text-muted">(한 줄 {seatCols}자리)</span>
            </p>
            <div className="mb-3 rounded-xl bg-pick-purple-950 py-2 text-center text-sm font-black text-white">
              교탁
            </div>
            <div
              className="grid min-w-max gap-2"
              style={{ gridTemplateColumns: `repeat(${seatCols}, minmax(4.5rem, 1fr))` }}
            >
              {layoutSource.map((name, i) => (
                <div
                  key={i}
                  className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-surface-lime p-1 text-center"
                >
                  <span className="text-[10px] font-bold text-muted">{i + 1}</span>
                  <span className="text-sm font-black text-ink-purple">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {canLayout && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="option-chip"
            data-selected={showGroups}
            onClick={() => setShowGroups((v) => !v)}
          >
            👥 조 배치
          </button>
          {showGroups && (
            <input
              type="number"
              min={2}
              max={10}
              value={groupSize}
              className="input-soft !w-20 !py-2 !text-sm"
              onChange={(e) => setGroupSize(Math.max(2, parseInt(e.target.value, 10) || 4))}
              title="조당 인원"
            />
          )}
          <button
            type="button"
            className="option-chip"
            data-selected={showSeats}
            onClick={() => setShowSeats((v) => !v)}
          >
            🪑 자리 배치
          </button>
          {showSeats && (
            <input
              type="number"
              min={2}
              max={10}
              value={seatCols}
              className="input-soft !w-20 !py-2 !text-sm"
              onChange={(e) => setSeatCols(Math.max(2, parseInt(e.target.value, 10) || 6))}
              title="한 줄 자리 수"
            />
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {lastResult.winners.length > 0 && (
          <button type="button" className="btn-primary" onClick={redraw}>
            당첨자 빼고 다시
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/lobby')}
        >
          다른 게임
        </button>
        <button type="button" className="btn-secondary" onClick={copyText}>
          📋 결과 복사
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void saveImage()}
          disabled={saving}
        >
          {saving ? '저장 중…' : '🖼️ 이미지 저장'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/')}
        >
          처음으로
        </button>
      </div>
    </div>
  );
}
