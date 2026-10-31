"""Customer mode: no admin key on the PC. The app signs in as the user and Firestore security rules limit it.

A fake Firestore enforces a Python model of firebase/firestore.rules (the allowed-field list and the admin emails are
read from the real rules file, so the model and the file cannot drift apart)."""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
from fake_firebase import FakeAuth, FakeFirestore  # noqa: E402
from firebase_service import FirebaseService  # noqa: E402
from rest_firestore import PermissionDenied, decode_value  # noqa: E402
from app_version import VersionPolicy  # noqa: E402

RULES = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'firebase', 'firestore.rules'), encoding='utf-8').read()
ALLOWED = set(re.findall(r"'([a-z_]+)'", re.search(r'hasOnly\(\[(.*?)\]\)', RULES, re.S).group(1)))
ADMIN_EMAILS = set(re.findall(r"'([^']+@[^']+)'", re.search(r'token\.email in \[(.*?)\]', RULES, re.S).group(1)))


def _fields(body):
    return {k: decode_value(v) for k, v in ((body or {}).get('fields') or {}).items()}


class RulesModel:
    def __init__(self, auth):
        self.auth = auth

    def who(self, token):
        for uid, u in self.auth.users.items():
            if u['id'] == token:
                return {'uid': uid, 'email': u['email'], 'verified': u.get('verified', False)}
        return None

    def __call__(self, ctx):
        me, parts, kind = self.who(ctx['token']), ctx['parts'], ctx['kind']
        coll, doc = parts[0], (parts[1] if len(parts) > 1 else None)
        is_admin = bool(me and me['verified'] and me['email'] in ADMIN_EMAILS)
        old = ctx['existing']
        if coll == 'app_config':
            return kind in ('get', 'list', 'query') or is_admin
        if not me:
            return False
        if coll == 'users':
            if kind == 'get':
                return doc == me['uid'] or is_admin
            if kind == 'list':
                return is_admin
            if kind == 'query':
                f = ctx['body']['structuredQuery'].get('where', {}).get('fieldFilter')
                return is_admin or bool(f and f['field']['fieldPath'] == 'email' and decode_value(f['value']) == me['email'])
            if kind == 'create':
                new = _fields(ctx['body'])
                return is_admin or (doc == me['uid'] and new.get('email') == me['email'] and new.get('is_active') is True
                                    and new.get('is_admin') is False and 'max_devices' not in new
                                    and 'suspended_reason' not in new and 'suspended_below' not in new)
            if kind == 'update':
                if is_admin:
                    return True
                masks = ctx['qs'].get('updateMask.fieldPaths')
                new = _fields(ctx['body'])
                if masks:
                    touched = {re.split(r'\.(?=(?:[^`]*`[^`]*`)*[^`]*$)', m)[0].strip('`') for m in masks}
                else:
                    touched = {k for k in set(old) | set(new) if old.get(k) != new.get(k)}
                return doc == me['uid'] and touched <= ALLOWED
            if kind == 'delete':
                return is_admin
        if coll == 'projects':
            if kind in ('get',):
                return bool(old) and old.get('owner') == me['uid']
            if kind == 'query':
                f = ctx['body']['structuredQuery'].get('where', {}).get('fieldFilter')
                return bool(f and f['field']['fieldPath'] == 'owner' and decode_value(f['value']) == me['uid'])
            if kind == 'create':
                return _fields(ctx['body']).get('owner') == me['uid']
            if kind in ('update', 'delete'):
                return bool(old) and old.get('owner') == me['uid']
        return False


@pytest.fixture
def env(tmp_path):
    fs, fa = FakeFirestore(), FakeAuth()
    fs.rules = RulesModel(fa)
    fs.token_ok = lambda t: any(u['id'] == t for u in fa.users.values())

    def service(sub):
        d = tmp_path / sub; d.mkdir()
        return FirebaseService(str(d), rest_opener=fs, auth_opener=fa)
    return type('Env', (), {'fs': fs, 'fa': fa, 'service': staticmethod(service)})


def signup(svc, email, **kw):
    r = svc.create_user(email, 'password123', kw.get('license_key', ''), account_type=kw.get('account_type', 'demo'),
                        machine_id_hash='m' * 64, trial_start='2026-10-01T00:00:00')
    assert r['success'], r
    return r['user_id']


# ============ the app works in customer mode ============
def test_service_runs_in_customer_mode_without_any_admin_key(env):
    s = env.service('a')
    assert s.rest_mode and s.db is not None and not s._is_online()          # nobody signed in yet


def test_signup_creates_login_and_profile_and_signs_in(env):
    s = env.service('a')
    uid = signup(s, 'a@x.com')
    assert s._is_online() and env.fs.docs[f'users/{uid}']['email'] == 'a@x.com'
    assert env.fs.docs[f'users/{uid}']['is_active'] is True and env.fs.docs[f'users/{uid}']['is_admin'] is False
    assert s.get_user(uid)['email'] == 'a@x.com'


def test_duplicate_email_gives_a_friendly_error(env):
    s = env.service('a'); signup(s, 'a@x.com')
    r = env.service('b').create_user('a@x.com', 'password123', '')
    assert not r['success'] and 'already registered' in r['error']


def test_normal_customer_operations_pass_the_rules(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    assert s.add_device(uid, 'a' * 64, 'PC one', computer_name='PC1')['success']
    assert s.add_device(uid, 'a' * 64, 'PC one', computer_name='PC1')['success']        # same PC again: dotted-path update
    assert s.add_device(uid, 'b' * 64, 'PC two')['success'] and not s.add_device(uid, 'c' * 64, 'PC three')['success']
    assert len(env.fs.docs[f'users/{uid}']['devices']) == 2
    assert s.update_user_fields(uid, {'app_version': '2.0.23'})['success']
    assert s.save_license(uid, {'key': 'KEY-1', 'type': 'paid'})['success']
    assert env.fs.docs[f'users/{uid}']['license_key'] == 'KEY-1'
    assert s.remove_device(uid, 'a' * 64)['success'] and len(env.fs.docs[f'users/{uid}']['devices']) == 1


def test_projects_are_private_to_their_owner_but_fully_usable_by_them(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    assert s.save_project(uid, 'p1', {'projectName': 'Mine'})['success']
    assert [p['projectName'] for p in s.list_user_projects(uid)] == ['Mine']
    assert s.load_project('p1', uid)['projectName'] == 'Mine'
    assert s.delete_project('p1', uid)['success'] and 'projects/p1' not in env.fs.docs


def test_user_exists_online_and_account_gone_detection(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    assert s.user_exists_online(uid) is True
    env.fa.users[uid]['gone'] = True                          # login deleted / disabled in Firebase
    s.user_auth._state['users'][uid]['expires_at'] = 0         # force the next token refresh
    assert s.user_exists_online(uid) is False and not s.user_auth.has_credentials()


def test_after_update_the_user_must_sign_in_once_more(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    s.forget_login()
    assert s.needs_new_sign_in()
    d = os.path.dirname(s.user_auth.path)
    fresh = FirebaseService(d, rest_opener=env.fs, auth_opener=env.fa)       # another start of the app: no tokens kept
    assert fresh.needs_new_sign_in() is True


def test_sign_in_survives_an_app_restart(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    again = FirebaseService(os.path.dirname(s.user_auth.path), rest_opener=env.fs, auth_opener=env.fa)
    assert not again.needs_new_sign_in() and again.get_user(uid)['email'] == 'a@x.com'


def test_failed_signup_is_rolled_back(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    s.rollback_new_user(uid)
    assert env.fa.users == {} and not s.user_auth.has_credentials()


# ============ attacks the rules must stop ============
def two_users(env):
    a, b = env.service('a'), env.service('b')
    ua = signup(a, 'a@x.com'); ub = signup(b, 'b@x.com')
    return a, ua, b, ub


def test_customer_cannot_read_or_list_other_customers(env):
    a, ua, b, ub = two_users(env)
    b.user_auth.remember(ub, env.fa.users[ub]['id'], env.fa.users[ub]['refresh'])        # act as B
    with pytest.raises(PermissionDenied):
        b.db.collection('users').document(ua).get()
    with pytest.raises(PermissionDenied):
        list(b.db.collection('users').stream())
    with pytest.raises(PermissionDenied):
        list(b.db.collection('users').where('email', '==', 'a@x.com').stream())
    assert [s.id for s in b.db.collection('users').where('email', '==', 'b@x.com').stream()] == [ub]   # own email lookup works


@pytest.mark.parametrize('field,value', [
    ('is_active', True), ('is_admin', True), ('max_devices', 99), ('trial_start', '2099-01-01T00:00:00'),
    ('suspended_reason', ''), ('created_at', '2020-01-01'), ('email', 'x@y.com'), ('license_deactivated_at', 'x')])
def test_customer_cannot_change_protected_fields_of_their_own_profile(env, field, value):
    a, ua, *_ = two_users(env)
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ua).update({field: value})
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ua).set({field: value}, merge=True)


def test_blocked_customer_cannot_unblock_themselves_or_reset_by_recreating(env):
    a, ua, *_ = two_users(env)
    env.fs.docs[f'users/{ua}']['is_active'] = False          # the admin blocked them
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ua).update({'is_active': True})
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ua).delete()        # delete + re-create would reset the block
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ua).set({'email': 'a@x.com', 'is_active': True, 'is_admin': False})  # whole-doc replace


def test_customer_cannot_touch_other_profiles_or_create_privileged_ones(env):
    a, ua, b, ub = two_users(env)
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ub).update({'last_login': 'x'})
    with pytest.raises(PermissionDenied):
        a.db.collection('users').document(ub).delete()
    with pytest.raises(PermissionDenied):                                             # profile for someone else
        a.db.collection('users').document('uid-victim').set({'email': 'a@x.com', 'is_active': True, 'is_admin': False})
    c = env.service('c'); c.user_auth.sign_up('c@x.com', 'password123'); uc = c.user_auth.current_uid
    with pytest.raises(PermissionDenied):                                             # self-made admin / extra limits
        c.db.collection('users').document(uc).set({'email': 'c@x.com', 'is_active': True, 'is_admin': True})
    with pytest.raises(PermissionDenied):
        c.db.collection('users').document(uc).set({'email': 'c@x.com', 'is_active': True, 'is_admin': False, 'max_devices': 50})


def test_customer_cannot_use_another_customers_projects_or_change_app_settings(env):
    a, ua, b, ub = two_users(env)
    a.save_project(ua, 'pa', {'projectName': 'secret'})
    assert b.load_project('pa', ub) is None
    with pytest.raises(PermissionDenied):
        b.db.collection('projects').document('pa').get()
    with pytest.raises(PermissionDenied):
        b.db.collection('projects').document('pa').delete()
    with pytest.raises(PermissionDenied):
        b.db.collection('app_config').document('release').set({'min_version': '99.0.0'})


def test_admin_with_verified_email_can_manage_everyone(env):
    a, ua, b, ub = two_users(env)
    adm = env.service('adm'); uadm = signup(adm, 'nsayegh2003@gmail.com')
    env.fa.users[uadm]['verified'] = True
    assert len(adm.get_all_users()) == 3
    assert adm.set_user_active(ua, False)['success'] and env.fs.docs[f'users/{ua}']['is_active'] is False
    assert adm.set_user_max_devices(ua, 5)['success'] and env.fs.docs[f'users/{ua}']['max_devices'] == 5
    assert adm.delete_user_account(ub)['success'] and f'users/{ub}' not in env.fs.docs


def test_admin_email_without_verification_is_just_a_customer(env):
    adm = env.service('adm'); uadm = signup(adm, 'nsayegh2003@gmail.com')                  # NOT verified
    with pytest.raises(PermissionDenied):
        list(adm.db.collection('users').stream())


# ============ settings readable before sign-in ============
def test_update_gate_and_email_rules_are_readable_before_anyone_signs_in(env, tmp_path):
    admin_side = env.service('adm'); uadm = signup(admin_side, 'nsayegh2003@gmail.com'); env.fa.users[uadm]['verified'] = True
    admin_side.db.collection('app_config').document('release').set({'min_version': '9.0.0', 'download_url': 'https://x.test/d'})
    fresh = env.service('fresh')                                                            # nobody signed in on this PC
    assert fresh.needs_new_sign_in()
    st = VersionPolicy(fresh, str(tmp_path / 'fresh'), '2.0.23').status()
    assert st['updateRequired'] is True and st['minimumVersion'] == '9.0.0' and st['downloadUrl'] == 'https://x.test/d'
    anonymous_calls = [r for r in env.fs.requests if not r[3]]
    assert anonymous_calls and all('key=' in r[1] and '/app_config/' in r[1] for r in anonymous_calls)


# ============ rules file and the model agree ============
def test_rules_file_declares_the_protected_fields_as_admin_only():
    for f in ['is_active', 'is_admin', 'max_devices', 'trial_start', 'created_at', 'email', 'suspended_reason', 'suspended_below']:
        assert f not in ALLOWED
    assert {'devices', 'app_version', 'last_login', 'license_key'} <= ALLOWED
    assert 'allow delete: if isAdmin();' in RULES and ADMIN_EMAILS == {'nsayegh2003@gmail.com', 'nsayegh2003@yahoo.com'}
