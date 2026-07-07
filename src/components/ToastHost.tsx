import { useEffect, useState } from 'react';
import { TOAST_EVENT } from '../lib/toast';

interface ToastItem {
  id: number;
  message: string;
}

let seq = 0;

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      const id = ++seq;
      setToasts((t) => [...t, { id, message }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 4000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up pointer-events-auto rounded-2xl bg-ink-purple px-5 py-3 text-base font-bold text-white shadow-xl"
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
