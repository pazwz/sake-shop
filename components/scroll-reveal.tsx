'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    const register = (root: ParentNode) => {
      const elements = Array.from(
        root.querySelectorAll<HTMLElement>('[data-reveal]'),
      );
      if (root instanceof HTMLElement && root.matches('[data-reveal]')) {
        elements.push(root);
      }
      elements.forEach((element) => {
        if (element.classList.contains('is-revealed')) return;
        if (reducedMotion) element.classList.add('is-revealed');
        else observer.observe(element);
      });
    };
    register(document);
    const mutations = new MutationObserver((entries) => {
      entries.forEach((entry) => {
        entry.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) register(node);
        });
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
