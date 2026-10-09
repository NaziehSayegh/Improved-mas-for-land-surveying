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

from test_support import authed_client  # noqa: E402
client = authed_client(app_module)
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


# ---------- signing secret / tampering ----------
def test_old_public_secret_no_longer_signs_anything():
    import hmac, base64, time
    old_secret = "a8f3d9e2c1b74f6a0d5e8c3b2a9f1e4d7c6b5a8f3d9e2c1b74f6a0d5e8c3b2a"
    payload = base64.urlsafe_b64encode(f'ANY_UID:{lm.get_machine_id_hash()}:{int(time.time()) + 999}'.encode()).decode()
    forged = f'{payload}.{hmac.new(old_secret.encode(), payload.encode(), "sha256").hexdigest()}'
    r = app_module.app.test_client().get('/api/projects', headers={'X-Session-Token': forged})
    assert r.status_code == 401


def test_secret_not_in_source_and_persists_across_restarts():
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'license_manager.py'), encoding='utf-8').read()
    assert 'a8f3d9e2c1b74f6a' not in src
    from license_manager import LicenseManager
    d = tempfile.mkdtemp()
    a, b = LicenseManager(d), LicenseManager(d)
    assert a._secret == b._secret and len(a._secret) >= 64          # persisted
    assert LicenseManager(tempfile.mkdtemp())._secret != a._secret   # unique per install


def test_token_from_another_install_is_rejected():
    from license_manager import LicenseManager
    other = LicenseManager(tempfile.mkdtemp())
    tok = other.generate_session_token('u', lm.get_machine_id_hash())
    r = app_module.app.test_client().get('/api/projects', headers={'X-Session-Token': tok})
    assert r.status_code == 401


def test_unsigned_or_edited_license_file_is_rejected():
    import json
    lm.deactivate_license()
    open(lm.license_file, 'w').write(json.dumps({"type": "paid", "provider": "gumroad", "key": "x", "email": "a@b.c"}))
    assert lm.get_license_info()['is_valid'] is False
    monkey = lm.activate_from_account('real@x.com')
    assert lm.get_license_info()['is_valid'] is True
    data = json.load(open(lm.license_file))
    data['email'] = 'someone-else@x.com'                                  # edit after signing
    open(lm.license_file, 'w').write(json.dumps(data))
    assert lm.get_license_info()['is_valid'] is False
    lm.deactivate_license()


def test_future_dated_trial_counts_as_tampering():
    from datetime import datetime, timedelta
    r = lm._compute_trial_response((datetime.now() + timedelta(days=400)).isoformat(), 'expired', 'Trial')
    assert r['is_valid'] is False and r['status'] == 'expired'
    ok = lm._compute_trial_response(datetime.now().isoformat(), 'expired', 'Trial')
    assert ok['is_valid'] is True
