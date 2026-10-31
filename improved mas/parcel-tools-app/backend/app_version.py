"""Minimum-app-version policy ("forced update").

The admin sets a minimum version in Firestore (`app_config/release`). Every copy of the app reads it (cached, and
saved to disk so it is still enforced offline) and refuses to work while it is older than that minimum."""
import json
import os
import time

DEFAULT_DOWNLOAD_URL = 'https://github.com/NaziehSayegh/Improved-mas-for-land-surveying/releases/latest'
DEFAULT_MESSAGE = 'This version of Parcel Tools is no longer supported. Please install the latest version to continue.'
_CACHE_SECONDS = 300


def parse_version(text):
    """'2.0.23' -> (2, 0, 23); anything unparseable -> None (never blocks)."""
    try:
        parts = str(text).strip().lstrip('vV').split('-')[0].split('.')
        out = tuple(int(p) for p in parts)
        return out if out else None
    except (TypeError, ValueError):
        return None


def is_older(current, minimum):
    c, m = parse_version(current), parse_version(minimum)
    if c is None or m is None:
        return False
    n = max(len(c), len(m))
    return c + (0,) * (n - len(c)) < m + (0,) * (n - len(m))


class VersionPolicy:
    def __init__(self, firebase_service, data_dir, current_version):
        self.fs = firebase_service
        self.path = os.path.join(data_dir, 'min_version.json')
        self.current = current_version
        self._cache = None
        self._cache_time = 0.0

    def _read_disk(self):
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _write_disk(self, policy):
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path, 'w', encoding='utf-8') as f:
                json.dump(policy, f)
        except OSError:
            pass

    def get(self):
        """{'min_version', 'download_url', 'message'}; remote value when reachable, else the last one seen."""
        now = time.time()
        if self._cache is not None and now - self._cache_time < _CACHE_SECONDS:
            return self._cache
        policy = None
        try:
            if self.fs._is_online():
                doc = self.fs.db.collection('app_config').document('release').get()
                policy = doc.to_dict() if doc.exists else {}
                self._write_disk(policy)
        except Exception as e:
            print(f'[Version] Could not read the minimum version: {e}')
            policy = None
        if policy is None:
            policy = self._read_disk()
        self._cache, self._cache_time = policy or {}, now
        return self._cache

    def status(self):
        p = self.get()
        minimum = str(p.get('min_version') or '')
        return {
            'currentVersion': self.current,
            'minimumVersion': minimum,
            'updateRequired': bool(minimum) and is_older(self.current, minimum),
            'downloadUrl': p.get('download_url') or DEFAULT_DOWNLOAD_URL,
            'message': p.get('message') or DEFAULT_MESSAGE,
        }

    def set(self, min_version, download_url='', message=''):
        policy = {'min_version': min_version, 'download_url': download_url or DEFAULT_DOWNLOAD_URL,
                  'message': message or DEFAULT_MESSAGE, 'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        if self.fs._is_online():
            self.fs.db.collection('app_config').document('release').set(policy)
        self._write_disk(policy)
        self._cache, self._cache_time = policy, time.time()
        return policy
