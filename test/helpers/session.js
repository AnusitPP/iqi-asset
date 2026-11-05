import { TestAuthStorage } from './authStorage.js';
import { SheetSessionService } from '../../backend/src/features/auth/services/session.service.js';

export async function testSession(config = {}) {
  const authStorage = new TestAuthStorage();
  const identity = { sub: 'fixture-owner', email: 'owner@example.invalid', name: 'Fixture Owner' };
  const authConfig = {
    ...config,
    authStorage,
    bootstrapSuperAdminEmail: identity.email,
    confirmLoan: async () => 'sent',
  };
  const sessions = new SheetSessionService(authStorage, authConfig);
  const token = await sessions.login(identity);
  return {
    config: authConfig,
    storage: authStorage,
    sessions,
    token,
    cookie: `iqi_session=${token}`,
  };
}
