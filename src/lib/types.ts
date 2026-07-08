export interface Participant {
  id: string;
  name: string;
  weight: number;
}

export type GameId = 'wheel' | 'lot' | 'ladder' | 'race' | 'slot';

export interface DrawResult {
  gameId: GameId;
  winners: string[];
  rankings?: { name: string; rank: number }[];
  assignments?: { name: string; label: string }[];
  resultKind?: 'winners' | 'order' | 'assignment' | 'quota';
  quota?: {
    capacity: number;
    total: number;
    selectedIds: string[];
    waitlistIds: string[];
    method: 'uniform-random-order';
  };
  drawnAt: number;
}

export interface GameSettings {
  wheel: {
    winnerCount: number;
    sequential: boolean;
    wheelMode?: 'names' | 'missions';
    missions?: string[];
  };
  lot: {
    mode: 'one' | 'many' | 'order' | 'quota';
    count: number;
    allowDuplicate: boolean;
    revealMode: 'sequential' | 'batch';
    theme: string;
  };
  ladder: { labels: string[]; revealMode: 'one' | 'all' };
  race: { winMode: 'first' | 'last'; winnerCount: number; mapId: string; speed: 'normal' | 'fast' };
  slot: { mode: 'slot' | 'gacha'; theme: string };
}

export interface PersistedAppState {
  version: 1;
  savedAt: number;
  session: {
    className: string;
    rosterText: string;
    participants: Participant[];
    excludedIds: string[];
  };
  navigation: { path: string };
  preferences: { soundEnabled: boolean; bgmEnabled: boolean };
  gameSettings: GameSettings;
  lastResult: DrawResult | null;
  winStreak?: { name: string; count: number } | null;
}

export function defaultGameSettings(): GameSettings {
  return {
    wheel: { winnerCount: 1, sequential: false, wheelMode: 'names', missions: [] },
    lot: { mode: 'one', count: 12, allowDuplicate: false, revealMode: 'sequential', theme: 'paper' },
    ladder: { labels: [], revealMode: 'one' },
    race: { winMode: 'first', winnerCount: 1, mapId: 'short', speed: 'normal' },
    slot: { mode: 'gacha', theme: 'basic' },
  };
}

export const GAME_LABELS: Record<GameId, string> = {
  lot: '제비뽑기',
  wheel: '돌림판',
  ladder: '사다리타기',
  race: '레이스',
  slot: '캡슐 뽑기',
};
