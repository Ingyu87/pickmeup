import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConfettiBurst from '../../components/ConfettiBurst';
import { activeParticipants, shuffle } from '../../lib/draw';
import { winSfx } from '../../lib/sfx';
import { useAppStore } from '../../stores/session';
import {
  COLORS,
  COURSES,
  RUNNERS,
  LEFT_WALL,
  RIGHT_WALL,
  RUNNER_R,
  WORLD_W,
  buildCourse,
  clamp,
  gateIsOpen,
  spawnRunners,
  stepRunner,
  updateObstacles,
} from './engine';
import type { CourseId, RaceEvent, RunnerState } from './engine';

type Phase = 'setup' | 'countdown' | 'racing' | 'done';

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
  const tickerRef = useRef({ text: '', until: 0, lastAt: 0 });
  const lastLeaderRef = useRef<string | null>(null);
  const slowmoRef = useRef(false);
  const zoomRef = useRef(1);
  const flashRef = useRef(0);
  const raceStartRef = useRef(0);

  const announce = (text: string, priority = false) => {
    const now = performance.now();
    if (!priority && now - tickerRef.current.lastAt < 1200) return;
    tickerRef.current = { text, until: now + 2600, lastAt: now };
  };

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

    const scale = Math.min(width / WORLD_W, height / 1040) * (preview ? 1 : zoomRef.current);
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
      } else if (o.type === 'portal') {
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(o.x, o.y);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, o.r + 12);
        g.addColorStop(0, 'rgba(240,171,252,0.85)');
        g.addColorStop(1, 'rgba(168,85,247,0.12)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, o.r + 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(t * 2.4);
        ctx.strokeStyle = '#D8B4FE';
        ctx.lineWidth = 5;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.rotate(-t * 4.2);
        ctx.strokeStyle = '#FF6FCF';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, o.r - 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', o.x, o.y + 1);
      } else if (o.type === 'boost' || o.type === 'mud') {
        const isBoost = o.type === 'boost';
        ctx.fillStyle = isBoost ? 'rgba(163,230,53,0.20)' : 'rgba(120,53,150,0.22)';
        ctx.strokeStyle = isBoost ? 'rgba(130,176,0,0.55)' : 'rgba(88,28,135,0.45)';
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.roundRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 20);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '900 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isBoost) {
          const drift = (performance.now() / 6) % 90;
          ctx.fillStyle = 'rgba(130,176,0,0.8)';
          for (let i = 0; i < 3; i++) {
            ctx.fillText('⬇', o.x, o.y - o.h / 2 + 40 + ((drift + i * 90) % (o.h - 60)));
          }
        } else {
          ctx.fillText('🍯', o.x, o.y - o.h / 2 + 40);
          ctx.fillText('🍯', o.x, o.y + o.h / 2 - 40);
        }
      } else if (o.type === 'gate') {
        const open = gateIsOpen(o);
        ctx.lineCap = 'round';
        let cursor = LEFT_WALL;
        for (const gapX of o.gaps) {
          ctx.strokeStyle = '#7C3AED';
          ctx.lineWidth = o.t;
          ctx.beginPath();
          ctx.moveTo(cursor, o.y);
          ctx.lineTo(gapX - o.gapW / 2, o.y);
          ctx.stroke();
          if (open) {
            ctx.strokeStyle = 'rgba(163,230,53,0.7)';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.moveTo(gapX - o.gapW / 2, o.y);
            ctx.lineTo(gapX + o.gapW / 2, o.y);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = '#F97316';
            ctx.lineWidth = o.t;
            ctx.beginPath();
            ctx.moveTo(gapX - o.gapW / 2, o.y);
            ctx.lineTo(gapX + o.gapW / 2, o.y);
            ctx.stroke();
          }
          cursor = gapX + o.gapW / 2;
        }
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = o.t;
        ctx.beginPath();
        ctx.moveTo(cursor, o.y);
        ctx.lineTo(RIGHT_WALL, o.y);
        ctx.stroke();
        ctx.font = '900 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(open ? '🟢' : '🔒', o.gaps[0], o.y - 30);
      } else if (o.type === 'tramp') {
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 11);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(o.x + i * 34, o.y + o.h / 2);
          ctx.lineTo(o.x + i * 34, o.y + o.h / 2 + 12);
          ctx.stroke();
        }
        ctx.font = '900 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🤸', o.x, o.y - 26);
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
          portalCoolMs: 0,
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

    ctx.restore();

    const progress = clamp((camYRef.current + height / scale) / courseMap.finishY, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(18, height - 20, width - 36, 8);
    ctx.fillStyle = '#A3E635';
    ctx.fillRect(18, height - 20, (width - 36) * progress, 8);

    const flashLeft = flashRef.current - performance.now();
    if (flashLeft > 0) {
      ctx.fillStyle = `rgba(255,255,255,${clamp(flashLeft / 280, 0, 1) * 0.75})`;
      ctx.fillRect(0, 0, width, height);
    }
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

  const onRaceEvent = (e: RaceEvent) => {
    if (e.kind === 'burst') {
      spawnBurst(e.x, e.y, e.color, e.count);
    } else if (e.kind === 'portal') {
      announce(`✨ ${e.runner.name} 포털 워프!`);
    } else if (e.kind === 'tramp') {
      if (e.launch > 900) announce(`🤸 ${e.runner.name} 대점프!`);
    } else if (e.kind === 'finish') {
      finishRef.current.push(runnersRef.current.indexOf(e.runner));
      if (finishRef.current.length === 1) {
        winSfx(soundEnabled);
        flashRef.current = performance.now() + 280;
        announce(`🏁 ${e.runner.name} 골인!`, true);
      } else if (finishRef.current.length <= 3) {
        announce(`🏁 ${e.runner.name} ${finishRef.current.length}등 골인!`);
      }
    }
  };

  const beginRace = () => {
    runnersRef.current = spawnRunners(active);
    finishRef.current = [];
    particlesRef.current = [];
    camYRef.current = -260;
    gateOpenRef.current = false;
    lastTimeRef.current = 0;
    lastLeaderRef.current = null;
    tickerRef.current = { text: '', until: 0, lastAt: 0 };
    slowmoRef.current = false;
    zoomRef.current = 1;
    raceStartRef.current = performance.now();
    setTimeout(() => {
      gateOpenRef.current = true;
    }, 900);

    const loop = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const rawDt = Math.min(32, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const selectedDone =
        settings.winMode === 'first' && finishRef.current.length >= winnerCount;

      const unfinishedNow = runnersRef.current.filter((r) => !r.finished);
      const frontRunner = [...unfinishedNow].sort((a, b) => b.y - a.y)[0];
      let slowmo = false;
      if (!fastForwardRef.current) {
        if (settings.winMode === 'first') {
          slowmo =
            finishRef.current.length === 0 &&
            !!frontRunner &&
            frontRunner.y > courseMap.finishY - 320;
        } else {
          slowmo =
            unfinishedNow.length === 1 &&
            unfinishedNow[0].y > courseMap.finishY - 320;
        }
      }
      slowmoRef.current = slowmo;
      zoomRef.current += ((slowmo ? 1.2 : 1) - zoomRef.current) * 0.1;

      const speedScale = fastForwardRef.current ? 4 : selectedDone ? 2.8 : settings.speed === 'fast' ? 1.45 : 1;
      const dt = rawDt * (slowmo ? 0.3 : speedScale);

      updateObstacles(courseMap.obstacles, dt);
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
      runnersRef.current.forEach((runner) =>
        stepRunner(runner, dt, meanY, {
          courseMap,
          gateOpen: gateOpenRef.current,
          emit: onRaceEvent,
        }),
      );

      const leader = runnersRef.current
        .filter((r) => !r.finished)
        .sort((a, b) => b.y - a.y)[0];
      const targetY = leader ? leader.y - 430 : courseMap.finishY - 760;
      camYRef.current += (clamp(targetY, -360, courseMap.finishY - 520) - camYRef.current) * 0.08;

      if (
        leader &&
        finishRef.current.length === 0 &&
        now - raceStartRef.current > 2500 &&
        leader.id !== lastLeaderRef.current
      ) {
        if (lastLeaderRef.current !== null) {
          announce(`🔥 ${leader.name} 선두로 치고 나갑니다!`);
        }
        lastLeaderRef.current = leader.id;
      }

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
        portalCoolMs: 0,
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
          {phase === 'racing' && tickerRef.current.until > performance.now() && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <span
                key={tickerRef.current.lastAt}
                className="pop-win rounded-full bg-pick-purple-950/85 px-5 py-2 text-sm font-black text-white sm:text-base"
              >
                {tickerRef.current.text}
              </span>
            </div>
          )}
          {phase === 'racing' && slowmoRef.current && (
            <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
              <span className="pixel-title pop-win text-2xl text-pick-pink-400 drop-shadow-[0_2px_0_rgba(47,25,84,0.7)] sm:text-3xl">
                📸 포토피니시!
              </span>
            </div>
          )}
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
