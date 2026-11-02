import { icon } from '../components/icons.js';
export const selectElement = (selector) => document.querySelector(selector);
export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
export function createButton(text, className, onClick, iconName) {
  const button = createElement('button', className, text);
  button.type = 'button';
  button.addEventListener('click', onClick);
  if (iconName) button.append(icon(iconName));
  return button;
}
