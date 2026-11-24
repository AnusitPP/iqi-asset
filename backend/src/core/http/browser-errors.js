export function redirectBrowserErrors(frontendOrigin = '') {
  return (req, res, next) => {
    const path = req.originalUrl.split('?')[0];
    if (!['/api/auth/google', '/api/auth/google/callback'].includes(path)) return next();
    const json = res.json;
    res.json = function (body) {
      const document =
        req.get('sec-fetch-dest') === 'document' ||
        (req.get('accept')?.includes('text/html') && !req.get('X-IQI-Request'));
      if (this.statusCode >= 400 && document) return this.redirect(303, `${frontendOrigin}/error`);
      return json.call(this, body);
    };
    next();
  };
}
