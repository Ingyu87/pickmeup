import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

interface LottieProps {
  animationData: object;
  loop?: boolean;
  className?: string;
}

interface LazyLottieProps {
  src: string;
  loop?: boolean;
  className?: string;
  fallback?: ReactNode;
}

type LottieModule = {
  default?: ComponentType<LottieProps> | { default?: ComponentType<LottieProps> };
};

/**
 * public/lottie/<game>/<scene>/lottie.json을 lazy load해서 재생한다.
 * 에셋이 없거나 reduced-motion이면 fallback을 보여주고,
 * lottie-react 번들은 JSON이 실제로 존재할 때만 동적 로드한다.
 */
export default function LazyLottie({
  src,
  loop = false,
  className,
  fallback = null,
}: LazyLottieProps) {
  const [data, setData] = useState<object | null>(null);
  const [Player, setPlayer] = useState<ComponentType<LottieProps> | null>(null);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? (r.json() as Promise<object>) : null))
      .then((d) => {
        if (!alive || !d) return;
        setData(d);
        return import('lottie-react').then((m) => {
          const mod = m as LottieModule;
          const component =
            typeof mod.default === 'function' ? mod.default : mod.default?.default;
          if (alive && component) setPlayer(() => component);
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src, reduced]);

  if (reduced || !data || !Player) return <>{fallback}</>;
  return <Player animationData={data} loop={loop} className={className} />;
}
