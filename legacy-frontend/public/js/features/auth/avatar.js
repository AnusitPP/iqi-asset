import { googleProfileImageUrl } from '/shared/features/auth/profile.js';
import { createElement } from '../../core/dom/elements.js';
export function createProfileAvatar(name, url) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toUpperCase();
  const avatar = createElement('span', 'profile-avatar', initials);
  avatar.setAttribute('aria-hidden', 'true');
  const source = googleProfileImageUrl(url);
  if (source) {
    const image = createElement('img');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = source;
    avatar.append(image);
  }
  return avatar;
}
