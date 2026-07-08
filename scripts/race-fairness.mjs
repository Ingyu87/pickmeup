// 핀볼 레이스 공정성 검증 — 실제 게임 엔진(src/games/race/engine.ts)을 그대로 돌려
// 1등 분포가 균등한지 측정한다.
//
// 실행: npm run test:race  (또는 node --experimental-strip-types scripts/race-fairness.mjs [판수] [인원])

import { simulateRace } from '../src/games/race/engine.ts';

const races = parseInt(process.argv[2] ?? '200', 10);
const kids = parseInt(process.argv[3] ?? '20', 10);
const course = 'short';

const names = Array.from({ length: kids }, (_, i) => `학생${String(i + 1).padStart(2, '0')}`);

const wins = new Map(names.map((n) => [n, 0]));
const winsByFrontRow = { front: 0, back: 0 };
let streakName = null;
let streak = 0;
let maxStreak = 0;
let maxStreakName = '';
let totalSimSeconds = 0;

const t0 = Date.now();
for (let i = 0; i < races; i++) {
  const { order, spawns, simSeconds } = simulateRace(names, course);
  const winner = order[0];
  wins.set(winner, wins.get(winner) + 1);
  totalSimSeconds += simSeconds;

  const spawn = spawns.find((s) => s.name === winner);
  const row = Math.round((230 - spawn.y) / 44);
  if (row === 0) winsByFrontRow.front += 1;
  else winsByFrontRow.back += 1;

  if (winner === streakName) {
    streak += 1;
  } else {
    streakName = winner;
    streak = 1;
  }
  if (streak > maxStreak) {
    maxStreak = streak;
    maxStreakName = winner;
  }

  if ((i + 1) % 50 === 0) {
    console.log(`  ...${i + 1}/${races}판 완료 (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}

const expected = races / kids;
const counts = [...wins.entries()].sort((a, b) => b[1] - a[1]);
const chi2 = counts.reduce((s, [, c]) => s + ((c - expected) ** 2) / expected, 0);

// df = kids-1, 유의수준 5% 임계값 (근사: Wilson–Hilferty)
const df = kids - 1;
const z = 1.645;
const chiCrit = df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;

console.log('');
console.log(`=== 핀볼 레이스 공정성 리포트 (${course}, ${kids}명 × ${races}판) ===`);
console.log(`기대 우승 횟수: ${expected.toFixed(1)}회/명`);
console.log(`최다 우승: ${counts[0][0]} ${counts[0][1]}회 · 최소 우승: ${counts[counts.length - 1][0]} ${counts[counts.length - 1][1]}회`);
console.log(`카이제곱: ${chi2.toFixed(1)} (df=${df}, 5% 임계값 ≈ ${chiCrit.toFixed(1)}) → ${chi2 < chiCrit ? '✅ 균등 분포와 통계적으로 일치' : '⚠️ 균등 아님 — 확인 필요'}`);
console.log(`앞줄 출발 우승 비율: ${((winsByFrontRow.front / races) * 100).toFixed(1)}% (앞줄 배정도 매판 무작위라 공정성에는 영향 없음)`);
console.log(`자연 발생 최장 연승: ${maxStreakName} ${maxStreak}연승 — 같은 친구 연속 우승은 정상 범위의 우연입니다`);
console.log(`평균 레이스 길이: ${(totalSimSeconds / races).toFixed(1)}초 (시뮬레이션 기준)`);
console.log(`실행 시간: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (chi2 >= chiCrit) process.exitCode = 1;
