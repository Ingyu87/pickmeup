import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/session';
import { activeParticipants } from '../lib/draw';
import type { GameId } from '../lib/types';

const FILTERS = ['전체', '1명', '여러 명', '순서', '역할', '재미'] as const;
type Filter = (typeof FILTERS)[number];

interface GameCardDef {
  id: GameId;
  name: string;
  emoji: string;
  desc: string;
  tags: Exclude<Filter, '전체'>[];
  ready: boolean;
}

const GAMES: GameCardDef[] = [
  {
    id: 'lot',
    name: '제비뽑기',
    emoji: '📜',
    desc: '빠르게 한 명, 여러 명, 발표 순서까지 뽑아요.',
    tags: ['1명', '여러 명', '순서'],
    ready: true,
  },
  {
    id: 'wheel',
    name: '돌림판',
    emoji: '🎡',
    desc: '두근두근! 돌림판이 멈춘 친구가 당첨이에요.',
    tags: ['1명', '여러 명', '재미'],
    ready: true,
  },
  {
    id: 'ladder',
    name: '사다리타기',
    emoji: '🪜',
    desc: '역할과 모둠을 공정하게 나눠요.',
    tags: ['역할'],
    ready: false,
  },
  {
    id: 'race',
    name: '레이스',
    emoji: '🏁',
    desc: '캐릭터 달리기로 1등과 순위를 정해요.',
    tags: ['순서', '재미'],
    ready: false,
  },
  {
    id: 'slot',
    name: '캡슐 뽑기',
    emoji: '🎁',
    desc: '캡슐이 데구르르! 오늘의 주인공은 누구?',
    tags: ['1명', '재미'],
    ready: false,
  },
];

export default function LobbyPage() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const [filter, setFilter] = useState<Filter>('전체');

  const active = activeParticipants(participants, excludedIds);
  const visible =
    filter === '전체' ? GAMES : GAMES.filter((g) => g.tags.includes(filter));

  return (
    <div className="min-h-full bg-gradient-to-b from-pick-purple-800 to-pick-purple-950 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="pixel-title text-3xl text-pick-lime-400 sm:text-4xl">
            오늘은 어떤 뽑기를 할까요?
          </h1>
          <Link
            to="/"
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-extrabold text-white no-underline hover:bg-white/25"
          >
            참가 {active.length}명 · 명단 고치기
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="option-chip"
              data-selected={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((g) => (
            <div
              key={g.id}
              className={`panel flex flex-col gap-2 p-5 ${
                g.ready
                  ? 'cursor-pointer transition-transform hover:-translate-y-1'
                  : 'opacity-60'
              }`}
              onClick={() => g.ready && navigate(`/game/${g.id}`)}
              role={g.ready ? 'button' : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-4xl">{g.emoji}</span>
                {!g.ready && (
                  <span className="rounded-full bg-surface-lavender px-3 py-1 text-xs font-black text-ink-purple">
                    곧 만나요
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-ink-purple">{g.name}</h2>
              <p className="text-sm leading-relaxed text-muted">{g.desc}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-lavender px-2.5 py-0.5 text-xs font-bold text-ink-purple"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {g.ready && (
                <button
                  type="button"
                  className="btn-primary mt-2 !min-h-12 !text-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/game/${g.id}`);
                  }}
                >
                  시작하기
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
