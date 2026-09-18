'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const INITIALIZED_ATTRIBUTE = 'data-profile-main-initialized';

function nestedSubTabs(main: HTMLDetailsElement) {
  return Array.from(main.querySelectorAll<HTMLDetailsElement>('details.dashboard-fold'))
    .filter((details) => details !== main);
}

function prepareSubTabs(main: HTMLDetailsElement) {
  const tabs = nestedSubTabs(main);
  tabs.forEach((details) => details.classList.add('profile-sub-fold'));
  if (!tabs.length || !main.open) return;

  const openTabs = tabs.filter((details) => details.open);
  const keep = openTabs[0] ?? tabs[0];
  tabs.forEach((details) => { details.open = details === keep; });
}

function prepareProfileDetails(root: ParentNode | Element) {
  const mains: HTMLDetailsElement[] = [];

  if (root instanceof HTMLDetailsElement && root.classList.contains('profile-main-fold')) mains.push(root);
  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLDetailsElement>('details.profile-main-fold').forEach((details) => mains.push(details));
  }

  mains.forEach((main) => {
    if (!main.hasAttribute(INITIALIZED_ATTRIBUTE)) {
      main.open = false;
      main.setAttribute(INITIALIZED_ATTRIBUTE, 'true');
    }
    prepareSubTabs(main);
  });

  const nearestMain = root instanceof Element
    ? root.closest<HTMLDetailsElement>('details.profile-main-fold')
    : null;
  if (nearestMain) prepareSubTabs(nearestMain);
}

/**
 * Profile & season is a fixed header. The four top-level Profile sections
 * start collapsed. Analytics uses an accordion: opening Performance Analytics
 * reveals one nested dashboard section at a time, and selecting another closes
 * its sibling sections. Activity cards are not dashboard folds and remain
 * independently collapsible.
 */
export default function DefaultCollapsedProfileTabs() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== '/dashboard') return;

    prepareProfileDetails(document);

    let internalToggle = false;
    const onToggle = (event: Event) => {
      if (internalToggle) return;
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;

      if (details.classList.contains('profile-main-fold')) {
        if (details.open) queueMicrotask(() => prepareSubTabs(details));
        return;
      }

      if (!details.classList.contains('dashboard-fold') || !details.open) return;
      const main = details.closest<HTMLDetailsElement>('details.profile-main-fold');
      if (!main) return;

      internalToggle = true;
      nestedSubTabs(main).forEach((sibling) => {
        sibling.classList.add('profile-sub-fold');
        if (sibling !== details) sibling.open = false;
      });
      queueMicrotask(() => { internalToggle = false; });
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
