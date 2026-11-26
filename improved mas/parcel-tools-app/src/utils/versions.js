// App version helpers (shared by the Admin Console).

const parts = (v) => String(v || '').replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);

/** < 0 when a is older than b, > 0 when newer, 0 when equal. Accepts "2.0.26" and "v2.0.26". */
export function compareVersions(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * The newest version we know exists: the newest one any user reported, but never lower than `floor`
 * (the copy the admin is running now, which is known to exist). Without the floor, if nobody has updated yet the
 * Admin Console would call the newest *reported* version "latest" and flag nobody as outdated.
 */
export function newestVersion(users, floor = '') {
  let best = floor || '';
  for (const u of users || []) {
    const v = u && u.app_version;
    if (v && (!best || compareVersions(v, best) > 0)) best = v;
  }
  return best;
}
