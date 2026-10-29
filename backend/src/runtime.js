import { config } from './core/config/config.js';
import { GoogleSheets } from './integrations/google/googleSheets.js';
import { Records } from './features/records/service.js';
import { createApp } from './http/app.js';
import { StateStore } from './core/state/stateStore.js';
import { runtimeReadiness } from './readiness.js';

export const state = new StateStore();
export const adapter = new GoogleSheets(config);
adapter.state = state;
const service = new Records(adapter, config);
service.ready = runtimeReadiness(adapter);
export const app = createApp(service, { ...config, state });
