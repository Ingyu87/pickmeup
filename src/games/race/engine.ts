/**
 * 핀볼 레이스 물리 엔진 — React/Canvas 없이 실행 가능한 순수 로직.
 * RaceGame.tsx(렌더링·연출)와 scripts/race-fairness.mjs(공정성 시뮬레이션)가 공유한다.
 * 런타임 value import 없음 (Node --experimental-strip-types로 직접 실행 가능).
 */

export const WORLD_W = 900;
export const LEFT_WALL = 45;
export const RIGHT_WALL = WORLD_W - 45;
export const RUNNER_R = 17;
export const GRAVITY = 1260;
export const MAX_SPEED = 1850;
export const RESTITUTION = 0.48;

export const RUNNERS = [
  '🤖', '📚', '✏️', '💡', '⭐', '🎒', '🧩', '🎯', '📝', '🔔',
  '🚀', '🌈', '🏆', '🎨', '🖍️', '📐', '🧪', '🔎', '🎲', '📌',
  '🟣', '🟢', '🟡', '🩷', '💜', '✅', '✨', '🌟', '📘', '📗',
];

export const COLORS = [
  '#8B5CF6', '#A3E635', '#F9A8D4', '#FACC15', '#38BDF8',
  '#FB7185', '#34D399', '#C084FC', '#F97316', '#60A5FA',
];

export const COURSES = {
  short: {
    label: '클래식 콩콩맵',
    shortLabel: '클래식',
    height: 11200,
    bgTop: '#9fdcaa',
    bgBottom: '#e8f8d8',
    deco: ['🌲', '🌳', '🍄', '🌼', '📚'],
    sections: [
      'pegs',
      'bumpers',
      'gates',
      'movers',
      'zigzag',
      'zones',
      'bricks',
      'pegs',
      'sweeps',
      'portals',
      'ramps',
      'bumpers',
      'verticals',
      'tramps',
      'bricks',
      'pegs',
      'movers',
      'gates',
      'zigzag',
      'spinners',
      'pads',
      'zones',
      'bricks',
      'verticals',
      'sweeps',
      'portals',
      'pegs',
      'bumpers',
      'ramps',
    ],
  },
  normal: {
    label: '바람개비 지그재그',
    shortLabel: '지그재그',
    height: 15600,
    bgTop: '#c3b3f2',
    bgBottom: '#f2ebff',
    deco: ['🌀', '🌷', '🦋', '⭐', '✏️'],
    sections: [
      'spinners',
      'pegs',
      'gates',
      'movers',
      'ramps',
      'portals',
      'bricks',
      'bumpers',
      'zones',
      'verticals',
      'spinners',
      'zigzag',
      'tramps',
      'pegs',
      'sweeps',
      'pads',
      'gates',
      'bricks',
      'holes',
      'portals',
      'movers',
      'ramps',
      'spinners',
      'zones',
      'pegs',
      'bumpers',
      'pads',
      'tramps',
      'zigzag',
      'verticals',
      'bricks',
      'sweeps',
      'holes',
      'gates',
      'movers',
      'pegs',
      'pads',
    ],
  },
  long: {
    label: '혼돈의 롱코스',
    shortLabel: '롱코스',
    height: 22400,
    bgTop: '#0d0d33',
    bgBottom: '#31315e',
    deco: ['⭐', '🪐', '🛸', '✨', '🌙'],
    sections: [
      'pegs',
      'holes',
      'gates',
      'spinners',
      'pads',
      'portals',
      'zigzag',
      'bumpers',
      'zones',
      'movers',
      'bricks',
      'tramps',
      'ramps',
      'sweeps',
      'spinners',
      'holes',
      'gates',
      'pegs',
      'pads',
      'portals',
      'verticals',
      'bricks',
      'zones',
      'movers',
      'zigzag',
      'holes',
      'tramps',
      'spinners',
      'ramps',
      'bumpers',
      'gates',
      'bricks',
      'sweeps',
      'portals',
      'pegs',
      'pads',
      'zones',
      'verticals',
      'holes',
      'bricks',
      'movers',
      'spinners',
      'tramps',
      'zigzag',
      'sweeps',
      'ramps',
      'bumpers',
      'pegs',
      'pads',
    ],
  },
} as const;

export type CourseId = keyof typeof COURSES;

export interface Wall {
  type: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}

export interface Peg {
  type: 'peg' | 'bumper' | 'hole' | 'pad';
  x: number;
  y: number;
  r: number;
}

export interface Mover {
  type: 'mover';
  x: number;
  y: number;
  r: number;
  minX: number;
  maxX: number;
  vx: number;
}

export interface VerticalMover {
  type: 'vertical';
  x: number;
  y: number;
  r: number;
  minY: number;
  maxY: number;
  vy: number;
}

export interface Sweep {
  type: 'sweep';
  x: number;
  y: number;
  w: number;
  h: number;
  minX: number;
  maxX: number;
  vx: number;
  color: string;
}

export interface Brick {
  type: 'brick';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  dead: boolean;
  color: string;
}

export interface Spinner {
  type: 'spinner';
  x: number;
  y: number;
  len: number;
  angle: number;
  omega: number;
  arms: 2 | 3;
  t: number;
}

export interface Portal {
  type: 'portal';
  x: number;
  y: number;
  r: number;
}

export interface BoostZone {
  type: 'boost';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MudZone {
  type: 'mud';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Gate {
  type: 'gate';
  y: number;
  gaps: number[];
  gapW: number;
  period: number;
  phase: number;
  t: number;
  clock: number;
}

export interface Tramp {
  type: 'tramp';
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Obstacle =
  | Wall
  | Peg
  | Mover
  | VerticalMover
  | Sweep
  | Brick
  | Spinner
  | Portal
  | BoostZone
  | MudZone
  | Gate
  | Tramp;

export interface RunnerState {
  id: string;
  name: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  spin: number;
  finished: boolean;
  finishTime: number;
  swallowed: number;
  lastY: number;
  stallMs: number;
  sideStuckMs: number;
  portalCoolMs: number;
}

export interface CourseMap {
  height: number;
  finishY: number;
  obstacles: Obstacle[];
  decorations: { x: number; y: number; emoji: string; size: number }[];
}

export type RaceEvent =
  | { kind: 'burst'; x: number; y: number; color: string; count: number }
  | { kind: 'portal'; runner: RunnerState }
  | { kind: 'tramp'; runner: RunnerState; launch: number }
  | { kind: 'finish'; runner: RunnerState };

export interface StepCtx {
  courseMap: CourseMap;
  gateOpen: boolean;
  emit?: (e: RaceEvent) => void;
  obstaclesFor?: (runner: RunnerState) => Obstacle[];
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function gateIsOpen(gate: Gate) {
  return ((gate.clock + gate.phase) % gate.period) < gate.period * 0.55;
}

function shuffleArr<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function obstacleMaxY(o: Obstacle) {
  if (o.type === 'wall') return Math.max(o.y1, o.y2) + o.t / 2;
  if (o.type === 'spinner') return o.y + o.len / 2 + o.t / 2;
  if (o.type === 'brick' || o.type === 'sweep' || o.type === 'tramp') return o.y + o.h / 2;
  if (o.type === 'boost' || o.type === 'mud') return o.y + o.h / 2;
  if (o.type === 'gate') return o.y + o.t;
  if (o.type === 'vertical') return o.maxY + o.r;
  if (o.type === 'pad') return o.y + 70;
  return o.y + o.r;
}

export function obstacleMinY(o: Obstacle) {
  if (o.type === 'wall') return Math.min(o.y1, o.y2) - o.t / 2;
  if (o.type === 'spinner') return o.y - o.len / 2 - o.t / 2;
  if (o.type === 'brick' || o.type === 'sweep' || o.type === 'tramp') return o.y - o.h / 2;
  if (o.type === 'boost' || o.type === 'mud') return o.y - o.h / 2;
  if (o.type === 'gate') return o.y - o.t;
  if (o.type === 'vertical') return o.minY - o.r;
  if (o.type === 'pad') return o.y - 70;
  return o.y - o.r;
}

function addPegGrid(obstacles: Obstacle[], y: number, rows: number, cols: number) {
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? 44 : 0;
    for (let col = 0; col < cols; col++) {
      obstacles.push({
        type: 'peg',
        x: 150 + offset + col * ((WORLD_W - 300) / Math.max(1, cols - 1)),
        y: y + row * 95,
        r: 13,
      });
    }
  }
}

function addRamps(obstacles: Obstacle[], y: number, rows: number) {
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 210;
    if (i % 2 === 0) {
      obstacles.push({ type: 'wall', x1: LEFT_WALL + 45, y1: yy, x2: RIGHT_WALL - 180, y2: yy + 105, t: 16 });
    } else {
      obstacles.push({ type: 'wall', x1: RIGHT_WALL - 45, y1: yy, x2: LEFT_WALL + 180, y2: yy + 105, t: 16 });
    }
  }
}

function addSpinners(obstacles: Obstacle[], y: number, rows: number) {
  for (let i = 0; i < rows; i++) {
    obstacles.push({
      type: 'spinner',
      x: i % 2 ? 610 : 290,
      y: y + i * 230,
      len: i % 2 ? 145 : 125,
      angle: i * 0.8,
      omega: (i % 2 ? -1 : 1) * (1.8 + i * 0.1),
      arms: i % 3 === 0 ? 3 : 2,
      t: 14,
    });
  }
}

function addMovers(obstacles: Obstacle[], y: number, rows: number) {
  for (let i = 0; i < rows; i++) {
    const minX = i % 2 ? 220 : 110;
    const maxX = i % 2 ? 790 : 680;
    obstacles.push({
      type: 'mover',
      x: i % 2 ? maxX : minX,
      y: y + i * 170,
      r: 28,
      minX,
      maxX,
      vx: (i % 2 ? -1 : 1) * (130 + i * 22),
    });
  }
}

function addVerticalMovers(obstacles: Obstacle[], y: number, rows: number) {
  for (let i = 0; i < rows; i++) {
    const minY = y + i * 185;
    const maxY = minY + 135;
    obstacles.push({
      type: 'vertical',
      x: i % 2 ? 660 : 240,
      y: i % 2 ? maxY : minY,
      r: 25,
      minY,
      maxY,
      vy: (i % 2 ? -1 : 1) * (120 + i * 18),
    });
  }
}

function addSweeps(obstacles: Obstacle[], y: number, rows: number) {
  const colors = ['#38BDF8', '#A3E635', '#F97316', '#F9A8D4'];
  for (let i = 0; i < rows; i++) {
    const minX = i % 2 ? 210 : 120;
    const maxX = i % 2 ? 780 : 690;
    obstacles.push({
      type: 'sweep',
      x: i % 2 ? maxX : minX,
      y: y + i * 185,
      w: 150,
      h: 24,
      minX,
      maxX,
      vx: (i % 2 ? -1 : 1) * (150 + i * 20),
      color: colors[i % colors.length],
    });
  }
}

function addBricks(obstacles: Obstacle[], y: number, rows: number) {
  const colors = ['#F9A8D4', '#FACC15', '#A3E635', '#93C5FD', '#C4B5FD'];
  for (let row = 0; row < rows; row++) {
    const count = row % 2 ? 6 : 7;
    const w = 82;
    const gap = 14;
    const startX = WORLD_W / 2 - (count * w + (count - 1) * gap) / 2 + w / 2;
    for (let col = 0; col < count; col++) {
      obstacles.push({
        type: 'brick',
        x: startX + col * (w + gap),
        y: y + row * 64,
        w,
        h: 34,
        hp: row % 3 === 0 ? 2 : 1,
        dead: false,
        color: colors[(row + col) % colors.length],
      });
    }
  }
}

function addPortals(obstacles: Obstacle[], y: number) {
  obstacles.push(
    { type: 'portal', x: 250, y: y + 150, r: 36 },
    { type: 'portal', x: 650, y: y + 340, r: 36 },
  );
  addPegGrid(obstacles, y + 60, 3, 6);
}

function addZones(obstacles: Obstacle[], y: number) {
  obstacles.push(
    { type: 'boost', x: 262, y: y + 200, w: 250, h: 310 },
    { type: 'mud', x: 638, y: y + 200, w: 250, h: 310 },
    { type: 'mud', x: 262, y: y + 580, w: 250, h: 310 },
    { type: 'boost', x: 638, y: y + 580, w: 250, h: 310 },
  );
}

function addGates(obstacles: Obstacle[], y: number) {
  obstacles.push(
    { type: 'gate', y: y + 180, gaps: [235, 665], gapW: 120, period: 2.6, phase: 0, t: 18, clock: 0 },
    { type: 'gate', y: y + 480, gaps: [450], gapW: 135, period: 2.2, phase: 1.1, t: 18, clock: 0 },
  );
  addPegGrid(obstacles, y + 250, 2, 5);
}

function addTramps(obstacles: Obstacle[], y: number) {
  obstacles.push(
    { type: 'tramp', x: 300, y: y + 210, w: 190, h: 22 },
    { type: 'tramp', x: 620, y: y + 450, w: 190, h: 22 },
  );
  addPegGrid(obstacles, y + 60, 2, 6);
}

function addSection(obstacles: Obstacle[], key: string, y: number) {
  if (key === 'portals') {
    addPortals(obstacles, y);
    return y + 650;
  }
  if (key === 'zones') {
    addZones(obstacles, y);
    return y + 850;
  }
  if (key === 'gates') {
    addGates(obstacles, y);
    return y + 700;
  }
  if (key === 'tramps') {
    addTramps(obstacles, y);
    return y + 660;
  }
  if (key === 'pegs') {
    addPegGrid(obstacles, y, 5, 7);
    return y + 560;
  }
  if (key === 'bumpers') {
    addPegGrid(obstacles, y, 3, 6);
    obstacles.push(
      { type: 'bumper', x: 300, y: y + 210, r: 30 },
      { type: 'bumper', x: 600, y: y + 340, r: 30 },
    );
    return y + 590;
  }
  if (key === 'zigzag') {
    addRamps(obstacles, y + 40, 4);
    obstacles.push(
      { type: 'peg', x: 210, y: y + 185, r: 14 },
      { type: 'peg', x: 690, y: y + 395, r: 14 },
    );
    return y + 760;
  }
  if (key === 'ramps') {
    addRamps(obstacles, y, 3);
    obstacles.push({ type: 'pad', x: 450, y: y + 660, r: 42 });
    return y + 800;
  }
  if (key === 'spinners') {
    addSpinners(obstacles, y + 80, 3);
    addPegGrid(obstacles, y + 30, 3, 5);
    return y + 760;
  }
  if (key === 'movers') {
    addMovers(obstacles, y + 80, 4);
    addPegGrid(obstacles, y + 40, 3, 5);
    return y + 760;
  }
  if (key === 'verticals') {
    addVerticalMovers(obstacles, y + 60, 4);
    addPegGrid(obstacles, y + 40, 3, 5);
    return y + 780;
  }
  if (key === 'sweeps') {
    addSweeps(obstacles, y + 95, 4);
    addPegGrid(obstacles, y + 35, 3, 6);
    return y + 780;
  }
  if (key === 'bricks') {
    addBricks(obstacles, y + 80, 4);
    obstacles.push(
      { type: 'bumper', x: 210, y: y + 370, r: 26 },
      { type: 'bumper', x: 690, y: y + 370, r: 26 },
    );
    return y + 620;
  }
  if (key === 'holes') {
    obstacles.push(
      { type: 'hole', x: 280, y: y + 160, r: 54 },
      { type: 'hole', x: 620, y: y + 330, r: 54 },
    );
    addPegGrid(obstacles, y + 80, 3, 6);
    return y + 620;
  }
  if (key === 'pads') {
    obstacles.push(
      { type: 'pad', x: 245, y: y + 190, r: 44 },
      { type: 'pad', x: 655, y: y + 390, r: 44 },
    );
    addRamps(obstacles, y + 80, 2);
    return y + 620;
  }
  return y;
}

export function buildCourse(courseId: CourseId): CourseMap {
  const course = COURSES[courseId];
  const obstacles: Obstacle[] = [
    { type: 'wall', x1: LEFT_WALL, y1: 120, x2: 330, y2: 330, t: 18 },
    { type: 'wall', x1: RIGHT_WALL, y1: 120, x2: 570, y2: 330, t: 18 },
  ];

  let y = 430;
  course.sections.forEach((key) => {
    y = addSection(obstacles, key, y);
  });

  const lastObstacleY = Math.max(y, ...obstacles.map(obstacleMaxY));
  const finishBase = Math.max(lastObstacleY + 420, course.height - 620);
  const finishY = finishBase + 520;
  obstacles.unshift(
    { type: 'wall', x1: LEFT_WALL, y1: -120, x2: LEFT_WALL, y2: finishY + 180, t: 18 },
    { type: 'wall', x1: RIGHT_WALL, y1: -120, x2: RIGHT_WALL, y2: finishY + 180, t: 18 },
  );
  obstacles.push(
    { type: 'wall', x1: LEFT_WALL, y1: finishBase, x2: 370, y2: finishBase + 290, t: 18 },
    { type: 'wall', x1: RIGHT_WALL, y1: finishBase, x2: 530, y2: finishBase + 290, t: 18 },
    { type: 'spinner', x: 450, y: finishBase + 145, len: 150, angle: 0, omega: 2.2, arms: 2, t: 14 },
  );

  const decorations = Array.from({ length: 26 }, (_, i) => ({
    x: i % 2 ? 92 : 808,
    y: 270 + i * 155,
    emoji: course.deco[i % course.deco.length],
    size: 34 + (i % 3) * 8,
  }));

  return { height: finishY + 160, finishY, obstacles, decorations };
}

function collideSegment(r: RunnerState, x1: number, y1: number, x2: number, y2: number, thick: number, bounce = 0) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((r.x - x1) * dx + (r.y - y1) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  let nx = r.x - px;
  let ny = r.y - py;
  const dist = Math.hypot(nx, ny) || 1;
  const minDist = r.r + thick / 2;
  if (dist >= minDist) return false;

  nx /= dist;
  ny /= dist;
  r.x += nx * (minDist - dist);
  r.y += ny * (minDist - dist);

  const vn = r.vx * nx + r.vy * ny;
  if (vn < 0) {
    const e = RESTITUTION + bounce;
    r.vx -= (1 + e) * vn * nx;
    r.vy -= (1 + e) * vn * ny;
    const tx = -ny;
    const ty = nx;
    const vt = r.vx * tx + r.vy * ty;
    r.vx -= tx * vt * 0.02;
    r.vy -= ty * vt * 0.02;
  }
  return true;
}

function collideCircle(r: RunnerState, peg: Peg) {
  const dx = r.x - peg.x;
  const dy = r.y - peg.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = r.r + peg.r;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  r.x += nx * (minDist - dist);
  r.y += ny * (minDist - dist);

  const vn = r.vx * nx + r.vy * ny;
  if (vn < 0) {
    const extra = peg.type === 'bumper' ? 0.55 : peg.type === 'pad' ? 0.95 : 0.1;
    r.vx -= (1 + RESTITUTION + extra) * vn * nx;
    r.vy -= (1 + RESTITUTION + extra) * vn * ny;
    if (peg.type === 'pad') r.vy -= 720;
    if (peg.type === 'bumper') {
      r.vx += (Math.random() - 0.5) * 260;
      r.vy -= 110;
    }
  }
  return true;
}

function collideMover(r: RunnerState, mover: Mover) {
  const dx = r.x - mover.x;
  const dy = r.y - mover.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = r.r + mover.r;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  r.x += nx * (minDist - dist);
  r.y += ny * (minDist - dist);
  const rvx = r.vx - mover.vx;
  const vn = rvx * nx + r.vy * ny;
  if (vn < 0) {
    r.vx -= (1 + RESTITUTION + 0.45) * vn * nx;
    r.vy -= (1 + RESTITUTION + 0.45) * vn * ny;
    r.vx += mover.vx * 0.72;
    r.vy -= 80;
  }
  return true;
}

function collideVerticalMover(r: RunnerState, mover: VerticalMover) {
  const dx = r.x - mover.x;
  const dy = r.y - mover.y;
  const dist = Math.hypot(dx, dy) || 1;
  const minDist = r.r + mover.r;
  if (dist >= minDist) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  r.x += nx * (minDist - dist);
  r.y += ny * (minDist - dist);
  const rvy = r.vy - mover.vy;
  const vn = r.vx * nx + rvy * ny;
  if (vn < 0) {
    r.vx -= (1 + RESTITUTION + 0.42) * vn * nx;
    r.vy -= (1 + RESTITUTION + 0.42) * vn * ny;
    r.vy += mover.vy * 0.58;
    r.vx += (Math.random() - 0.5) * 130;
  }
  return true;
}

function collideSweep(r: RunnerState, sweep: Sweep) {
  const left = sweep.x - sweep.w / 2;
  const right = sweep.x + sweep.w / 2;
  const top = sweep.y - sweep.h / 2;
  const bottom = sweep.y + sweep.h / 2;
  const px = clamp(r.x, left, right);
  const py = clamp(r.y, top, bottom);
  let nx = r.x - px;
  let ny = r.y - py;
  const dist = Math.hypot(nx, ny) || 1;
  if (dist >= r.r) return false;

  nx /= dist;
  ny /= dist;
  r.x += nx * (r.r - dist);
  r.y += ny * (r.r - dist);
  const rvx = r.vx - sweep.vx;
  const vn = rvx * nx + r.vy * ny;
  if (vn < 0) {
    r.vx -= (1 + RESTITUTION + 0.35) * vn * nx;
    r.vy -= (1 + RESTITUTION + 0.35) * vn * ny;
    r.vx += sweep.vx * 0.55;
    r.vy -= 70;
  }
  return true;
}

function collideBrick(r: RunnerState, brick: Brick) {
  if (brick.dead) return false;
  const left = brick.x - brick.w / 2;
  const right = brick.x + brick.w / 2;
  const top = brick.y - brick.h / 2;
  const bottom = brick.y + brick.h / 2;
  const px = clamp(r.x, left, right);
  const py = clamp(r.y, top, bottom);
  let nx = r.x - px;
  let ny = r.y - py;
  const dist = Math.hypot(nx, ny) || 1;
  if (dist >= r.r) return false;

  nx /= dist;
  ny /= dist;
  r.x += nx * (r.r - dist);
  r.y += ny * (r.r - dist);
  const vn = r.vx * nx + r.vy * ny;
  if (vn < 0) {
    r.vx -= (1 + RESTITUTION + 0.18) * vn * nx;
    r.vy -= (1 + RESTITUTION + 0.18) * vn * ny;
  }
  brick.hp -= 1;
  if (brick.hp <= 0) {
    brick.dead = true;
    r.vx += (Math.random() - 0.5) * 180;
    r.vy -= 90;
  }
  return true;
}

/** 매 프레임 움직이는 장애물(스피너·무버·스윕·게이트) 상태 갱신 */
export function updateObstacles(obstacles: Obstacle[], dt: number) {
  obstacles.forEach((o) => {
    if (o.type === 'gate') o.clock += dt;
    if (o.type === 'spinner') o.angle += o.omega * dt;
    if (o.type === 'mover') {
      o.x += o.vx * dt;
      if (o.x < o.minX) {
        o.x = o.minX;
        o.vx = Math.abs(o.vx);
      }
      if (o.x > o.maxX) {
        o.x = o.maxX;
        o.vx = -Math.abs(o.vx);
      }
    }
    if (o.type === 'vertical') {
      o.y += o.vy * dt;
      if (o.y < o.minY) {
        o.y = o.minY;
        o.vy = Math.abs(o.vy);
      }
      if (o.y > o.maxY) {
        o.y = o.maxY;
        o.vy = -Math.abs(o.vy);
      }
    }
    if (o.type === 'sweep') {
      o.x += o.vx * dt;
      if (o.x < o.minX) {
        o.x = o.minX;
        o.vx = Math.abs(o.vx);
      }
      if (o.x > o.maxX) {
        o.x = o.maxX;
        o.vx = -Math.abs(o.vx);
      }
    }
  });
}

/** 출발 그리드 스폰 — 매 레이스 균등 셔플로 위치 배정 (공정성의 핵심) */
export function spawnRunners(list: { id: string; name: string }[]): RunnerState[] {
  const shuffled = shuffleArr(list.map((p, i) => ({ p, i })));
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(shuffled.length * 1.6))));
  const spacing = Math.min(62, (WORLD_W - 300) / cols);

  return shuffled.map(({ p, i }, order) => {
    const col = order % cols;
    const row = Math.floor(order / cols);
    return {
      id: p.id,
      name: p.name,
      icon: RUNNERS[i % RUNNERS.length],
      color: COLORS[i % COLORS.length],
      x: WORLD_W / 2 - ((cols - 1) * spacing) / 2 + col * spacing + (Math.random() - 0.5) * spacing * 0.65,
      y: 230 - row * 44,
      vx: (Math.random() - 0.5) * 260,
      vy: 40 + Math.random() * 80,
      r: RUNNER_R,
      spin: 0,
      finished: false,
      finishTime: 0,
      swallowed: 0,
      lastY: 230 - row * 44,
      stallMs: 0,
      sideStuckMs: 0,
      portalCoolMs: 0,
    };
  });
}

export function stepRunner(runner: RunnerState, dt: number, meanY: number, ctx: StepCtx) {
  const { courseMap, gateOpen, emit } = ctx;
  if (runner.finished) return;

  const beforeY = runner.y;
  const rubber = clamp((meanY - runner.y) / 1600, -0.18, 0.42);
  runner.vy += GRAVITY * (1 + rubber) * dt;
  runner.vx += (Math.random() - 0.5) * 120 * dt;
  if (runner.x < LEFT_WALL + runner.r + 42) runner.vx += 900 * dt;
  if (runner.x > RIGHT_WALL - runner.r - 42) runner.vx -= 900 * dt;
  runner.vx *= 0.998;
  runner.vy = clamp(runner.vy, -MAX_SPEED, MAX_SPEED);
  runner.x += runner.vx * dt;
  runner.y += runner.vy * dt;
  runner.spin += runner.vx * dt * 0.02;

  if (!gateOpen && runner.y > 315) {
    runner.y = 315;
    runner.vy *= -0.25;
    runner.vx += (Math.random() - 0.5) * 90;
  }

  if (runner.x < LEFT_WALL + runner.r) {
    runner.x = LEFT_WALL + runner.r;
    runner.vx = Math.abs(runner.vx) * 0.72;
  }
  if (runner.x > RIGHT_WALL - runner.r) {
    runner.x = RIGHT_WALL - runner.r;
    runner.vx = -Math.abs(runner.vx) * 0.72;
  }

  runner.portalCoolMs = Math.max(0, runner.portalCoolMs - dt * 1000);
  let inMud = false;

  const obstacles = ctx.obstaclesFor ? ctx.obstaclesFor(runner) : courseMap.obstacles;
  obstacles.forEach((o) => {
    if (obstacleMaxY(o) < runner.y - 280 || obstacleMinY(o) > runner.y + 420) return;
    if (o.type === 'portal') {
      const d = Math.hypot(runner.x - o.x, runner.y - o.y);
      if (runner.portalCoolMs <= 0 && d < o.r + runner.r * 0.3) {
        emit?.({ kind: 'burst', x: o.x, y: o.y, color: '#D8B4FE', count: 10 });
        runner.x = clamp(150 + Math.random() * (WORLD_W - 300), LEFT_WALL + runner.r + 20, RIGHT_WALL - runner.r - 20);
        runner.y = Math.min(o.y + 280 + Math.random() * 360, courseMap.finishY - 700);
        runner.vx = (Math.random() - 0.5) * 240;
        runner.vy = 220;
        runner.portalCoolMs = 1100;
        emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#F0ABFC', count: 12 });
        emit?.({ kind: 'portal', runner });
      }
    } else if (o.type === 'boost') {
      if (Math.abs(runner.x - o.x) < o.w / 2 && Math.abs(runner.y - o.y) < o.h / 2) {
        runner.vy += 950 * dt;
        if (Math.random() < 0.08) {
          emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#A3E635', count: 2 });
        }
      }
    } else if (o.type === 'mud') {
      if (Math.abs(runner.x - o.x) < o.w / 2 && Math.abs(runner.y - o.y) < o.h / 2) {
        inMud = true;
        if (runner.vy > 120) runner.vy += (120 - runner.vy) * 2.4 * dt;
        runner.vx *= Math.max(0, 1 - 3 * dt);
      }
    } else if (o.type === 'gate') {
      const open = gateIsOpen(o);
      const segs: [number, number][] = [];
      let cursor = LEFT_WALL;
      for (const gapX of o.gaps) {
        segs.push([cursor, gapX - o.gapW / 2]);
        if (!open) segs.push([gapX - o.gapW / 2, gapX + o.gapW / 2]);
        cursor = gapX + o.gapW / 2;
      }
      segs.push([cursor, RIGHT_WALL]);
      for (const [x1, x2] of segs) {
        collideSegment(runner, x1, o.y, x2, o.y, o.t);
      }
      if (!open && runner.y < o.y && runner.y > o.y - 150) {
        runner.stallMs = 0;
      }
    } else if (o.type === 'tramp') {
      const left = o.x - o.w / 2;
      const right = o.x + o.w / 2;
      const top = o.y - o.h / 2;
      if (
        runner.x > left - runner.r &&
        runner.x < right + runner.r &&
        runner.y + runner.r > top &&
        runner.y < o.y &&
        runner.vy > 0
      ) {
        runner.y = top - runner.r;
        const launch = Math.max(runner.vy * 0.8 + 480, 620);
        runner.vy = -Math.min(launch, 1350);
        runner.vx += (Math.random() - 0.5) * 340;
        emit?.({ kind: 'burst', x: runner.x, y: o.y, color: '#FDE68A', count: 8 });
        emit?.({ kind: 'tramp', runner, launch });
      }
    } else if (o.type === 'wall') {
      if (collideSegment(runner, o.x1, o.y1, o.x2, o.y2, o.t)) {
        const nearSide = runner.x < LEFT_WALL + runner.r + 45 || runner.x > RIGHT_WALL - runner.r - 45;
        if (nearSide && Math.abs(runner.vx) < 180) {
          runner.vx += runner.x < WORLD_W / 2 ? 260 : -260;
          runner.vy = Math.max(runner.vy, 160);
        }
      }
    } else if (o.type === 'spinner') {
      for (let i = 0; i < o.arms; i++) {
        const a = o.angle + (Math.PI * 2 * i) / o.arms;
        const x1 = o.x - Math.cos(a) * o.len / 2;
        const y1 = o.y - Math.sin(a) * o.len / 2;
        const x2 = o.x + Math.cos(a) * o.len / 2;
        const y2 = o.y + Math.sin(a) * o.len / 2;
        if (collideSegment(runner, x1, y1, x2, y2, o.t, 0.24)) {
          runner.vx += Math.cos(a + Math.PI / 2) * o.omega * 42;
          runner.vy += Math.sin(a + Math.PI / 2) * o.omega * 42;
        }
      }
    } else if (o.type === 'hole') {
      const dx = o.x - runner.x;
      const dy = o.y - runner.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < o.r + 90) {
        runner.vx += (dx / d) * 560 * dt;
        runner.vy += (dy / d) * 560 * dt;
      }
      if (d < o.r * 0.5) {
        runner.vy += 520 * dt;
        runner.vx += (Math.random() - 0.5) * 180 * dt;
      }
    } else if (o.type === 'mover') {
      if (collideMover(runner, o) && Math.random() < 0.2) {
        emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#FB7185', count: 3 });
      }
    } else if (o.type === 'vertical') {
      if (collideVerticalMover(runner, o) && Math.random() < 0.2) {
        emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#38BDF8', count: 3 });
      }
    } else if (o.type === 'sweep') {
      if (collideSweep(runner, o) && Math.random() < 0.22) {
        emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: o.color, count: 3 });
      }
    } else if (o.type === 'brick') {
      const hpBefore = o.hp;
      if (collideBrick(runner, o) && o.dead && hpBefore > 0) {
        emit?.({ kind: 'burst', x: o.x, y: o.y, color: o.color, count: 14 });
      }
    } else {
      collideCircle(runner, o);
    }
  });

  const nearLeftSide = runner.x < LEFT_WALL + runner.r + 24;
  const nearRightSide = runner.x > RIGHT_WALL - runner.r - 24;
  const sideLowMotion = Math.abs(runner.vx) < 150 && Math.abs(runner.vy) < 260;
  if ((nearLeftSide || nearRightSide) && sideLowMotion) {
    runner.sideStuckMs += dt * 1000;
  } else {
    runner.sideStuckMs = Math.max(0, runner.sideStuckMs - dt * 1800);
  }

  if (runner.sideStuckMs > 380) {
    const pushRight = nearLeftSide || runner.x < WORLD_W / 2;
    runner.x = clamp(runner.x + (pushRight ? 34 : -34), LEFT_WALL + runner.r, RIGHT_WALL - runner.r);
    runner.vx = pushRight ? Math.max(runner.vx, 390) : Math.min(runner.vx, -390);
    runner.vy = Math.max(runner.vy, 360);
    runner.sideStuckMs = 0;
    emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#A3E635', count: 5 });
  }

  const progressed = runner.y - beforeY;
  const nearFinish = runner.y > courseMap.finishY - 900;
  const slowProgress = runner.y > 360 && progressed < 1.4 && Math.abs(runner.vy) < 220;
  if ((nearFinish || slowProgress) && progressed < 1.8 && !inMud) {
    runner.stallMs += dt * 1000;
  } else {
    runner.stallMs = Math.max(0, runner.stallMs - dt * 2200);
  }

  if (nearFinish) {
    runner.vy += 520 * dt;
    runner.vx += (WORLD_W / 2 - runner.x) * 0.35 * dt;
  }

  if (runner.stallMs > 520) {
    runner.vy = Math.max(runner.vy, nearFinish ? 520 : 430);
    runner.vx += (WORLD_W / 2 - runner.x) * 0.8 + (Math.random() - 0.5) * 320;
    runner.stallMs = 0;
    emit?.({ kind: 'burst', x: runner.x, y: runner.y, color: '#FACC15', count: 4 });
  }

  runner.lastY = runner.y;

  if (runner.y >= courseMap.finishY - 18) {
    runner.y = courseMap.finishY;
    runner.vx *= 0.2;
    runner.vy = 0;
    runner.finished = true;
    runner.finishTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    emit?.({ kind: 'finish', runner });
  }
}

export interface SimResult {
  order: string[];
  spawns: { name: string; x: number; y: number }[];
  simSeconds: number;
}

/** 헤드리스 레이스 1판 — 실제 게임과 동일한 물리로 결승 순서를 계산한다. */
export function simulateRace(
  names: string[],
  courseId: CourseId = 'short',
  maxSeconds = 240,
): SimResult {
  const courseMap = buildCourse(courseId);
  const runners = spawnRunners(names.map((n, i) => ({ id: `${n}#${i}`, name: n })));
  const spawns = runners.map((r) => ({ name: r.name, x: r.x, y: r.y }));

  const BUCKET = 700;
  const buckets = new Map<number, Obstacle[]>();
  for (const o of courseMap.obstacles) {
    const lo = Math.floor(obstacleMinY(o) / BUCKET);
    const hi = Math.floor(obstacleMaxY(o) / BUCKET);
    for (let b = lo; b <= hi; b++) {
      const arr = buckets.get(b);
      if (arr) arr.push(o);
      else buckets.set(b, [o]);
    }
  }
  const near = (r: RunnerState) => {
    const lo = Math.floor((r.y - 300) / BUCKET);
    const hi = Math.floor((r.y + 440) / BUCKET);
    const out: Obstacle[] = [];
    for (let b = lo; b <= hi; b++) {
      const arr = buckets.get(b);
      if (arr) for (const o of arr) out.push(o);
    }
    return out;
  };

  const finish: number[] = [];
  const emit = (e: RaceEvent) => {
    if (e.kind === 'finish') finish.push(runners.indexOf(e.runner));
  };

  const dt = 1 / 60;
  let t = 0;
  while (finish.length < runners.length && t < maxSeconds) {
    updateObstacles(courseMap.obstacles, dt);
    const activeRs = runners.filter((r) => !r.finished);
    const meanY = activeRs.length
      ? activeRs.reduce((s, r) => s + r.y, 0) / activeRs.length
      : courseMap.finishY;
    for (const r of runners) {
      stepRunner(r, dt, meanY, { courseMap, gateOpen: t > 0.9, emit, obstaclesFor: near });
    }
    t += dt;
  }

  runners
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !r.finished && !finish.includes(i))
    .sort((a, b) => b.r.y - a.r.y)
    .forEach(({ i }) => finish.push(i));

  return { order: finish.map((i) => runners[i].name), spawns, simSeconds: t };
}
