// Attaches the session token to every request that targets the local Parcel Tools backend,
// so individual pages don't each have to remember to send it.
const BACKEND_PREFIXES = ['http://localhost:5000/', 'http://127.0.0.1:5000/'];

const getToken = () => {
  try {
    return sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken') || '';
  } catch {
    return '';
  }
};

if (typeof window !== 'undefined' && !window.__authFetchInstalled) {
  window.__authFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (BACKEND_PREFIXES.some((p) => url.startsWith(p))) {
        const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        const token = getToken();
        if (token && !headers.has('X-Session-Token')) {
          headers.set('X-Session-Token', token);
        }
        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // fall through to the plain request
    }
    return originalFetch(input, init);
  };
}
