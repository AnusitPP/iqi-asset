import express from 'express';
import os from 'node:os';
import { lanAddresses } from '../network/addresses.js';
export function configureRequestSecurity(app, config, csrf) {
  const hosts = new Set([
    'localhost',
    '127.0.0.1',
    '[::1]',
    os.hostname().toLowerCase(),
    ...lanAddresses(),
    config.host,
    ...(config.allowedHosts || []),
  ]);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    try {
      const host = new URL(`http://${req.get('host')}`).hostname.toLowerCase();
      if (!hosts.has(host))
        return res
          .status(403)
          .json({ error: 'ไม่อนุญาต hostname นี้ กรุณาเปิดผ่าน localhost หรือ IP ของเครื่อง' });
      next();
    } catch {
      res.status(400).json({ error: 'Host ไม่ถูกต้อง' });
    }
  });
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
      if (req.get('X-IQI-Request') !== csrf)
        return res.status(403).json({ error: 'คำขอไม่ถูกต้อง กรุณาโหลดหน้าเว็บใหม่' });
      if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`)
        return res.status(403).json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' });
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
}
