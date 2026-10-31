"""Forced update: minimum app version enforced by the backend."""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
os.environ.pop('PARCEL_TOOLS_VERSION', None)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
import app as app_module  # noqa: E402
from app_version import parse_version, is_older, VersionPolicy  # noqa: E402
from test_support import authed_client  # noqa: E402

vp = app_module.version_policy
svc = app_module.firebase_service


@pytest.fixture(autouse=True)
def offline_and_reset(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    vp.set('')            # no minimum
    yield
    vp.set('')


@pytest.mark.parametrize('cur,minv,older', [
    ('2.0.20', '2.0.22', True), ('2.0.22', '2.0.22', False), ('2.1.0', '2.0.22', False), ('2.0.9', '2.0.22', True),
    ('1.9.99', '2.0.0', True), ('2.0', '2.0.1', True), ('2.0.22', '', False), ('garbage', '2.0.22', False),
    ('2.0.22', 'garbage', False), ('v2.0.20', '2.0.22', True), ('2.0.22-beta', '2.0.22', False),
])
def test_version_comparison(cur, minv, older):
    assert is_older(cur, minv) is older


def test_parse_version():
    assert parse_version('2.0.22') == (2, 0, 22) and parse_version('x') is None and parse_version('') is None


def test_no_minimum_means_everything_works():
    c = authed_client(app_module)
    assert c.get('/api/app/version-status').get_json()['updateRequired'] is False
    assert c.get('/api/projects').status_code != 426


def test_old_version_is_blocked_everywhere_except_status_pages():
    vp.set('99.0.0', 'https://example.com/get', 'Please update')
    c = authed_client(app_module)
    for path, method in [('/api/projects', 'get'), ('/api/calculate-area', 'post'), ('/api/auth/login', 'post'),
                         ('/api/auth/signup', 'post'), ('/api/auth/verify', 'post')]:
        r = getattr(c, method)(path, json={}) if method == 'post' else c.get(path)
        assert r.status_code == 426 and r.get_json()['code'] == 'UPDATE_REQUIRED', path
    st = c.get('/api/app/version-status').get_json()
    assert st['updateRequired'] and st['minimumVersion'] == '99.0.0' and st['downloadUrl'] == 'https://example.com/get'
    assert c.get('/api/health').status_code == 200


def test_minimum_survives_restart_when_offline(tmp_path):
    p1 = VersionPolicy(svc, str(tmp_path), '2.0.20'); p1.set('2.0.22')
    p2 = VersionPolicy(svc, str(tmp_path), '2.0.20')     # new process, nothing cached in memory
    assert p2.status()['updateRequired'] is True
    assert VersionPolicy(svc, str(tmp_path), '2.0.22').status()['updateRequired'] is False


def _admin():
    svc._save_users_to_json({'adm': {'email': 'nsayegh2003@gmail.com', 'is_admin': True}})
    return authed_client(app_module, uid='adm')


def test_admin_cannot_lock_themselves_out():
    r = _admin().post('/api/admin/app-version', json={'minVersion': '99.0.0'})
    assert r.status_code == 400 and 'lock yourself out' in r.get_json()['error']
    assert vp.status()['updateRequired'] is False


def test_admin_can_set_current_version_and_turn_off():
    c = _admin()
    r = c.post('/api/admin/app-version', json={'minVersion': app_module.APP_VERSION, 'downloadUrl': 'https://example.com/x'})
    assert r.status_code == 200 and r.get_json()['minimumVersion'] == app_module.APP_VERSION
    assert c.post('/api/admin/app-version', json={'minVersion': ''}).get_json()['minimumVersion'] == ''


@pytest.mark.parametrize('body', [{'minVersion': 'abc'}, {'minVersion': '2.0.1', 'downloadUrl': 'http://insecure'},
                                  {'minVersion': '2.0.1', 'downloadUrl': 'javascript:alert(1)'}])
def test_admin_input_validation(body):
    assert _admin().post('/api/admin/app-version', json=body).status_code == 400


def test_non_admin_cannot_change_policy():
    svc._save_users_to_json({'u': {'email': 'u@x.com'}})
    assert authed_client(app_module, uid='u').post('/api/admin/app-version', json={'minVersion': '2.0.1'}).status_code == 403
