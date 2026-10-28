import { config } from './config/config.js';
import { GoogleSheets } from './integrations/google/googleSheets.js';
import { Records } from './services/records.js';
import { createApp } from './http/app.js';
import { StateStore } from './utils/state.js';
import { runtimeReadiness } from './readiness.js';

export const state = new StateStore();
export const adapter = new GoogleSheets(config);
adapter.state = state;
const service = new Records(adapter, config);
service.ready = runtimeReadiness(adapter);
export const app = createApp(service, { ...config, state });
