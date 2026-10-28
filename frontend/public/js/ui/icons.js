const paths = {
  refresh: 'M10 2l4 4-4 4M14 6H11a8 8 0 0 0-7 12M14 22l-4-4 4-4M10 18h3a8 8 0 0 0 7-12',
  logout: 'M9 4H4v16h5M13 8l4 4-4 4M9 12h12',
  arrow: 'M7 17 17 7M7 7h10v10',
  enter: 'M20 5v8a3 3 0 0 1-3 3H4m5-5-5 5 5 5',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
  sheet: 'M5 3h14v18H5zM8 7h8M8 11h8M8 15h8',
  copy: 'M9 9h11v11H9zM15 9V4H4v11h5',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  search: 'M17 17 21 21M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  pencil: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14z',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.75',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
    class: 'icon',
  }))
    svg.setAttribute(key, value);
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name] || paths.arrow);
  svg.append(path);
  return svg;
}
export function initializeIcons(root) {
  root
    .querySelectorAll('[data-icon]')
    .forEach((node) => node.replaceChildren(icon(node.dataset.icon)));
}
