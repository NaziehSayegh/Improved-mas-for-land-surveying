"""'Block outdated versions': old apps cannot be forced, but they all obey the account's active flag."""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
os.environ.pop('PARCEL_TOOLS_VERSION', None)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
import app as app_module  # noqa: E402
from test_support import authed_client  # noqa: E402

svc = app_module.firebase_service
V = app_module.APP_VERSION


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    app_module._account_check_cache.clear()


def _users():
    svc._save_users_to_json({
        'adm': {'email': 'nsayegh2003@gmail.com', 'is_admin': True},
        'other-admin': {'email': 'boss@x.com', 'is_admin': True},
        'old1': {'email': 'a@x.com', 'account_type': 'premium'},                   # never reported a version
        'old2': {'email': 'b@x.com', 'app_version': '2.0.20'},
        'new1': {'email': 'c@x.com', 'app_version': V},
        'newer': {'email': 'd@x.com', 'app_version': '9.9.9'},
        'off': {'email': 'e@x.com', 'is_active': False},                           # already blocked: left alone
    })
    return authed_client(app_module, uid='adm')


def test_preview_lists_only_users_not_seen_on_new_version():
    c = _users()
    d = c.get(f'/api/admin/outdated-users?minVersion={V}').get_json()
    assert sorted(u['uid'] for u in d['users']) == ['old1', 'old2'] and d['count'] == 2


def test_apply_blocks_with_reason_and_spares_admins_and_blocked():
    c = _users()
    assert c.post('/api/admin/block-outdated', json={'minVersion': V}).get_json() == {'success': True, 'blocked': 2}
    u = svc._load_users_from_json()
    assert u['old1']['is_active'] is False and u['old1']['suspended_reason'] == 'update_required' and u['old1']['suspended_below'] == V
    assert u['new1'].get('is_active', True) is not False and u['adm'].get('is_active', True) is not False
    assert u['off'].get('suspended_reason') is None


def test_admin_cannot_block_above_own_version_or_with_bad_input():
    c = _users()
    assert c.post('/api/admin/block-outdated', json={'minVersion': '99.0.0'}).status_code == 400
    assert c.post('/api/admin/block-outdated', json={'minVersion': 'abc'}).status_code == 400
    assert c.get('/api/admin/outdated-users?minVersion=').status_code == 400


def _verify(uid):
    return authed_client(app_module, uid=uid).post('/api/auth/verify', json={})


def test_updated_user_is_let_in_without_writing_their_own_flag():
    _users(); svc.update_user_fields('old2', {'is_active': False, 'suspended_reason': 'update_required', 'suspended_below': V})
    r = _verify('old2')
    assert r.status_code == 200 and r.get_json()['valid'] is True
    u = svc._load_users_from_json()['old2']
    assert u['is_active'] is False and u['app_version'] == V          # stored flag untouched, version recorded


def test_admin_restore_tidies_the_stored_flag_of_updated_users_only():
    c = _users()
    svc.update_user_fields('old2', {'is_active': False, 'suspended_reason': 'update_required', 'suspended_below': V, 'app_version': V})
    svc.update_user_fields('old1', {'is_active': False, 'suspended_reason': 'update_required', 'suspended_below': V})  # not seen yet
    assert c.post('/api/admin/restore-updated').get_json() == {'success': True, 'restored': 1}
    u = svc._load_users_from_json()
    assert u['old2']['is_active'] is True and u['old1']['is_active'] is False


def test_requirement_higher_than_this_version_keeps_user_blocked():
    _users(); svc.update_user_fields('old2', {'is_active': False, 'suspended_reason': 'update_required', 'suspended_below': '99.0.0'})
    assert _verify('old2').status_code == 403


def test_manual_suspension_is_never_lifted_by_updating():
    _users(); svc.update_user_fields('old2', {'is_active': False})
    assert _verify('old2').status_code == 403


def test_non_admin_cannot_use_the_block_endpoints():
    _users()
    c = authed_client(app_module, uid='old1')
    assert c.post('/api/admin/block-outdated', json={'minVersion': V}).status_code == 403
    assert c.get(f'/api/admin/outdated-users?minVersion={V}').status_code == 403
