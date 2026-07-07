import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/session';

export default function Header() {
  const className = useAppStore((s) => s.className);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const location = useLocation();

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <header className="flex items-center gap-3 bg-pick-purple-950 px-4 py-3 text-white sm:px-6">
      <Link to="/" className="flex items-baseline gap-2 no-underline">
        <span className="pixel-title text-2xl text-pick-lime-400 sm:text-3xl">
          픽미업!
        </span>
        <span className="hidden text-xs font-bold text-white/60 sm:inline">
          Pick Me Up!
        </span>
      </Link>

      {className && (
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
          {className}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {location.pathname !== '/' && (
          <Link
            to="/"
            className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-2 text-sm font-extrabold text-white no-underline hover:bg-white/20"
          >
            처음으로
          </Link>
        )}
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-xl border-2 border-white/30 bg-white/10 px-3 py-2 text-sm font-extrabold hover:bg-white/20"
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? '🔊 소리 켬' : '🔇 소리 끔'}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="hidden rounded-xl border-2 border-white/30 bg-white/10 px-3 py-2 text-sm font-extrabold hover:bg-white/20 sm:inline-flex"
        >
          ⛶ 전체화면
        </button>
      </div>
    </header>
  );
}
