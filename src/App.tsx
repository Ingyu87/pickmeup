import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ToastHost from './components/ToastHost';
import HubPage from './app/HubPage';
import LobbyPage from './app/LobbyPage';
import GamePage from './app/GamePage';
import ResultPage from './app/ResultPage';
import TermsPage from './app/TermsPage';
import PrivacyPage from './app/PrivacyPage';
import { useAppStore } from './stores/session';
import { showToast } from './lib/toast';
import { startBgm, stopBgm } from './lib/bgm';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const setPath = useAppStore((s) => s.setPath);
  const saveStatus = useAppStore((s) => s.saveStatus);
  const bgmEnabled = useAppStore((s) => s.bgmEnabled);
  const restoredOnce = useRef(false);

  useEffect(() => {
    if (bgmEnabled) startBgm();
    else stopBgm();
    return stopBgm;
  }, [bgmEnabled]);

  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;

    const s = useAppStore.getState();
    if (!s.restored) return;

    if (s.rosterText.trim()) showToast('이전 작업을 불러왔어요');

    if (location.pathname !== '/' || s.path === '/') return;
    if (s.path === '/result' && !s.lastResult) return;
    if (s.path.startsWith('/game/') && s.participants.length === 0) return;
    if (['/lobby', '/result'].includes(s.path) || s.path.startsWith('/game/')) {
      navigate(s.path, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPath(location.pathname);
  }, [location.pathname, setPath]);

  return (
    <div className="flex min-h-screen flex-col">
      {saveStatus === 'unavailable' && (
        <div className="bg-pick-yellow-400 px-4 py-2 text-center text-sm font-bold text-ink">
          ⚠️ 이 브라우저에서는 자동 저장이 제한돼요 — 시크릿 모드가 아닌지 확인해
          주세요. 명단은 새로고침하면 사라질 수 있어요.
        </div>
      )}
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HubPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/game/:id" element={<GamePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <ToastHost />
    </div>
  );
}
