"""Signup -> verification -> login -> use -> deletion, through the app's own HTTP endpoints, in customer mode
(no admin key; Firebase replaced by in-memory fakes)."""
import os
import sys
import tempfile

_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
import app as app_module  # noqa: E402
from fake_firebase import FakeAuth, FakeFirestore  # noqa: E402
from firebase_service import FirebaseService  # noqa: E402
from test_customer_mode import RulesModel  # noqa: E402


@pytest.fixture
def world(tmp_path, monkeypatch):
    fs, fa = FakeFirestore(), FakeAuth()
    fs.rules = RulesModel(fa)
    fs.token_ok = lambda t: any(u['id'] == t for u in fa.users.values())
    svc = FirebaseService(str(tmp_path), rest_opener=fs, auth_opener=fa)
    svc.app_version = app_module.APP_VERSION
    monkeypatch.setattr(app_module, 'firebase_service', svc)
    monkeypatch.setattr(app_module.version_policy, 'fs', svc)
    monkeypatch.setattr(app_module.email_policy, 'fs', svc)
    app_module.version_policy.set(''); app_module.email_policy._cache = None
    app_module._account_check_cache.clear()
    monkeypatch.setattr(app_module, '_email_verification_enforced', lambda: True)

    def fake_rest(endpoint, payload):                       # Firebase Identity Toolkit, as used by the app
        if endpoint == 'signInWithPassword':
            for uid, u in fa.users.items():
                if u['email'] == payload['email'] and u['password'] == payload['password']:
                    u['id'] = f"id-{uid}-signin"
                    return {'localId': uid, 'idToken': u['id'], 'refreshToken': u['refresh'], 'expiresIn': '3600'}
            raise Exception('INVALID_LOGIN_CREDENTIALS')
        if endpoint == 'lookup':
            u = next(u for u in fa.users.values() if u['id'] == payload['idToken'])
            return {'users': [{'emailVerified': bool(u.get('email_verified'))}]}
        if endpoint == 'sendOobCode':
            return {}
        raise Exception('unsupported ' + endpoint)
    monkeypatch.setattr(app_module, '_firebase_rest', fake_rest)
    monkeypatch.setattr('firebase_config.get_firebase_api_key', lambda: 'k')
    client = app_module.app.test_client()
    yield type('W', (), {'fs': fs, 'fa': fa, 'svc': svc, 'c': client})
    # leave the shared app object exactly as other tests expect it
    for pol in (app_module.version_policy, app_module.email_policy):
        pol._cache = None
        try:
            os.remove(pol.path)
        except OSError:
            pass
    app_module._account_check_cache.clear()


def post(w, path, **body):
    return w.c.post(path, json=body)


def test_whole_customer_journey(world):
    w = world
    # 1. sign up with a normal address: the profile is created, a verification email is sent, no session yet
    r = post(w, '/api/auth/signup', email='Real.Person@Gmail.com', password='password123')
    assert r.status_code == 200 and r.get_json()['verificationRequired'] is True
    uid = next(iter(w.fa.users))
    assert w.fs.docs[f'users/{uid}']['email'] == 'real.person@gmail.com' and w.fs.docs[f'users/{uid}']['is_active'] is True

    # 2. cannot sign in before verifying the email
    r = post(w, '/api/auth/login', email='real.person@gmail.com', password='password123')
    assert r.status_code == 403 and r.get_json()['code'] == 'EMAIL_NOT_VERIFIED'

    # 3. after clicking the link: sign-in works and returns a session
    w.fa.users[uid]['email_verified'] = True
    r = post(w, '/api/auth/login', email='real.person@gmail.com', password='password123')
    assert r.status_code == 200, r.get_json()
    token = r.get_json()['sessionToken']
    h = {'X-Session-Token': token}
    assert w.fs.docs[f'users/{uid}']['app_version'] == app_module.APP_VERSION
    assert w.c.get('/api/projects', headers=h).status_code != 401
    assert w.c.post('/api/auth/verify', json={}, headers=h).get_json()['valid'] is True

    # 4. an admin removes the account: the very next check refuses it
    del w.fs.docs[f'users/{uid}']
    app_module._account_check_cache.clear()
    r = w.c.get('/api/projects', headers=h)
    assert r.status_code == 401 and r.get_json()['code'] == 'ACCOUNT_DELETED'


def test_disposable_address_never_reaches_firebase(world):
    r = post(world, '/api/auth/signup', email='xefehoy663@ofags.com', password='password123')
    assert r.status_code == 400 and r.get_json()['code'] == 'EMAIL_NOT_ALLOWED'
    assert world.fa.users == {} and world.fs.docs == {}


def test_failed_verification_email_removes_the_half_created_account(world, monkeypatch):
    real = app_module._firebase_rest
    monkeypatch.setattr(app_module, '_firebase_rest', lambda e, p: (_ for _ in ()).throw(Exception('INVALID_EMAIL')) if e == 'sendOobCode' else real(e, p))
    r = post(world, '/api/auth/signup', email='typo@gmial.con', password='password123')
    assert r.status_code == 400 and 'verification email' in r.get_json()['error']
    assert world.fa.users == {}                                 # the login was rolled back


def test_wrong_password_and_unknown_user_are_rejected(world):
    post(world, '/api/auth/signup', email='a@gmail.com', password='password123')
    assert post(world, '/api/auth/login', email='a@gmail.com', password='nope-nope-1').status_code == 401
    assert post(world, '/api/auth/login', email='ghost@gmail.com', password='password123').status_code == 401


def test_after_the_update_the_first_start_asks_for_one_sign_in(world):
    w = world
    post(w, '/api/auth/signup', email='a@gmail.com', password='password123')
    uid = next(iter(w.fa.users)); w.fa.users[uid]['email_verified'] = True
    token = post(w, '/api/auth/login', email='a@gmail.com', password='password123').get_json()['sessionToken']
    w.svc.forget_login()                                         # as after installing a build that has never signed in
    r = w.c.post('/api/auth/verify', json={}, headers={'X-Session-Token': token})
    assert r.status_code == 401 and r.get_json()['code'] == 'REAUTH_REQUIRED'


def test_minimum_version_gate_works_before_sign_in_in_customer_mode(world):
    w = world
    w.fs.docs['app_config/release'] = {'min_version': '99.0.0', 'download_url': 'https://x.test/get'}
    app_module.version_policy._cache = None
    r = w.c.post('/api/auth/login', json={'email': 'a@gmail.com', 'password': 'password123'})
    assert r.status_code == 426 and r.get_json()['code'] == 'UPDATE_REQUIRED'
