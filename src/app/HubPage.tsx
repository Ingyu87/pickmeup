import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RobotFigure from '../components/RobotFigure';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAppStore, buildExportState } from '../stores/session';
import { activeParticipants } from '../lib/draw';
import { exportStateFile, parseImportedState } from '../lib/storage';
import { showToast } from '../lib/toast';

function relTime(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HubPage() {
  const navigate = useNavigate();
  const {
    className,
    rosterText,
    participants,
    excludedIds,
    saveStatus,
    lastSavedAt,
    setClassName,
    setRosterText,
    toggleExcluded,
    clearRoster,
    resetAll,
    importState,
  } = useAppStore();

  const [confirm, setConfirm] = useState<'roster' | 'all' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = activeParticipants(participants, excludedIds);
  const weighted = participants.filter((p) => p.weight > 1);

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const state = parseImportedState(text);
    if (!state) {
      showToast('가져올 수 없는 파일이에요');
      return;
    }
    importState(state);
    showToast('명단과 설정을 가져왔어요');
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(300px,0.9fr)_minmax(380px,1.1fr)] lg:items-start">
      <section className="panel flex flex-col items-center gap-4 p-6 text-center lg:sticky lg:top-6">
        <RobotFigure scene="guide" className="w-full max-w-sm" />
        <div className="rounded-2xl bg-surface-lavender px-5 py-3">
          <p className="text-lg font-extrabold text-ink-purple">
            명단을 붙여넣으면 바로 뽑을 수 있어요!
          </p>
          <p className="mt-1 text-sm text-muted">
            한 줄에 한 명씩, <b>이름*3</b>처럼 쓰면 3배 확률이 돼요.
          </p>
        </div>
        <p
          className={`text-sm font-bold ${
            saveStatus === 'error'
              ? 'text-danger'
              : saveStatus === 'unavailable'
                ? 'text-muted'
                : 'text-ink-purple/70'
          }`}
          role="status"
        >
          {saveStatus === 'saved' && `✅ 자동 저장됨 · ${relTime(lastSavedAt)}`}
          {saveStatus === 'idle' && '입력하면 자동으로 저장돼요'}
          {saveStatus === 'error' &&
            '⚠️ 저장할 수 없어요 — JSON 내보내기로 백업해 주세요'}
          {saveStatus === 'unavailable' && '자동 저장 제한됨'}
        </p>
      </section>

      <section className="panel p-6">
        <h1 className="mb-4 text-2xl font-black text-ink-purple">반 설정</h1>

        <label className="mb-1 block text-base font-extrabold text-ink-purple">
          우리 반 이름
        </label>
        <input
          className="input-soft mb-4"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="예) 3학년 2반"
          maxLength={30}
        />

        <label className="mb-1 block text-base font-extrabold text-ink-purple">
          학생 명단 <span className="text-sm font-bold text-muted">(한 줄에 한 명)</span>
        </label>
        <textarea
          className="input-soft mb-2 min-h-52 resize-y font-medium leading-relaxed"
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          placeholder={'김하늘\n이준호\n박서연*2'}
          spellCheck={false}
        />

        {participants.length > 0 && (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-bold text-muted">
                모두 {participants.length}명 · 참가 {active.length}명
              </p>
              <button
                type="button"
                className="text-sm font-bold text-danger underline"
                onClick={() => setConfirm('roster')}
              >
                전체 지우기
              </button>
            </div>
            <div className="mb-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {participants.map((p) => {
                const excluded = excludedIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="option-chip !py-2 text-sm"
                    data-selected={!excluded}
                    title={excluded ? '이번 추첨에서 제외돼요' : '참가 중'}
                  >
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => toggleExcluded(p.id)}
                      className="size-4 accent-pick-purple-600"
                    />
                    <span className={excluded ? 'line-through opacity-50' : ''}>
                      {p.name}
                    </span>
                    {p.weight > 1 && (
                      <span className="rounded-full bg-pick-purple-600 px-1.5 text-xs font-black text-white">
                        ×{p.weight}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {weighted.length > 0 && (
              <p className="mb-3 rounded-xl bg-surface-lime px-3 py-2 text-sm font-bold text-ink-purple">
                ⚖️ 가중치:{' '}
                {weighted.map((p) => `${p.name}님은 ${p.weight}배 확률`).join(', ')}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          className="btn-primary w-full text-2xl"
          disabled={active.length === 0}
          onClick={() => navigate('/lobby')}
        >
          게임 고르기 →
        </button>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-purple/10 pt-4">
          <button
            type="button"
            className="btn-secondary !min-h-10 !text-sm"
            onClick={() => {
              exportStateFile(buildExportState());
              showToast('JSON 파일로 내보냈어요');
            }}
          >
            📤 JSON 내보내기
          </button>
          <button
            type="button"
            className="btn-secondary !min-h-10 !text-sm"
            onClick={() => fileRef.current?.click()}
          >
            📥 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn-danger !min-h-10 ml-auto !text-sm"
            onClick={() => setConfirm('all')}
          >
            저장된 데이터 지우기
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirm === 'roster'}
        title="명단을 지울까요?"
        message="입력한 학생 명단만 지워요. 반 이름과 설정은 남아요."
        confirmLabel="명단 지우기"
        onConfirm={() => {
          clearRoster();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'all'}
        title="저장된 데이터를 모두 지울까요?"
        message="반 이름, 명단, 게임 설정, 결과가 모두 지워지고 되돌릴 수 없어요. 필요하면 먼저 JSON으로 내보내 주세요."
        confirmLabel="전부 지우기"
        onConfirm={() => {
          resetAll();
          setConfirm(null);
          showToast('저장된 데이터를 모두 지웠어요');
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
