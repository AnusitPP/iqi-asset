import { createProfileAvatar } from './avatar.js';
export function renderSignedInProfile(user) {
  const profile = document.querySelector('#auth-user-profile');
  const name = document.querySelector('#auth-user-name');
  const role = document.querySelector('#auth-user-role');
  const avatar = document.querySelector('#auth-user-avatar');
  profile.hidden = !user;
  name.textContent = user?.name || '';
  role.textContent = user?.role || '';
  avatar.replaceChildren();
  if (user) avatar.append(createProfileAvatar(user.name || user.email, user.avatar_url));
}
