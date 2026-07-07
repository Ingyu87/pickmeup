import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto bg-[#303c3c] px-4 py-6 text-center text-xs font-bold leading-relaxed text-white/75 sm:py-7 sm:text-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6">
          <span>© 2026 ingyu's AI world. All rights reserved.</span>
          <Link to="/terms" className="text-white no-underline hover:underline">
            이용약관
          </Link>
          <Link to="/privacy" className="text-white no-underline hover:underline">
            개인정보처리방침
          </Link>
        </div>
        <p>개인정보보호책임자: 백인규 교사 (서울가동초등학교) | 문의: 02-448-5766</p>
      </div>
    </footer>
  );
}
