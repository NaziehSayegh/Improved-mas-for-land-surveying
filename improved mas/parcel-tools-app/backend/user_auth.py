"""Firebase Authentication over REST, and the per-install store of the signed-in user's tokens.

The customer's PC never holds an admin key: it signs in as the user and keeps that user's refresh token (in the
app's own data folder) so the app can get a fresh ID token for Firestore without asking for the password again."""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

_REFRESH_MARGIN = 120  # seconds before expiry at which a new ID token is requested


class AccountGone(Exception):
    """Firebase says this user no longer exists, was disabled, or the sign-in was revoked."""


class NoCredentials(Exception):
    """Nobody is signed in on this PC (yet)."""


class AuthError(Exception):
    pass


class UserAuth:
    def __init__(self, api_key, data_dir, opener=None, clock=time.time):
        self.api_key = api_key
        self.path = os.path.join(data_dir, 'auth_state.json')
        self._opener = opener or urllib.request.urlopen
        self._clock = clock
        self._state = self._load()

    # -- persistence
    def _load(self):
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                s = json.load(f)
            if isinstance(s, dict) and isinstance(s.get('users'), dict):
                return s
        except (OSError, ValueError):
            pass
        return {'current_uid': None, 'users': {}}

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            tmp = self.path + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(self._state, f)
            try:
                os.chmod(tmp, 0o600)
            except OSError:
                pass
            os.replace(tmp, self.path)
        except OSError as e:
            print(f'[UserAuth] Could not save the sign-in state: {e}')

    # -- state
    def remember(self, uid, id_token, refresh_token, expires_in=3600):
        self._state['users'][uid] = {'id_token': id_token, 'refresh_token': refresh_token,
                                     'expires_at': self._clock() + int(expires_in or 3600)}
        self._state['current_uid'] = uid
        self._save()

    def forget(self, uid=None):
        uid = uid or self._state.get('current_uid')
        self._state['users'].pop(uid, None)
        if self._state.get('current_uid') == uid:
            self._state['current_uid'] = None
        self._save()

    @property
    def current_uid(self):
        return self._state.get('current_uid')

    def has_credentials(self):
        uid = self.current_uid
        return bool(uid and self._state['users'].get(uid, {}).get('refresh_token'))

    # -- tokens
    def id_token(self):
        uid = self.current_uid
        rec = self._state['users'].get(uid) if uid else None
        if not rec or not rec.get('refresh_token'):
            raise NoCredentials('Not signed in')
        if rec.get('id_token') and rec['expires_at'] - self._clock() > _REFRESH_MARGIN:
            return rec['id_token']
        return self._refresh(uid, rec)

    def _refresh(self, uid, rec):
        body = urllib.parse.urlencode({'grant_type': 'refresh_token', 'refresh_token': rec['refresh_token']}).encode()
        req = urllib.request.Request(f'https://securetoken.googleapis.com/v1/token?key={self.api_key}', data=body,
                                     headers={'Content-Type': 'application/x-www-form-urlencoded'})
        try:
            with self._opener(req, timeout=15) as resp:
                d = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode()).get('error', {}).get('message', '')
            except Exception:
                msg = ''
            if any(k in msg for k in ('USER_NOT_FOUND', 'USER_DISABLED', 'TOKEN_EXPIRED', 'INVALID_REFRESH_TOKEN')):
                self.forget(uid)
                raise AccountGone(msg)
            raise AuthError(msg or f'Token refresh failed ({e.code})')
        except (urllib.error.URLError, OSError) as e:
            raise AuthError(f'Network error: {e}')
        self.remember(uid, d['id_token'], d.get('refresh_token', rec['refresh_token']), d.get('expires_in', 3600))
        return d['id_token']

    # -- REST account calls
    def _call(self, endpoint, payload):
        req = urllib.request.Request(f'https://identitytoolkit.googleapis.com/v1/accounts:{endpoint}?key={self.api_key}',
                                     data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with self._opener(req, timeout=15) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode()).get('error', {}).get('message', '')
            except Exception:
                msg = ''
            raise AuthError(msg or f'Authentication failed ({e.code})')

    def sign_up(self, email, password):
        """Create the account and remember its tokens. Returns the uid."""
        d = self._call('signUp', {'email': email, 'password': password, 'returnSecureToken': True})
        self.remember(d['localId'], d['idToken'], d['refreshToken'], d.get('expiresIn', 3600))
        return d['localId']

    def delete_self(self):
        """Delete the signed-in user's own Firebase login (used to roll back a half-finished signup)."""
        self._call('delete', {'idToken': self.id_token()})
        self.forget()
