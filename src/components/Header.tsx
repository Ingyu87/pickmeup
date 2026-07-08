import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/session';

export default function Header() {
  const className = useAppStore((s) => s.className);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const toggleSound = useAppStore((s) => s.toggleSound);
  const bgmEnabled = useAppStore((s) => s.bgmEnabled);
  const toggleBgm = useAppStore((s) => s.toggleBgm);
  const location = useLocation();

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <header className="flex flex-wrap items-center gap-2 bg-pick-purple-950 px-3 py-3 text-white sm:gap-3 sm:px-6">
      <Link to="/" className="flex min-w-0 items-baseline gap-2 no-underline">
        <span className="pixel-title text-xl text-pick-lime-400 sm:text-3xl">
          픽미업!
        </span>
        <span className="hidden text-xs font-bold text-white/60 sm:inline">
          Pick Me Up!
        </span>
      </Link>

      {className && (
        <span className="max-w-[9rem] truncate rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold sm:max-w-none sm:px-3 sm:text-sm">
          {className}
        </span>
      )}

      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        {location.pathname !== '/' && (
          <Link
            to="/"
            className="rounded-xl border-2 border-white/30 bg-white/10 px-2.5 py-2 text-xs font-extrabold text-white no-underline hover:bg-white/20 sm:px-3 sm:text-sm"
          >
            처음으로
          </Link>
        )}
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-xl border-2 border-white/30 bg-white/10 px-2.5 py-2 text-xs font-extrabold hover:bg-white/20 sm:px-3 sm:text-sm"
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? '🔊 켬' : '🔇 끔'}
        </button>
        <button
          type="button"
          onClick={toggleBgm}
          className="rounded-xl border-2 border-white/30 bg-white/10 px-2.5 py-2 text-xs font-extrabold hover:bg-white/20 sm:px-3 sm:text-sm"
          aria-pressed={bgmEnabled}
        >
          {bgmEnabled ? '🎵 BGM' : '🎵 끔'}
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
