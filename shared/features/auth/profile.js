export const GOOGLE_PROFILE_IMAGE_ORIGINS = Object.freeze([
  'https://lh3.googleusercontent.com',
  'https://lh4.googleusercontent.com',
  'https://lh5.googleusercontent.com',
  'https://lh6.googleusercontent.com',
]);
export function googleProfileImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    return GOOGLE_PROFILE_IMAGE_ORIGINS.includes(url.origin) && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
