// When was an account last active?
// The app keeps people signed in, so `last_login` is only the last time they typed their password.
// Each PC also records `last_seen` every time the app starts (see the backend's add_device), which is the real
// "last seen". Use the newest of all of them.

const toMs = (value) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Newest activity time of a user as milliseconds, or null when there is none. */
export function lastSeenMs(user) {
  if (!user || typeof user !== 'object') return null;
  const times = [toMs(user.last_login)];
  if (user.devices && typeof user.devices === 'object') {
    for (const dev of Object.values(user.devices)) {
      if (dev && typeof dev === 'object') times.push(toMs(dev.last_seen));
    }
  }
  const real = times.filter((t) => t !== null);
  return real.length ? Math.max(...real) : null;
}
