'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const INITIALIZED_ATTRIBUTE = 'data-profile-default-initialized';
const DEFAULT_OPEN_SUMMARY = 'Profile & season';

function initializeProfileFolds(root: ParentNode | Element) {
  const folds: HTMLDetailsElement[] = [];

  if (root instanceof HTMLDetailsElement && root.classList.contains('dashboard-fold')) {
    folds.push(root);
  }

  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLDetailsElement>('details.dashboard-fold').forEach((details) => folds.push(details));
  }

  folds.forEach((details) => {
    if (details.hasAttribute(INITIALIZED_ATTRIBUTE)) return;
    const summary = details.querySelector(':scope > summary')?.textContent?.trim();
    details.open = summary === DEFAULT_OPEN_SUMMARY;
    details.setAttribute(INITIALIZED_ATTRIBUTE, 'true');
  });
}

/**
 * The bottom-nav Profile screen is /dashboard. Open only Profile & season the
 * first time each fold appears; every other current or dynamically mounted
 * dashboard fold starts collapsed. Subsequent user open/close choices are left
 * untouched.
 */
export default function DefaultCollapsedProfileTabs() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== '/dashboard') return;

    initializeProfileFolds(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) initializeProfileFolds(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
