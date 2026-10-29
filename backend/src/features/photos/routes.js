import express from 'express';
export function registerPhotosRoutes(app, { photos, maxUploadBytes }) {
  app.post(
    '/api/dashboard/:row/photos',
    express.raw({ type: 'application/octet-stream', limit: maxUploadBytes }),
    async (req, res, next) => {
      try {
        res.json(
          await photos.upload(
            Number(req.params.row),
            req.get('X-Record-Revision'),
            req.body,
            req.get('X-Photo-Type'),
          ),
        );
      } catch (e) {
        next(e);
      }
    },
  );
  app.get('/api/dashboard/:row/photos/:id', async (req, res, next) => {
    try {
      const bytes = await photos.read(Number(req.params.row), req.params.id);
      res.type('image/jpeg').send(Buffer.from(bytes));
    } catch (e) {
      next(e);
    }
  });
}
