'use client';

import { Lottie } from 'lottie-react';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';

export function BrandLoader({ label = '読み込み中' }: { label?: string }) {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 280);
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    updateMotionPreference();
    motionQuery.addEventListener('change', updateMotionPreference);
    return () => {
      window.clearTimeout(timer);
      motionQuery.removeEventListener('change', updateMotionPreference);
    };
  }, []);

  return (
    <div
      className={`brand-loader ${visible ? 'brand-loader-visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="linxas-loading-animation" aria-hidden="true">
        <Lottie
          src="/animations/wine-loading.json"
          autoplay={!reducedMotion}
          loop={!reducedMotion}
        />
      </div>
      <BrandLogo variant="loading" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
