'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const INITIALIZED_ATTRIBUTE = 'data-profile-main-initialized';

function expandNestedSubTabs(main: HTMLDetailsElement) {
  main.querySelectorAll<HTMLDetailsElement>('details.dashboard-fold').forEach((details) => {
    if (details === main) return;
    details.classList.add('profile-sub-fold');
    details.open = true;
  });
}

function prepareProfileDetails(root: ParentNode | Element) {
  const detailsNodes: HTMLDetailsElement[] = [];

  if (root instanceof HTMLDetailsElement) detailsNodes.push(root);
  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => detailsNodes.push(details));
  }

  detailsNodes.forEach((details) => {
    if (details.classList.contains('profile-main-fold')) {
      if (!details.hasAttribute(INITIALIZED_ATTRIBUTE)) {
        details.open = false;
        details.setAttribute(INITIALIZED_ATTRIBUTE, 'true');
      }
      if (details.open) expandNestedSubTabs(details);
      return;
    }

    const main = details.closest<HTMLDetailsElement>('details.profile-main-fold');
    if (main && details.classList.contains('dashboard-fold')) {
      details.classList.add('profile-sub-fold');
      if (main.open) details.open = true;
    }
  });
}

/**
 * Profile & season is now a fixed page header. The four top-level Profile
 * sections start collapsed. Opening one expands its dashboard sub-tabs as
 * they mount, while unrelated details (for example individual activity cards)
 * keep their own open/closed state.
 */
export default function DefaultCollapsedProfileTabs() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== '/dashboard') return;

    prepareProfileDetails(document);

    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (!details.classList.contains('profile-main-fold') || !details.open) return;
      queueMicrotask(() => expandNestedSubTabs(details));
    };

    document.addEventListener('toggle', onToggle, true);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) prepareProfileDetails(node);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener('toggle', onToggle, true);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
