import { readApiResponse } from './response.js';
export function createApiClient(onUnauthorized) {
  let csrfToken = '';
  return {
    getCsrf: () => csrfToken,
    setCsrf: (value) => {
      csrfToken = value;
    },
    async request(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-IQI-Request': csrfToken,
          ...options.headers,
        },
      });
      if (response.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized();
      return readApiResponse(response);
    },
  };
}
