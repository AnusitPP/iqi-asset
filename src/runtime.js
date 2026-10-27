import { config } from './config.js';
import { GoogleSheets } from './googleSheets.js';
import { Records } from './records.js';
import { createApp } from './app.js';
import { StateStore } from './state.js';
import { runtimeReadiness } from './readiness.js';

export const state = new StateStore();
export const adapter = new GoogleSheets(config);
adapter.state = state;
const service = new Records(adapter, config);
service.ready = runtimeReadiness(adapter);
export const app = createApp(service, { ...config, state });
