'use client';

import { useEffect, useState } from 'react';

export function BrandLoader({ label = '読み込み中' }: { label?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 280);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`brand-loader ${visible ? 'brand-loader-visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="pour-scene" aria-hidden="true">
        <svg viewBox="0 0 220 150" className="kura-pour-mark" fill="none">
          <g
            className="pour-bottle"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M46 12h18v18c0 4 2 7 7 11 8 7 12 15 12 25v41c0 8-5 13-13 13H40c-8 0-13-5-13-13V66c0-10 4-18 12-25 5-4 7-7 7-11V12Z" />
            <path d="M44 20h22M40 45h30" />
            <rect x="36" y="70" width="38" height="27" rx="2" />
            <path d="M43 79h24M47 87h16" opacity=".55" />
          </g>
          <path
            className="pour-stream"
            d="M104 43c15 5 23 13 31 28"
            stroke="var(--gold)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <g
            className="tasting-glass"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M129 65h48c-1 18-4 31-10 38-4 5-9 7-14 7s-10-2-14-7c-6-7-9-20-10-38Z" />
            <path d="M153 110v18M140 136h26" />
            <path d="M132 72c12 2 30 2 42 0" opacity=".35" />
          </g>
          <path
            className="glass-fill"
            d="M135 88h36c-1.5 7-3.5 12-6 15-3 4-7 5.5-12 5.5s-9-1.5-12-5.5c-2.5-3-4.5-8-6-15Z"
          />
        </svg>
      </div>
      <p className="serif kura-loader-wordmark">KURA</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
