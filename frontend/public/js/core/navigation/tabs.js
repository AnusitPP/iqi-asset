import { selectElement } from '../dom/elements.js';
export function initializeWorkspaceTabs(onPageChanged) {
  const panel = selectElement('#dashboard-panel'),
    searchTab = selectElement('#search-tab'),
    dashboardTab = selectElement('#dashboard-tab');
  const searchSections = () =>
    document.querySelectorAll('main>.intro,main>.search-card,main>#results,main>#page-error');
  function show(which) {
    const active = which === 'dashboard';
    panel.hidden = !active;
    document.querySelector('#loans-panel').hidden = which !== 'loans';
    document.querySelector('#returns-panel').hidden = which !== 'returns';
    const returnsTab = document.querySelector('#returns-tab');
    returnsTab.classList.toggle('active', which === 'returns');
    returnsTab.setAttribute('aria-pressed', String(which === 'returns'));
    const loansTab = document.querySelector('#loans-tab');
    loansTab.classList.toggle('active', which === 'loans');
    loansTab.setAttribute('aria-pressed', String(which === 'loans'));
    searchSections().forEach((element) => {
      if (element.id !== 'page-error' || which !== 'search') element.hidden = which !== 'search';
    });
    searchTab.classList.toggle('active', which === 'search');
    dashboardTab.classList.toggle('active', active);
    searchTab.setAttribute('aria-pressed', String(which === 'search'));
    dashboardTab.setAttribute('aria-pressed', String(active));
    onPageChanged(which);
  }

  for (const page of ['loans', 'returns', 'search', 'dashboard'])
    selectElement('#' + page + '-tab').addEventListener('click', () => show(page));
  return { show };
}
