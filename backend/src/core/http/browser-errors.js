export function redirectBrowserErrors(frontendOrigin = '') {
  return (req, res, next) => {
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
