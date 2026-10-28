import express from 'express';
import { logError, safeMessage } from '../backend/src/utils/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(async (req, res, next) => {
  let runtime;
  try {
    runtime = await import('../backend/src/runtime.js');
  } catch (error) {
    logError(error, 'startup');
    return res
      .status(503)
      .set('Cache-Control', 'no-store')
      .json({ error: safeMessage(error) });
  }
  return runtime.app(req, res, next);
});
export default app;
