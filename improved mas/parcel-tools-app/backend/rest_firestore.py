"""Firestore over its public REST interface, authenticated as the signed-in USER (their Firebase ID token).

It offers the small part of the Firebase Admin SDK's Firestore API that this app uses, so `firebase_service` works
the same with or without the admin key. Because every request carries the user's own token, Firestore security
rules (firebase/firestore.rules) decide what that user may read and write - the customer's PC holds no admin power."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

_SIMPLE_SEGMENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
_OPS = {'==': 'EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN',
        '>=': 'GREATER_THAN_OR_EQUAL', '!=': 'NOT_EQUAL', 'array_contains': 'ARRAY_CONTAINS', 'in': 'IN'}


class FirestoreError(RuntimeError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class PermissionDenied(FirestoreError):
    pass


# ---------------------------------------------------------------- value encoding
def encode_value(v):
    if v is None:
        return {'nullValue': None}
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, int):
        return {'integerValue': str(v)}
    if isinstance(v, float):
        return {'doubleValue': v}
    if isinstance(v, datetime):
        return {'timestampValue': (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat().replace('+00:00', 'Z')}
    if isinstance(v, str):
        return {'stringValue': v}
    if isinstance(v, dict):
        return {'mapValue': {'fields': {str(k): encode_value(x) for k, x in v.items()}}}
    if isinstance(v, (list, tuple)):
        return {'arrayValue': {'values': [encode_value(x) for x in v]}}
    return {'stringValue': str(v)}


def decode_value(v):
    if 'nullValue' in v:
        return None
    if 'booleanValue' in v:
        return v['booleanValue']
    if 'integerValue' in v:
        return int(v['integerValue'])
    if 'doubleValue' in v:
        return float(v['doubleValue'])
    if 'stringValue' in v:
        return v['stringValue']
    if 'timestampValue' in v:
        return v['timestampValue']
    if 'mapValue' in v:
        return {k: decode_value(x) for k, x in (v['mapValue'].get('fields') or {}).items()}
    if 'arrayValue' in v:
        return [decode_value(x) for x in (v['arrayValue'].get('values') or [])]
    if 'referenceValue' in v:
        return v['referenceValue']
    return None


def _quote_segment(seg):
    return seg if _SIMPLE_SEGMENT.match(seg) else '`' + seg.replace('\\', '\\\\').replace('`', '\\`') + '`'


def _field_path(parts):
    return '.'.join(_quote_segment(p) for p in parts)


def _nest(parts, value, into):
    """Put `value` at the dotted path `parts` inside the plain dict `into`."""
    for p in parts[:-1]:
        into = into.setdefault(p, {})
    into[parts[-1]] = value


def _leaf_paths(data, prefix=()):
    """Field paths the way the Admin SDK's set(merge=True) sees them: nested maps are merged, empty maps are values."""
    out = []
    for k, v in data.items():
        if isinstance(v, dict) and v:
            out.extend(_leaf_paths(v, prefix + (k,)))
        else:
            out.append(prefix + (k,))
    return out


def _get_path(data, parts):
    cur = data
    for p in parts:
        cur = cur[p]
    return cur


class Snapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class RestFirestore:
    def __init__(self, project_id, token_provider, opener=None, timeout=15, api_key=None):
        self.project_id = project_id
        self.api_key = api_key
        self.token_provider = token_provider
        self._opener = opener or urllib.request.urlopen
        self.timeout = timeout
        self.base = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents'

    def collection(self, name):
        return CollectionRef(self, name)

    # -- transport
    def request(self, method, url, body=None, public_ok=False):
        """`public_ok`: documents that the rules make world-readable (app settings) may be read before sign-in."""
        headers = {'Content-Type': 'application/json'}
        try:
            headers['Authorization'] = f'Bearer {self.token_provider()}'
        except Exception as e:
            from user_auth import NoCredentials
            if not (public_ok and self.api_key and isinstance(e, NoCredentials)):
                raise
            url += ('&' if '?' in url else '?') + 'key=' + urllib.parse.quote(self.api_key)
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._opener(req, timeout=self.timeout) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode()).get('error', {}).get('message', '')
            except Exception:
                msg = ''
            if e.code in (401, 403):
                raise PermissionDenied(msg or 'Permission denied', e.code)
            if e.code == 404:
                raise FirestoreError(msg or 'Not found', 404)
            raise FirestoreError(msg or f'Firestore error {e.code}', e.code)


class DocumentRef:
    def __init__(self, client, collection, doc_id):
        self.client, self.collection_id, self.id = client, collection, doc_id
        self.url = f'{client.base}/{urllib.parse.quote(collection, safe="")}/{urllib.parse.quote(doc_id, safe="")}'

    def get(self):
        try:
            doc = self.client.request('GET', self.url, public_ok=(self.collection_id == 'app_config'))
        except FirestoreError as e:
            if e.status == 404:
                return Snapshot(self.id, None)
            raise
        return Snapshot(self.id, {k: decode_value(v) for k, v in (doc.get('fields') or {}).items()})

    def _patch(self, data, field_paths, must_exist=False):
        fields = {k: encode_value(v) for k, v in data.items()}
        qs = [('updateMask.fieldPaths', _field_path(p)) for p in field_paths] if field_paths is not None else []
        if must_exist:
            qs.append(('currentDocument.exists', 'true'))
        url = self.url + ('?' + urllib.parse.urlencode(qs) if qs else '')
        self.client.request('PATCH', url, {'fields': fields})

    def set(self, data, merge=False):
        if not merge:
            self._patch(data, None)                       # no mask: the document is replaced
            return
        self._patch(data, _leaf_paths(data))              # nested maps are merged, like the Admin SDK

    def update(self, fields):
        """Admin-SDK style: keys may be dotted paths ('devices.<id>.last_seen')."""
        nested, paths = {}, []
        for key, value in fields.items():
            parts = tuple(key.split('.'))
            _nest(list(parts), value, nested)
            paths.append(parts)
        self._patch(nested, paths, must_exist=True)

    def delete(self):
        self.client.request('DELETE', self.url)


class CollectionRef:
    def __init__(self, client, name, filters=None, max_results=None):
        self.client, self.name = client, name
        self._filters = list(filters or [])
        self._limit = max_results

    def document(self, doc_id):
        return DocumentRef(self.client, self.name, doc_id)

    def where(self, field=None, op=None, value=None, filter=None):  # noqa: A002  (same keyword as the Admin SDK)
        if filter is not None:
            field, op, value = filter.field_path, filter.op_string, filter.value
        if op not in _OPS:
            raise ValueError(f'Unsupported operator {op}')
        return CollectionRef(self.client, self.name, self._filters + [(field, op, value)], self._limit)

    def limit(self, n):
        return CollectionRef(self.client, self.name, self._filters, n)

    def stream(self):
        if self._filters or self._limit:
            return self._run_query()
        return self._list_all()

    def get(self):
        return list(self.stream())

    def _list_all(self):
        token = None
        while True:
            qs = [('pageSize', '300')] + ([('pageToken', token)] if token else [])
            page = self.client.request('GET', f'{self.client.base}/{urllib.parse.quote(self.name, safe="")}?'
                                              + urllib.parse.urlencode(qs))
            for d in page.get('documents') or []:
                yield Snapshot(d['name'].rsplit('/', 1)[-1], {k: decode_value(v) for k, v in (d.get('fields') or {}).items()})
            token = page.get('nextPageToken')
            if not token:
                return

    def _run_query(self):
        flt = [{'fieldFilter': {'field': {'fieldPath': _field_path(f.split('.'))}, 'op': _OPS[o], 'value': encode_value(v)}}
               for f, o, v in self._filters]
        q = {'from': [{'collectionId': self.name}]}
        if len(flt) == 1:
            q['where'] = flt[0]
        elif flt:
            q['where'] = {'compositeFilter': {'op': 'AND', 'filters': flt}}
        if self._limit:
            q['limit'] = self._limit
        rows = self.client.request('POST', f'{self.client.base}:runQuery', {'structuredQuery': q})
        for row in rows if isinstance(rows, list) else []:
            d = row.get('document')
            if d:
                yield Snapshot(d['name'].rsplit('/', 1)[-1], {k: decode_value(v) for k, v in (d.get('fields') or {}).items()})
