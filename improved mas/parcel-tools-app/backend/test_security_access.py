"""Regression tests: the local API requires a session token, a trusted Host/Origin,
and refuses to plant executables or write outside the intended archive names."""
import os, sys, tempfile, zipfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module  # noqa: E402
from test_support import authed_client  # noqa: E402

anon = app_module.app.test_client()
authed = authed_client(app_module)
TMP = tempfile.mkdtemp()

PROTECTED = [
    ('post', '/api/save-points-file', {'filePath': os.path.join(TMP, 'a.pnt'), 'content': 'x'}),
    ('post', '/api/reload-points-file', {'filePath': '/etc/hostname'}),
    ('post', '/api/check-file-modified', {'filePath': '/etc/hostname'}),
    ('post', '/api/project/load', {'filePath': '/etc/passwd'}),
    ('post', '/api/project/save', {'filePath': os.path.join(TMP, 'p'), 'projectData': {}}),
    ('post', '/api/compress-files', {'files': []}),
    ('post', '/api/calculate-area', {'points': []}),
    ('post', '/api/parse-cad', {'filePath': 'x.dxf'}),
    ('post', '/api/export-pdf', {}),
    ('post', '/api/ai/config', {'model': 'x'}),
    ('get', '/api/recent-files', None),
    ('get', '/api/debug/paths', None),
    ('get', '/api/projects', None),
    ('post', '/api/license/activate', {'license_key': 'k', 'email': 'e@x.com'}),
]


def test_all_data_endpoints_reject_anonymous():
    for method, path, body in PROTECTED:
        r = getattr(anon, method)(path, json=body) if body is not None else getattr(anon, method)(path)
        assert r.status_code == 401, f'{path} was reachable without a token ({r.status_code})'


def test_garbage_token_rejected():
    r = anon.get('/api/projects', headers={'X-Session-Token': 'a.b'})
    assert r.status_code == 401


def test_public_endpoints_still_open():
    assert anon.get('/api/health').status_code == 200
    assert anon.get('/api/license/status').status_code == 200
    assert anon.post('/api/auth/login', json={}).status_code == 400


def test_authenticated_calls_work():
    pts = [{'x': 0, 'y': 0}, {'x': 10, 'y': 0}, {'x': 10, 'y': 10}, {'x': 0, 'y': 10}]
    r = authed.post('/api/calculate-area', json={'points': pts})
    assert r.status_code == 200 and r.get_json()['area'] == 100.0
    p = os.path.join(TMP, 'ok.pnt')
    assert authed.post('/api/save-points-file', json={'filePath': p, 'content': '1,0,0\n'}).status_code == 200
    assert authed.post('/api/reload-points-file', json={'filePath': p}).get_json()['count'] == 1


def test_foreign_host_header_rejected():
    r = authed.get('/api/projects', headers={'Host': 'evil.example:5000'})
    assert r.status_code == 421


def test_cors_only_for_app_origins():
    def preflight(origin):
        return anon.options('/api/calculate-area', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type,x-session-token'})
    assert preflight('null').headers.get('Access-Control-Allow-Origin') == 'null'
    assert preflight('http://localhost:5173').headers.get('Access-Control-Allow-Origin') == 'http://localhost:5173'
    assert preflight('https://evil.example').headers.get('Access-Control-Allow-Origin') is None


def test_cannot_write_executables():
    for name in ('startup.bat', 'run.EXE', 'x.ps1', 'evil.js', 'link.lnk'):
        r = authed.post('/api/save-points-file', json={'filePath': os.path.join(TMP, name), 'content': 'x'})
        assert r.status_code == 400, name
        assert not os.path.exists(os.path.join(TMP, name))


def test_zip_slip_names_are_neutralised():
    out = os.path.join(TMP, 'o.zip')
    r = authed.post('/api/compress-files', json={'outputPath': out, 'files': [
        {'archiveName': '../../etc/cron.d/x', 'content': 'a'},
        {'archiveName': 'C:\\Windows\\evil.txt', 'content': 'b'}]})
    assert r.status_code == 200
    for n in zipfile.ZipFile(out).namelist():
        assert '..' not in n.split('/') and not n.startswith('/') and ':' not in n


def test_compress_output_must_be_zip():
    r = authed.post('/api/compress-files', json={'outputPath': os.path.join(TMP, 'x.bat'),
                                                 'files': [{'archiveName': 'a', 'content': 'a'}]})
    assert r.status_code == 400


def test_client_supplied_userid_is_ignored():
    r = authed.post('/api/ai/config?userId=someone-else', json={'model': 'm1'})
    assert r.status_code == 200
    assert app_module.load_ai_config().get('model') == 'm1'   # went to local storage, not that user's cloud record
