import { googleProfileImageUrl } from '../../../../../shared/features/auth/profile.js';
import { throwHttpError } from '../../../core/errors/errors.js';
import { matchesOAuthValue } from '../../../core/security/oauth-state.js';
import { createGoogleOAuthClient } from '../../../integrations/google/oauth/google-oauth.client.js';

export async function completeGoogleLogin(
  config,
  { code, state, expectedState, nonce, error },
  client = createGoogleOAuthClient(config),
) {
  if (!matchesOAuthValue(state, expectedState))
    throwHttpError(400, 'Google Login หมดอายุหรือ state ไม่ถูกต้อง กรุณาเริ่มใหม่');
  if (error) throwHttpError(400, 'การเข้าสู่ระบบ Google ถูกยกเลิก กรุณาเริ่มใหม่');
  if (typeof code !== 'string' || !code || code.length > 4096 || !matchesOAuthValue(nonce, nonce))
    throwHttpError(400, 'ข้อมูล Google Login ไม่ครบ กรุณาเริ่มใหม่');
  let identity;
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new Error();
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.clientId,
    });
    identity = ticket.getPayload();
  } catch {
    throwHttpError(401, 'ยืนยันตัวตนกับ Google ไม่สำเร็จ กรุณาเริ่มเข้าสู่ระบบใหม่');
  }
  if (
    !identity ||
    !matchesOAuthValue(identity.nonce, nonce) ||
    identity.email_verified !== true ||
    identity.hd !== config.allowedDomain ||
    typeof identity.sub !== 'string' ||
    !identity.sub ||
    typeof identity.email !== 'string' ||
    identity.email.split('@').length !== 2 ||
    identity.email.split('@')[1].toLowerCase() !== config.allowedDomain
  )
    throwHttpError(403, 'บัญชี Google ไม่ผ่านการยืนยันหรือไม่ใช่โดเมนที่อนุญาต');
  const avatar = googleProfileImageUrl(identity.picture);
  return {
    sub: identity.sub,
    email: identity.email,
    name: identity.name || '',
    ...(avatar ? { avatar_url: avatar } : {}),
  };
}
