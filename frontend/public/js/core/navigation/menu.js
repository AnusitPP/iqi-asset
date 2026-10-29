import { selectElement } from '../dom/elements.js';
export function initializeWorkspaceMenu() {
  const workspaceNavigation = selectElement('#workspace-navigation');
  const workspaceMenuButton = selectElement('#workspace-menu-button');
  const workspaceDesktop = window.matchMedia('(min-width: 1024px)');
  let workspaceCloseTimer;
  function closeWorkspaceMenu() {
    if (workspaceDesktop.matches || !workspaceNavigation.open || workspaceCloseTimer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      workspaceNavigation.close();
      return;
    }
    workspaceNavigation.classList.add('is-closing');
    workspaceCloseTimer = window.setTimeout(() => {
      workspaceCloseTimer = undefined;
      workspaceNavigation.classList.remove('is-closing');
      workspaceNavigation.close();
    }, 180);
  }
  function syncWorkspaceLayout() {
    window.clearTimeout(workspaceCloseTimer);
    workspaceCloseTimer = undefined;
    workspaceNavigation.classList.remove('is-closing');
    workspaceNavigation.close();
    workspaceNavigation.setAttribute('role', workspaceDesktop.matches ? 'navigation' : 'dialog');
    // Desktop navigation is part of the page and must not take focus on entry.
    if (workspaceDesktop.matches) workspaceNavigation.setAttribute('open', '');
  }
  syncWorkspaceLayout();
  workspaceDesktop.addEventListener('change', syncWorkspaceLayout);
  workspaceMenuButton.addEventListener('click', () => {
    workspaceNavigation.showModal();
    workspaceMenuButton.setAttribute('aria-expanded', 'true');
  });
  selectElement('#workspace-menu-close').addEventListener('click', closeWorkspaceMenu);
  workspaceNavigation.addEventListener('click', (event) => {
    const bounds = workspaceNavigation.getBoundingClientRect();
    if (
      !workspaceDesktop.matches &&
      (event.target.closest('.workspace-tab') ||
        (event.target === workspaceNavigation &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)))
    ) {
      closeWorkspaceMenu();
    }
  });
  workspaceNavigation.addEventListener('close', () => {
    workspaceMenuButton.setAttribute('aria-expanded', 'false');
    if (!workspaceDesktop.matches) workspaceMenuButton.focus();
  });

  workspaceNavigation.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeWorkspaceMenu();
  });
}
