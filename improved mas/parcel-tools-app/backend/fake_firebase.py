"""An in-memory stand-in for Firestore's REST API and Firebase Auth's REST API, for tests (no network needed)."""
import io
import json
import urllib.error
import urllib.parse

from rest_firestore import decode_value, encode_value


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _http_error(url, code, message):
    body = json.dumps({'error': {'message': message}}).encode()
    return urllib.error.HTTPError(url, code, message, {}, io.BytesIO(body))


def _split_path(path):
    """'a.`b-c`.d' -> ['a', 'b-c', 'd']"""
    out, cur, i, quoted = [], '', 0, False
    while i < len(path):
        ch = path[i]
        if quoted:
            if ch == '\\':
                i += 1; cur += path[i]
            elif ch == '`':
                quoted = False
            else:
                cur += ch
        elif ch == '`':
            quoted = True
        elif ch == '.':
            out.append(cur); cur = ''
        else:
            cur += ch
        i += 1
    out.append(cur)
    return out


class FakeFirestore:
    def __init__(self, project='demo', allow=None):
        self.project = project
        self.docs = {}                 # 'users/abc' -> dict
        self.requests = []             # (method, url, body, token)
        self.allow = allow             # optional callable(method, collection, doc_id, token) -> bool
        self.token_ok = lambda t: bool(t)
        self.rules = None              # optional callable(ctx) -> bool, models firestore.rules

    # urlopen replacement
    def __call__(self, req, timeout=None):
        url, method = req.full_url, req.get_method()
        token = (req.get_header('Authorization') or '').replace('Bearer ', '')
        body = json.loads(req.data) if req.data else None
        self.requests.append((method, url, body, token))
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.split('/documents', 1)[1] if '/documents' in parsed.path else ''
        qs = urllib.parse.parse_qs(parsed.query)
        anonymous = not token and 'key' in qs
        if not anonymous and not self.token_ok(token):
            raise _http_error(url, 401, 'UNAUTHENTICATED')
        if path.endswith(':runQuery'):
            self._check(dict(kind='query', parts=[body['structuredQuery']['from'][0]['collectionId']], token=token, body=body, qs=qs, existing=None), url)
            return self._query(body, url, token)
        parts = [urllib.parse.unquote(p) for p in path.strip('/').split('/') if p]
        if self.allow and not self.allow(method, parts[0] if parts else '', parts[1] if len(parts) > 1 else None, token):
            raise _http_error(url, 403, 'Missing or insufficient permissions.')
        key = '/'.join(parts)
        kind = {'GET': 'list' if len(parts) == 1 else 'get', 'DELETE': 'delete'}.get(method)
        if method == 'PATCH':
            kind = 'update' if key in self.docs else 'create'
        self._check(dict(kind=kind, parts=parts, token=token, body=body, qs=qs, existing=self.docs.get(key), anonymous=anonymous), url)
        if len(parts) == 1 and method == 'GET':
            return self._list(parts[0], qs, url)
        key = '/'.join(parts)
        if method == 'GET':
            if key not in self.docs:
                raise _http_error(url, 404, 'Document not found')
            return _Resp(json.dumps(self._doc(key)).encode())
        if method == 'DELETE':
            self.docs.pop(key, None)
            return _Resp(b'{}')
        if method == 'PATCH':
            incoming = {k: decode_value(v) for k, v in (body.get('fields') or {}).items()}
            masks = qs.get('updateMask.fieldPaths')
            if qs.get('currentDocument.exists') == ['true'] and key not in self.docs:
                raise _http_error(url, 404, 'No document to update')
            if not masks:
                self.docs[key] = incoming
            else:
                doc = self.docs.setdefault(key, {})
                for m in masks:
                    p = _split_path(m)
                    try:
                        val = incoming
                        for seg in p:
                            val = val[seg]
                    except (KeyError, TypeError):
                        continue
                    cur = doc
                    for seg in p[:-1]:
                        cur = cur.setdefault(seg, {})
                    cur[p[-1]] = val
            return _Resp(json.dumps(self._doc(key)).encode())
        raise _http_error(url, 400, 'Unsupported')

    def _check(self, ctx, url):
        if self.rules is None:
            return
        ctx.setdefault('anonymous', False)
        if not self.rules(ctx):
            raise _http_error(url, 403, 'Missing or insufficient permissions.')

    def _doc(self, key):
        return {'name': f'projects/{self.project}/databases/(default)/documents/{key}',
                'fields': {k: encode_value(v) for k, v in self.docs[key].items()}}

    def _list(self, coll, qs, url):
        keys = sorted(k for k in self.docs if k.startswith(coll + '/') and k.count('/') == 1)
        size = int(qs.get('pageSize', ['300'])[0])
        start = int(qs.get('pageToken', ['0'])[0])
        page = keys[start:start + size]
        out = {'documents': [self._doc(k) for k in page]}
        if start + size < len(keys):
            out['nextPageToken'] = str(start + size)
        return _Resp(json.dumps(out).encode())

    def _query(self, body, url, token):
        q = body['structuredQuery']
        coll = q['from'][0]['collectionId']
        flts = []
        w = q.get('where')
        if w:
            flts = [w['fieldFilter']] if 'fieldFilter' in w else [f['fieldFilter'] for f in w['compositeFilter']['filters']]
        rows = []
        for k in sorted(self.docs):
            if not k.startswith(coll + '/') or k.count('/') != 1:
                continue
            ok = True
            for f in flts:
                val = self.docs[k]
                try:
                    for seg in _split_path(f['field']['fieldPath']):
                        val = val[seg]
                except (KeyError, TypeError):
                    ok = False; break
                ok = ok and f['op'] == 'EQUAL' and val == decode_value(f['value'])
            if ok:
                rows.append({'document': self._doc(k)})
        if q.get('limit'):
            rows = rows[:q['limit']]
        return _Resp(json.dumps(rows or [{}]).encode())


class FakeAuth:
    """Firebase Auth REST: accounts:signUp / delete and securetoken refresh."""
    def __init__(self):
        self.users = {}         # uid -> {'email','password','refresh','id'}
        self.counter = 0
        self.calls = []

    def __call__(self, req, timeout=None):
        url = req.full_url
        self.calls.append(url)
        if 'securetoken.googleapis.com' in url:
            form = urllib.parse.parse_qs(req.data.decode())
            rt = form['refresh_token'][0]
            for uid, u in self.users.items():
                if u['refresh'] == rt and not u.get('gone'):
                    self.counter += 1
                    u['id'] = f'id-{uid}-{self.counter}'
                    return _Resp(json.dumps({'id_token': u['id'], 'refresh_token': rt, 'expires_in': '3600'}).encode())
            raise _http_error(url, 400, 'USER_NOT_FOUND')
        body = json.loads(req.data)
        if 'accounts:signUp' in url:
            if any(u['email'] == body['email'] for u in self.users.values()):
                raise _http_error(url, 400, 'EMAIL_EXISTS')
            self.counter += 1
            uid = f'uid{self.counter}'
            self.users[uid] = {'email': body['email'], 'password': body['password'], 'refresh': f'rt-{uid}', 'id': f'id-{uid}-0'}
            return _Resp(json.dumps({'localId': uid, 'idToken': f'id-{uid}-0', 'refreshToken': f'rt-{uid}', 'expiresIn': '3600'}).encode())
        if 'accounts:delete' in url:
            for uid, u in list(self.users.items()):
                if u['id'] == body['idToken']:
                    del self.users[uid]
                    return _Resp(b'{}')
            raise _http_error(url, 400, 'INVALID_ID_TOKEN')
        raise _http_error(url, 400, 'UNSUPPORTED')
