"""Regression tests: forged / self-generated licenses must never be accepted.
Run:  python -m pytest backend/test_security_licensing.py
"""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module  # noqa: E402

client = app_module.app.test_client()
lm = app_module.license_manager


def _no_gumroad(monkeypatch):
    monkeypatch.setattr(lm, 'verify_gumroad_key', lambda k: {'valid': False, 'message': 'invalid'})


def test_license_generate_endpoint_is_gone():
    r = client.post('/api/license/generate', json={'email': 'a@b.com'})
    assert r.status_code in (404, 405)


def test_email_derived_key_is_rejected(monkeypatch):
    _no_gumroad(monkeypatch)
    key = lm.generate_license_key('victim@x.com')
    assert lm.validate_license_key(key, 'victim@x.com') is False
    r = client.post('/api/license/activate', json={'license_key': key, 'email': 'victim@x.com'})
    assert r.status_code == 400


def test_old_listed_keys_are_rejected(monkeypatch):
    _no_gumroad(monkeypatch)
    assert lm.validate_license_key('8888-8888-8888-8888', 'admin@example.com') is False


def test_premium_signup_with_forged_key_is_rejected(monkeypatch):
    _no_gumroad(monkeypatch)
    key = lm.generate_license_key('free@x.com')
    r = client.post('/api/auth/signup', json={'email': 'free@x.com', 'password': 'password123',
                                              'accountType': 'premium', 'licenseKey': key})
    assert r.status_code == 400


def test_valid_gumroad_key_still_activates(monkeypatch):
    monkeypatch.setattr(lm, 'verify_gumroad_key', lambda k: {'valid': True, 'email': 'buyer@x.com'})
    r = client.post('/api/license/activate', json={'license_key': 'REAL-KEY', 'email': 'buyer@x.com'})
    assert r.status_code == 200 and r.get_json()['success']
    assert lm.get_license_info()['is_valid'] is True
    lm.deactivate_license()


def test_demo_signup_still_works():
    r = client.post('/api/auth/signup', json={'email': 'demo@x.com', 'password': 'password123'})
    assert r.status_code == 200 and r.get_json()['accountType'] == 'demo'
