import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../components/ConfettiBurst';
import RobotFigure from '../components/RobotFigure';
import { useAppStore } from '../stores/session';
import { displayName } from '../lib/parseRoster';
import { GAME_LABELS } from '../lib/types';
import { showToast } from '../lib/toast';

export default function ResultPage() {
  const navigate = useNavigate();
  const lastResult = useAppStore((s) => s.lastResult);
  const participants = useAppStore((s) => s.participants);
  const className = useAppStore((s) => s.className);
  const excludeIds = useAppStore((s) => s.excludeIds);
  const captureRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  if (!lastResult) return <Navigate to="/lobby" replace />;

  const winnerNames = lastResult.winners.map((id) => displayName(participants, id));
  const isOrder = !!lastResult.rankings && lastResult.winners.length === 0;
  const gameLabel = GAME_LABELS[lastResult.gameId];

  const copyText = () => {
    const lines = [
      `[픽미업!] ${className ? `${className} · ` : ''}${gameLabel} 결과`,
    ];
    if (winnerNames.length > 0) lines.push(`🎉 당첨: ${winnerNames.join(', ')}`);
    if (lastResult.rankings) {
      lines.push(...lastResult.rankings.map((r) => `${r.rank}. ${r.name}`));
    }
    lines.push(new Date(lastResult.drawnAt).toLocaleString('ko-KR'));
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
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <ConfettiBurst count={70} />

      <div ref={captureRef} className="panel p-6 text-center sm:p-10">
        <p className="text-sm font-extrabold text-muted">
          {className && `${className} · `}
          {gameLabel}
        </p>
        <h1 className="pixel-title pop-win my-3 text-6xl text-pick-purple-600 sm:text-7xl">
          {isOrder ? '순서 결과' : '당첨!'}
        </h1>

        {winnerNames.length > 0 && (
          <div
            className={`mx-auto mb-6 grid max-w-2xl gap-3 ${
              winnerNames.length === 1
                ? 'grid-cols-1'
                : winnerNames.length <= 4
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
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
                    winnerNames.length === 1 ? 'text-6xl sm:text-7xl' : 'text-3xl'
                  }`}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        )}

        {lastResult.rankings && (
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

        <RobotFigure scene="celebrate" className="mx-auto w-40 sm:w-52" />
      </div>

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
