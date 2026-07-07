import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { activeParticipants, shuffle } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';
import { useAppStore } from '../../stores/session';

const WORLD_W = 900;
const LEFT_WALL = 45;
const RIGHT_WALL = WORLD_W - 45;
const RUNNER_R = 17;
const GRAVITY = 1260;
const MAX_SPEED = 1850;
const RESTITUTION = 0.48;

const RUNNERS = [
  '🤖', '📚', '✏️', '💡', '⭐', '🎒', '🧩', '🎯', '📝', '🔔',
  '🚀', '🌈', '🏆', '🎨', '🖍️', '📐', '🧪', '🔎', '🎲', '📌',
  '🟣', '🟢', '🟡', '🩷', '💜', '✅', '✨', '🌟', '📘', '📗',
];

const COLORS = [
  '#8B5CF6', '#A3E635', '#F9A8D4', '#FACC15', '#38BDF8',
  '#FB7185', '#34D399', '#C084FC', '#F97316', '#60A5FA',
];

const COURSES = {
  short: {
    label: '클래식 콩콩맵',
    shortLabel: '클래식',
    height: 8400,
    bgTop: '#9fdcaa',
    bgBottom: '#e8f8d8',
    deco: ['🌲', '🌳', '🍄', '🌼', '📚'],
    sections: [
      'pegs',
      'bumpers',
      'movers',
      'zigzag',
      'bricks',
      'pegs',
      'sweeps',
      'ramps',
      'bumpers',
      'verticals',
      'bricks',
      'pegs',
      'movers',
      'zigzag',
      'spinners',
      'pads',
    ],
  },
  normal: {
    label: '바람개비 지그재그',
    shortLabel: '지그재그',
    height: 11800,
    bgTop: '#c3b3f2',
    bgBottom: '#f2ebff',
    deco: ['🌀', '🌷', '🦋', '⭐', '✏️'],
    sections: [
      'spinners',
      'pegs',
      'movers',
      'ramps',
      'bricks',
      'bumpers',
      'verticals',
      'spinners',
      'zigzag',
      'pegs',
      'sweeps',
      'pads',
      'bricks',
      'holes',
      'movers',
      'ramps',
      'spinners',
      'pegs',
      'bumpers',
      'pads',
    ],
  },
  long: {
    label: '혼돈의 롱코스',
    shortLabel: '롱코스',
    height: 16400,
    bgTop: '#0d0d33',
    bgBottom: '#31315e',
    deco: ['⭐', '🪐', '🛸', '✨', '🌙'],
    sections: [
      'pegs',
      'holes',
      'spinners',
      'pads',
      'zigzag',
      'bumpers',
      'movers',
      'bricks',
      'ramps',
      'sweeps',
      'spinners',
      'holes',
      'pegs',
      'pads',
      'verticals',
      'bricks',
      'movers',
      'zigzag',
      'holes',
      'spinners',
      'ramps',
      'bumpers',
      'bricks',
      'sweeps',
      'pegs',
      'pads',
    ],
  },
} as const;

type CourseId = keyof typeof COURSES;
type Phase = 'setup' | 'countdown' | 'racing' | 'done';

interface Wall {
  type: 'wall';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
}

interface Peg {
  type: 'peg' | 'bumper' | 'hole' | 'pad';
  x: number;
  y: number;
  r: number;
}

interface Mover {
  type: 'mover';
  x: number;
  y: number;
  r: number;
  minX: number;
  maxX: number;
  vx: number;
}

interface VerticalMover {
  type: 'vertical';
  x: number;
  y: number;
  r: number;
  minY: number;
  maxY: number;
  vy: number;
}

interface Sweep {
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

interface Brick {
  type: 'brick';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  dead: boolean;
  color: string;
}

interface Spinner {
  type: 'spinner';
  x: number;
  y: number;
  len: number;
  angle: number;
  omega: number;
  arms: 2 | 3;
  t: number;
}

type Obstacle = Wall | Peg | Mover | VerticalMover | Sweep | Brick | Spinner;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RunnerState {
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
}

interface CourseMap {
  height: number;
  finishY: number;
  obstacles: Obstacle[];
  decorations: { x: number; y: number; emoji: string; size: number }[];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function obstacleMaxY(o: Obstacle) {
  if (o.type === 'wall') return Math.max(o.y1, o.y2) + o.t / 2;
  if (o.type === 'spinner') return o.y + o.len / 2 + o.t / 2;
  if (o.type === 'brick') return o.y + o.h / 2;
  if (o.type === 'sweep') return o.y + o.h / 2;
  if (o.type === 'vertical') return o.maxY + o.r;
  if (o.type === 'pad') return o.y + 70;
  return o.y + o.r;
}

function obstacleMinY(o: Obstacle) {
  if (o.type === 'wall') return Math.min(o.y1, o.y2) - o.t / 2;
  if (o.type === 'spinner') return o.y - o.len / 2 - o.t / 2;
  if (o.type === 'brick') return o.y - o.h / 2;
  if (o.type === 'sweep') return o.y - o.h / 2;
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

function addSection(obstacles: Obstacle[], key: string, y: number) {
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

function buildCourse(courseId: CourseId): CourseMap {
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

export default function RaceGame() {
  const navigate = useNavigate();
  const participants = useAppStore((s) => s.participants);
  const excludedIds = useAppStore((s) => s.excludedIds);
  const settings = useAppStore((s) => s.gameSettings.race);
  const updateRace = useAppStore((s) => s.updateRace);
  const setLastResult = useAppStore((s) => s.setLastResult);
  const soundEnabled = useAppStore((s) => s.soundEnabled);

  const active = useMemo(
    () => activeParticipants(participants, excludedIds),
    [participants, excludedIds],
  );

  const [phase, setPhase] = useState<Phase>('setup');
  const [countdown, setCountdown] = useState('3');
  const [fastForward, setFastForward] = useState(false);
  const [courseRunId, setCourseRunId] = useState(0);
  const [frame, setFrame] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runnersRef = useRef<RunnerState[]>([]);
  const finishRef = useRef<number[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const camYRef = useRef(-260);
  const gateOpenRef = useRef(false);
  const phaseRef = useRef<Phase>('setup');
  const fastForwardRef = useRef(false);
  fastForwardRef.current = fastForward;

  const courseId = (settings.mapId in COURSES ? settings.mapId : 'normal') as CourseId;
  const course = COURSES[courseId];
  const courseMap = useMemo(() => buildCourse(courseId), [courseId, courseRunId]);
  const winnerCount = Math.min(Math.max(1, settings.winnerCount), active.length);
  const hasWeights = active.some((p) => p.weight > 1);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const toScreen = (worldX: number, worldY: number, scale: number, offX: number) => ({
    x: offX + worldX * scale,
    y: (worldY - camYRef.current) * scale,
  });

  const spawnBurst = (x: number, y: number, color: string, count = 8) => {
    const particles = particlesRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 130 + Math.random() * 360;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        life: 360 + Math.random() * 420,
        maxLife: 780,
        color,
        size: 4 + Math.random() * 7,
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  };

  const drawScene = (preview = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(360, rect.width);
    const height = Math.max(460, rect.height);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const scale = Math.min(width / WORLD_W, height / 1040);
    const offX = (width - WORLD_W * scale) / 2;
    const viewTop = camYRef.current;
    const viewBottom = viewTop + height / scale;

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, course.bgTop);
    bg.addColorStop(1, course.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(offX, -camYRef.current * scale);
    ctx.scale(scale, scale);

    ctx.fillStyle = courseId === 'long' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.32)';
    courseMap.decorations.forEach((d) => {
      if (d.y < viewTop - 100 || d.y > viewBottom + 100) return;
      ctx.font = `${d.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.emoji, d.x, d.y);
    });

    ctx.strokeStyle = courseId === 'long' ? '#E9D5FF' : '#5B21B6';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(LEFT_WALL, 0);
    ctx.lineTo(RIGHT_WALL, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#2F1954';
    ctx.font = '900 32px Pretendard, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ START', WORLD_W / 2, -34);

    courseMap.obstacles.forEach((o) => {
      if ('y' in o && (o.y < viewTop - 220 || o.y > viewBottom + 220)) return;
      if (o.type === 'wall') {
        if (Math.max(o.y1, o.y2) < viewTop - 220 || Math.min(o.y1, o.y2) > viewBottom + 220) return;
        ctx.lineCap = 'round';
        ctx.strokeStyle = courseId === 'long' ? '#C4B5FD' : '#7C3AED';
        ctx.lineWidth = o.t + 7;
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
        ctx.strokeStyle = courseId === 'long' ? '#312E81' : '#F4F0FF';
        ctx.lineWidth = o.t;
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
      } else if (o.type === 'spinner') {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.angle);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = o.t;
        ctx.lineCap = 'round';
        for (let i = 0; i < o.arms; i++) {
          const a = (Math.PI * 2 * i) / o.arms;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * -o.len / 2, Math.sin(a) * -o.len / 2);
          ctx.lineTo(Math.cos(a) * o.len / 2, Math.sin(a) * o.len / 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (o.type === 'hole') {
        const g = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, o.r + 22);
        g.addColorStop(0, '#080412');
        g.addColorStop(0.65, 'rgba(49,18,97,0.75)');
        g.addColorStop(1, 'rgba(49,18,97,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C4B5FD';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (o.type === 'pad') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.roundRect(o.x - 70, o.y - 8, 140, 16, 8);
        ctx.fill();
        ctx.fillStyle = '#FDE68A';
        ctx.beginPath();
        ctx.roundRect(o.x - 58, o.y - 4, 116, 7, 4);
        ctx.fill();
        ctx.font = '900 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⇧', o.x, o.y - 28);
      } else if (o.type === 'mover') {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = '#FB7185';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.vx > 0 ? '→' : '←', 0, 1);
        ctx.restore();
        ctx.strokeStyle = 'rgba(251,113,133,0.32)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(o.minX, o.y);
        ctx.lineTo(o.maxX, o.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (o.type === 'vertical') {
        ctx.strokeStyle = 'rgba(56,189,248,0.34)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(o.x, o.minY);
        ctx.lineTo(o.x, o.maxY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.vy > 0 ? 'v' : '^', 0, 1);
        ctx.restore();
      } else if (o.type === 'sweep') {
        ctx.strokeStyle = 'rgba(249,115,22,0.28)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.moveTo(o.minX, o.y);
        ctx.lineTo(o.maxX, o.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = o.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 18px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.vx > 0 ? '>' : '<', 0, 1);
        ctx.restore();
      } else if (o.type === 'brick') {
        if (o.dead) return;
        ctx.fillStyle = o.color;
        ctx.strokeStyle = o.hp > 1 ? '#7C3AED' : 'rgba(124,58,237,0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#32126A';
        ctx.font = '900 18px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.hp > 1 ? '◆' : '×', o.x, o.y + 1);
      } else {
        ctx.fillStyle = o.type === 'bumper' ? '#FACC15' : '#FFFFFF';
        ctx.strokeStyle = o.type === 'bumper' ? '#F59E0B' : '#8B5CF6';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (o.type === 'bumper') {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 27px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', o.x, o.y + 1);
        }
      }
    });

    particlesRef.current.forEach((p) => {
      if (p.y < viewTop - 120 || p.y > viewBottom + 120) return;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.65 + alpha * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const cell = 30;
    for (let x = LEFT_WALL; x < RIGHT_WALL; x += cell) {
      ctx.fillStyle = Math.floor((x - LEFT_WALL) / cell) % 2 ? '#2D3748' : '#FFFFFF';
      ctx.fillRect(x, courseMap.finishY - 14, cell, 28);
    }
    ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#B45309';
    ctx.font = '900 42px Pretendard, sans-serif';
    ctx.fillText('🏁 결승선 🏁', WORLD_W / 2, courseMap.finishY + 78);

    const visibleRunners = preview
      ? active.slice(0, 20).map((p, i) => ({
          id: p.id,
          name: p.name,
          icon: RUNNERS[i % RUNNERS.length],
          color: COLORS[i % COLORS.length],
          x: WORLD_W / 2 - 240 + (i % 8) * 70,
          y: 190 - Math.floor(i / 8) * 48,
          vx: 0,
          vy: 0,
          r: RUNNER_R,
          spin: 0,
          finished: false,
          finishTime: 0,
          swallowed: 0,
          lastY: 0,
          stallMs: 0,
          sideStuckMs: 0,
        }))
      : runnersRef.current;

    visibleRunners.forEach((runner) => {
      if (runner.y < viewTop - 100 || runner.y > viewBottom + 120) return;
      ctx.save();
      ctx.translate(runner.x, runner.y);
      ctx.rotate(runner.spin);
      ctx.shadowColor = 'rgba(0,0,0,0.24)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = runner.finished ? '#A3E635' : runner.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, runner.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.font = `${runner.r + 5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(runner.icon, 0, 1);
      ctx.restore();

      ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#2F1954';
      ctx.font = '800 15px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(runner.name.slice(0, 5), runner.x, runner.y + runner.r + 18);
    });

    if (phaseRef.current === 'setup') {
      ctx.fillStyle = courseId === 'long' ? '#FFFFFF' : '#2F1954';
      ctx.font = '900 42px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('긴 맵 레이스 준비 완료', WORLD_W / 2, 555);
      ctx.font = '800 24px Pretendard, sans-serif';
      ctx.fillText('구슬이 장애물을 통과해 결승선까지 내려갑니다', WORLD_W / 2, 598);
    }

    ctx.restore();

    const progress = clamp((camYRef.current + height / scale) / courseMap.finishY, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(18, height - 20, width - 36, 8);
    ctx.fillStyle = '#A3E635';
    ctx.fillRect(18, height - 20, (width - 36) * progress, 8);
  };

  const resetPreview = () => {
    finishRef.current = [];
    runnersRef.current = [];
    particlesRef.current = [];
    camYRef.current = -260;
    gateOpenRef.current = false;
    drawScene(true);
  };

  useEffect(() => {
    if (phase === 'setup') resetPreview();
    else drawScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, courseId, phase]);

  const stepRunner = (runner: RunnerState, dt: number, meanY: number) => {
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

    if (!gateOpenRef.current && runner.y > 315) {
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

    courseMap.obstacles.forEach((o) => {
      if (obstacleMaxY(o) < runner.y - 280 || obstacleMinY(o) > runner.y + 420) return;
      if (o.type === 'wall') {
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
        if (collideMover(runner, o) && Math.random() < 0.2) spawnBurst(runner.x, runner.y, '#FB7185', 3);
      } else if (o.type === 'vertical') {
        if (collideVerticalMover(runner, o) && Math.random() < 0.2) spawnBurst(runner.x, runner.y, '#38BDF8', 3);
      } else if (o.type === 'sweep') {
        if (collideSweep(runner, o) && Math.random() < 0.22) spawnBurst(runner.x, runner.y, o.color, 3);
      } else if (o.type === 'brick') {
        const hpBefore = o.hp;
        if (collideBrick(runner, o) && o.dead && hpBefore > 0) spawnBurst(o.x, o.y, o.color, 14);
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
      spawnBurst(runner.x, runner.y, '#A3E635', 5);
    }

    const progressed = runner.y - beforeY;
    const nearFinish = runner.y > courseMap.finishY - 900;
    const slowProgress = runner.y > 360 && progressed < 1.4 && Math.abs(runner.vy) < 220;
    if ((nearFinish || slowProgress) && progressed < 1.8) {
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
      spawnBurst(runner.x, runner.y, '#FACC15', 4);
    }

    runner.lastY = runner.y;

    if (runner.y >= courseMap.finishY - 18) {
      runner.y = courseMap.finishY;
      runner.vx *= 0.2;
      runner.vy = 0;
      runner.finished = true;
      runner.finishTime = performance.now();
      finishRef.current.push(runnersRef.current.indexOf(runner));
      if (finishRef.current.length === 1) winSfx(soundEnabled);
    }
  };

  const beginRace = () => {
    const shuffled = shuffle(active.map((p, i) => ({ p, i })));
    const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(shuffled.length * 1.6))));
    const spacing = Math.min(62, (WORLD_W - 300) / cols);

    runnersRef.current = shuffled.map(({ p, i }, order) => {
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
      };
    });
    finishRef.current = [];
    particlesRef.current = [];
    camYRef.current = -260;
    gateOpenRef.current = false;
    lastTimeRef.current = 0;
    setTimeout(() => {
      gateOpenRef.current = true;
    }, 900);

    const loop = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const rawDt = Math.min(32, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const selectedDone =
        settings.winMode === 'first' && finishRef.current.length >= winnerCount;
      const speedScale = fastForwardRef.current ? 4 : selectedDone ? 2.8 : settings.speed === 'fast' ? 1.45 : 1;
      const dt = rawDt * speedScale;

      courseMap.obstacles.forEach((o) => {
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
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 520 * dt,
          life: p.life - dt * 1000,
        }))
        .filter((p) => p.life > 0);

      const activeRunners = runnersRef.current.filter((r) => !r.finished);
      const meanY = activeRunners.length
        ? activeRunners.reduce((sum, r) => sum + r.y, 0) / activeRunners.length
        : courseMap.finishY;
      runnersRef.current.forEach((runner) => stepRunner(runner, dt, meanY));

      const leader = runnersRef.current
        .filter((r) => !r.finished)
        .sort((a, b) => b.y - a.y)[0];
      const targetY = leader ? leader.y - 430 : courseMap.finishY - 760;
      camYRef.current += (clamp(targetY, -360, courseMap.finishY - 520) - camYRef.current) * 0.08;

      drawScene();
      setFrame((f) => f + 1);

      if (finishRef.current.length < runnersRef.current.length) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setPhase('done');
        phaseRef.current = 'done';
        camYRef.current = courseMap.finishY - 760;
        drawScene();
        winSfx(soundEnabled);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const start = () => {
    if (phase !== 'setup' || active.length < 2) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const order = shuffle(active.map((p, i) => ({ p, i })));
      runnersRef.current = order.map(({ p, i }, rank) => ({
        id: p.id,
        name: p.name,
        icon: RUNNERS[i % RUNNERS.length],
        color: COLORS[i % COLORS.length],
        x: WORLD_W / 2 - 260 + (rank % 8) * 72,
        y: courseMap.finishY,
        vx: 0,
        vy: 0,
        r: RUNNER_R,
        spin: 0,
        finished: true,
        finishTime: Date.now() + rank,
        swallowed: 0,
        lastY: courseMap.finishY,
        stallMs: 0,
        sideStuckMs: 0,
      }));
      finishRef.current = runnersRef.current.map((_, i) => i);
      camYRef.current = courseMap.finishY - 760;
      setPhase('done');
      return;
    }

    setPhase('countdown');
    const seq = ['3', '2', '1', 'GO!'];
    seq.forEach((s, i) => setTimeout(() => setCountdown(s), i * 800));
    setTimeout(() => {
      phaseRef.current = 'racing';
      setPhase('racing');
      beginRace();
    }, seq.length * 800);
  };

  const finishOrder = useMemo(() => {
    if (phase !== 'done') return [];
    return finishRef.current.map((idx) => {
      const runner = runnersRef.current[idx];
      return active.findIndex((p) => p.id === runner.id);
    });
  }, [active, phase, frame]);

  const winners = useMemo(() => {
    if (phase !== 'done') return [];
    return settings.winMode === 'first'
      ? finishOrder.slice(0, winnerCount)
      : [...finishOrder].reverse().slice(0, winnerCount);
  }, [finishOrder, phase, settings.winMode, winnerCount]);

  const liveRanking = useMemo(() => {
    if (phase !== 'racing' && phase !== 'done') return [];
    const finished = finishRef.current.map((idx) => runnersRef.current[idx]).filter(Boolean);
    const running = runnersRef.current
      .filter((runner) => !runner.finished)
      .sort((a, b) => b.y - a.y);
    return [...finished, ...running];
  }, [phase, frame]);

  const finish = () => {
    setLastResult({
      gameId: 'race',
      resultKind: 'order',
      winners: winners.map((i) => active[i].id),
      rankings: finishOrder.map((idx, rank) => ({
        name: active[idx].name,
        rank: rank + 1,
      })),
      drawnAt: Date.now(),
    });
    navigate('/result');
  };

  const restart = () => {
    cancelAnimationFrame(rafRef.current);
    finishRef.current = [];
    runnersRef.current = [];
    camYRef.current = -260;
    gateOpenRef.current = false;
    setFastForward(false);
    setCourseRunId((v) => v + 1);
    setPhase('setup');
  };

  return (
    <div className="game-shell lg:grid-cols-[1.7fr_minmax(250px,0.7fr)] lg:items-start">
      {phase === 'done' && <ConfettiBurst count={50} />}

      <section className="panel relative flex min-w-0 flex-col gap-3 p-3 sm:p-6">
        {phase === 'countdown' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-pick-purple-950/80">
            <span className="pixel-title pop-win text-6xl text-pick-lime-400 sm:text-8xl" key={countdown}>
              {countdown}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-ink-purple">
            {settings.winMode === 'first' ? '1등' : '마지막'} {winnerCount}명 당첨 · {course.label}
          </p>
          {phase === 'racing' && (
            <button
              type="button"
              className="option-chip !py-1.5 !text-sm"
              data-selected={fastForward}
              onClick={() => setFastForward((v) => !v)}
            >
              빨리감기
            </button>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border-4 border-white bg-white shadow-[0_18px_45px_rgba(47,25,84,0.18)] sm:rounded-3xl">
          <canvas ref={canvasRef} className="game-canvas block w-full" />
          {phase === 'setup' && (
            <div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-3 px-4">
              <button
                type="button"
                className="btn-primary px-8 text-2xl sm:px-12 sm:text-3xl"
                onClick={start}
                disabled={active.length < 2}
              >
                출발!
              </button>
              {active.length < 2 && (
                <p className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-danger">
                  레이스는 2명 이상일 때 할 수 있어요
                </p>
              )}
              {hasWeights && (
                <p className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-muted">
                  레이스는 가중치 없이 모두 같은 조건으로 달려요
                </p>
              )}
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                {(Object.entries(COURSES) as [CourseId, (typeof COURSES)[CourseId]][]).map(
                  ([id, c]) => (
                    <button
                      key={id}
                      type="button"
                      className="rounded-2xl border-2 bg-white/90 px-4 py-3 text-sm font-black text-ink-purple shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={phase !== 'setup'}
                      onClick={() => updateRace({ mapId: id })}
                      style={{
                        borderColor: courseId === id ? '#A3E635' : 'rgba(124, 58, 237, 0.18)',
                        background:
                          courseId === id
                            ? 'linear-gradient(180deg, rgba(244,255,208,0.96), rgba(255,255,255,0.92))'
                            : 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {c.label}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {phase === 'done' && (
          <div className="pop-win flex flex-col items-center gap-3 rounded-2xl bg-surface-lime p-4">
            <p className="pixel-title text-xl text-pick-purple-600">골인!</p>
            <p className="text-center text-3xl font-black text-ink-purple">
              {winners.map((i) => active[i].name).join(', ')}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={finish}>
                결과 보기
              </button>
              <button type="button" className="btn-secondary" onClick={restart}>
                다시 하기
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-black text-ink-purple">🏁 맵 레이스</h1>
            <Link to="/lobby" className="text-sm font-bold text-muted underline">
              ← 로비
            </Link>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">당첨 기준</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="option-chip"
                data-selected={settings.winMode === 'first'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ winMode: 'first' })}
              >
                🥇 1등
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.winMode === 'last'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ winMode: 'last' })}
              >
                🎯 마지막
              </button>
            </div>
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">당첨 인원</p>
            <input
              type="number"
              min={1}
              max={active.length}
              value={settings.winnerCount}
              disabled={phase !== 'setup'}
              className="input-soft !w-28"
              onChange={(e) =>
                updateRace({ winnerCount: parseInt(e.target.value, 10) || 1 })
              }
            />
          </div>

          <div className="mb-3">
            <p className="mb-1 text-sm font-extrabold text-ink-purple">맵 선택</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(COURSES) as [CourseId, (typeof COURSES)[CourseId]][]).map(
                ([id, c]) => (
                  <button
                    key={id}
                    type="button"
                    className="option-chip"
                    data-selected={courseId === id}
                    disabled={phase !== 'setup'}
                    onClick={() => updateRace({ mapId: id })}
                  >
                    {c.shortLabel}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-extrabold text-ink-purple">속도</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="option-chip"
                data-selected={settings.speed === 'normal'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ speed: 'normal' })}
              >
                보통
              </button>
              <button
                type="button"
                className="option-chip"
                data-selected={settings.speed === 'fast'}
                disabled={phase !== 'setup'}
                onClick={() => updateRace({ speed: 'fast' })}
              >
                빠름
              </button>
            </div>
          </div>
        </div>

        {(phase === 'racing' || phase === 'done') && (
          <div className="panel p-4">
            <p className="mb-2 text-sm font-extrabold text-ink-purple">실시간 순위</p>
            <ol className="flex flex-col gap-1">
              {liveRanking.slice(0, 10).map((runner, rank) => (
                <li
                  key={runner.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold ${
                    rank === 0
                      ? 'bg-gradient-to-b from-[#FFF6A8] to-pick-yellow-400 text-ink'
                      : 'bg-surface-lavender text-ink-purple'
                  }`}
                >
                  <span className="pixel-title w-6 text-center">{rank + 1}</span>
                  <span>{runner.icon}</span>
                  <span className="truncate">{runner.name}</span>
                </li>
              ))}
              {liveRanking.length > 10 && (
                <li className="px-2 text-xs font-bold text-muted">
                  외 {liveRanking.length - 10}명
                </li>
              )}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
