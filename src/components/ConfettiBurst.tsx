import { useMemo } from 'react';

const COLORS = ['#BFFF22', '#FF6FCF', '#FFD84A', '#73F7C5', '#7551F2'];

export default function ConfettiBurst({ count = 60 }: { count?: number }) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 8,
        rot: Math.random() * 360,
        drift: (Math.random() - 0.5) * 180,
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute -top-4 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.w * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            transform: `rotate(${p.rot}deg)`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
