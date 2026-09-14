'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const INITIALIZED_ATTRIBUTE = 'data-profile-default-initialized';

function collapseNewProfileFolds(root: ParentNode | Element) {
  const folds: HTMLDetailsElement[] = [];

  if (root instanceof HTMLDetailsElement && root.classList.contains('dashboard-fold')) {
    folds.push(root);
  }

  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLDetailsElement>('details.dashboard-fold').forEach((details) => folds.push(details));
  }

  folds.forEach((details) => {
    if (details.hasAttribute(INITIALIZED_ATTRIBUTE)) return;
    details.open = false;
    details.setAttribute(INITIALIZED_ATTRIBUTE, 'true');
  });
}

/**
 * The bottom-nav Profile screen is /dashboard. Collapse every dashboard-fold
 * the first time it appears, including dynamically mounted analytics sections,
 * then leave the user's subsequent open/close choices alone.
 */
export default function DefaultCollapsedProfileTabs() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== '/dashboard') return;

    collapseNewProfileFolds(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) collapseNewProfileFolds(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
