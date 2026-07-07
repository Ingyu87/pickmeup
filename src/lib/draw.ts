import type { Participant } from './types';

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function activeParticipants(
  participants: Participant[],
  excludedIds: string[],
): Participant[] {
  const ex = new Set(excludedIds);
  return participants.filter((p) => !ex.has(p.id));
}

/** weight만큼 duplicate된 추첨 pool (PRD §7.1) */
export function buildPool(
  participants: Participant[],
  excludedIds: string[],
): Participant[] {
  return activeParticipants(participants, excludedIds).flatMap((p) =>
    Array.from({ length: Math.max(1, p.weight) }, () => p),
  );
}

export function pickWeighted(participants: Participant[]): Participant | null {
  const pool = participants.flatMap((p) =>
    Array.from({ length: Math.max(1, p.weight) }, () => p),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function drawWinners(
  participants: Participant[],
  excludedIds: string[],
  count: number,
  allowDuplicate: boolean,
): Participant[] {
  const pool = buildPool(participants, excludedIds);
  if (pool.length === 0) return [];

  if (allowDuplicate) {
    return Array.from(
      { length: count },
      () => pool[Math.floor(Math.random() * pool.length)],
    );
  }

  const seen = new Set<string>();
  const out: Participant[] = [];
  for (const p of shuffle(pool)) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= count) break;
  }
  return out;
}

/** 전원 순서 뽑기 (중복 없음, 가중치 반영 순서) */
export function drawOrder(
  participants: Participant[],
  excludedIds: string[],
): Participant[] {
  return drawWinners(participants, excludedIds, Number.MAX_SAFE_INTEGER, false);
}
