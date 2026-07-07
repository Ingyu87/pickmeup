import LazyLottie from './lottie/LazyLottie';

interface RobotFigureProps {
  scene: 'guide' | 'celebrate' | 'empty-state';
  className?: string;
}

/** Lottie 에셋이 준비되면 자동으로 교체되고, 그 전엔 확정 마스코트 이미지를 보여준다. */
export default function RobotFigure({ scene, className = '' }: RobotFigureProps) {
  return (
    <LazyLottie
      src={`/lottie/robot/${scene}/lottie.json`}
      loop={scene !== 'celebrate'}
      className={className}
      fallback={
        <img
          src="/robot/hero.png"
          alt="픽미업 로봇 도우미"
          className={`bob select-none ${className}`}
          draggable={false}
        />
      }
    />
  );
}
