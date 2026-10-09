"""Regression tests: a userId alone must never yield a session; logout needs a real token."""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module  # noqa: E402

client = app_module.app.test_client()


def _signup(email):
    r = client.post('/api/auth/signup', json={'email': email, 'password': 'password123'})
    assert r.status_code == 200
    j = r.get_json()
    return j['userId'], j['sessionToken']


def test_verify_with_userid_only_is_rejected():
    uid, _ = _signup('a1@x.com')
    r = client.post('/api/auth/verify', json={'userId': uid})
    assert r.status_code == 401
    assert 'sessionToken' not in (r.get_json() or {})


def test_verify_with_garbage_token_is_rejected_even_with_userid():
    uid, _ = _signup('a2@x.com')
    r = client.post('/api/auth/verify', json={'userId': uid, 'sessionToken': 'junk.junk'})
    assert r.status_code == 401


def test_verify_with_valid_token_still_works():
    uid, tok = _signup('a3@x.com')
    r = client.post('/api/auth/verify', json={'userId': uid, 'sessionToken': tok})
    assert r.status_code == 200 and r.get_json()['valid'] is True


def test_verify_no_body_does_not_crash_with_500():
    r = client.post('/api/auth/verify', json={})
    assert r.status_code == 401


def test_logout_requires_token():
    uid, _ = _signup('a4@x.com')
    r = client.post('/api/auth/logout', json={'userId': uid})
    assert r.status_code == 401


def test_logout_with_valid_token_releases_device():
    uid, tok = _signup('a5@x.com')
    r = client.post('/api/auth/logout', headers={'X-Session-Token': tok}, json={})
    assert r.status_code == 200
