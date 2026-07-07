import type { Participant } from './types';

/** "이름*3" → { name: "이름", weight: 3 }. 같은 이름이 여러 줄이면 id에 #n을 붙여 구분한다. */
export function parseRoster(text: string): Participant[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const counts: Record<string, number> = {};
  return lines.map((line) => {
    const m = line.match(/^(.*?)\s*\*\s*(\d+)$/);
    const name = (m ? m[1] : line).trim();
    const weight = m ? Math.max(1, Math.min(99, parseInt(m[2], 10) || 1)) : 1;
    const n = (counts[name] = (counts[name] ?? 0) + 1);
    const id = n === 1 ? name : `${name}#${n}`;
    return { id, name, weight };
  });
}

export function displayName(participants: Participant[], id: string): string {
  return participants.find((p) => p.id === id)?.name ?? id.replace(/#\d+$/, '');
}
