export const SESSION_LIFETIME_MS = 30 * 60 * 1000;
export function sessionCookieOptions(config, req) {
  return {
    httpOnly: true,
    secure:
      config.hosted ||
      req.secure ||
      config.publicOrigin?.startsWith('https://') ||
      process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
