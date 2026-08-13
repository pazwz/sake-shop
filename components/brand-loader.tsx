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
        <svg viewBox="0 0 180 120" className="h-28 w-44">
          <g className="pour-bottle" fill="none" stroke="currentColor">
            <path d="M30 22h19v12l7 8v44c0 6-4 10-10 10H27c-6 0-10-4-10-10V42l7-8V22h6Z" />
            <path d="M25 35h23" />
          </g>
          <path
            className="pour-stream"
            d="M59 59c21 5 27 19 34 34"
            fill="none"
            stroke="currentColor"
          />
          <g fill="none" stroke="currentColor">
            <path d="M101 59h45l-5 38c-.5 5-4 8-9 8h-17c-5 0-8.5-3-9-8l-5-38Z" />
            <path d="M108 88h31" />
            <path d="M123 105v10m-12 0h24" />
          </g>
          <path className="glass-fill" d="M108 88h31l-1.2 9h-28.6Z" />
        </svg>
      </div>
      <p className="serif mt-1 tracking-[.24em]">KURA</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
