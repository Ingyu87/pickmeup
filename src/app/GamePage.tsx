import { Link, useParams } from 'react-router-dom';
import LotGame from '../games/lot/LotGame';
import WheelGame from '../games/wheel/WheelGame';
import LadderGame from '../games/ladder/LadderGame';
import RaceGame from '../games/race/RaceGame';
import SlotGame from '../games/slot/SlotGame';
import RobotFigure from '../components/RobotFigure';
import { useAppStore } from '../stores/session';
import { activeParticipants } from '../lib/draw';
import { GAME_LABELS } from '../lib/types';
import type { GameId } from '../lib/types';

function EmptyRoster() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <RobotFigure scene="empty-state" className="w-56" />
      <p className="text-xl font-black text-ink-purple">
        아직 명단이 비어 있어요
      </p>
      <p className="text-sm text-muted">
        먼저 우리 반 친구들 이름을 입력해 주세요.
      </p>
      <Link to="/" className="btn-primary no-underline">
        명단 입력하러 가기
      </Link>
    </div>
  );
}

function ComingSoon({ gameId }: { gameId: GameId }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <RobotFigure scene="empty-state" className="w-56" />
      <p className="text-xl font-black text-ink-purple">
        {GAME_LABELS[gameId]}는 준비 중이에요
      </p>
      <p className="text-sm text-muted">곧 만나요!</p>
      <Link to="/lobby" className="btn-secondary no-underline">
        다른 게임 보러 가기
      </Link>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);

  const gameId = (['wheel', 'lot', 'ladder', 'race', 'slot'] as GameId[]).find(
    (g) => g === id,
  );
  if (!gameId) return <ComingSoon gameId="lot" />;

  if (activeParticipants(participants, excludedIds).length === 0) {
    return <EmptyRoster />;
  }

  if (gameId === 'lot') return <LotGame />;
  if (gameId === 'wheel') return <WheelGame />;
  if (gameId === 'ladder') return <LadderGame />;
  if (gameId === 'race') return <RaceGame />;
  if (gameId === 'slot') return <SlotGame />;
  return <ComingSoon gameId={gameId} />;
}
