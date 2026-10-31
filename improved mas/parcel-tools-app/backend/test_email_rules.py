"""Disposable-email blocking, deleted accounts losing access, and the admin bulk delete."""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
import app as app_module  # noqa: E402
from email_rules import is_disposable_email  # noqa: E402
from test_support import authed_client  # noqa: E402

svc = app_module.firebase_service


@pytest.mark.parametrize('email,expected', [
    ('x@mailinator.com', True), ('X@MAILINATOR.COM', True), ('a@sub.yopmail.com', True),
    ('a@guerrillamail.com', True), ('a@gmail.com', False), ('a@example.org', False),
    ('a@mailinator-lookalike-shop.org', False), ('', False), ('no-at-sign', False),
])
def test_disposable_detection(email, expected):
    assert is_disposable_email(email) is expected


def test_extra_blocked_domains_file(tmp_path):
    (tmp_path / 'blocked_email_domains.txt').write_text('# comment\nfakecorp.test\n@spammy.example\n')
    assert is_disposable_email('a@fakecorp.test', str(tmp_path))
    assert is_disposable_email('a@spammy.example', str(tmp_path))
    assert not is_disposable_email('a@gmail.com', str(tmp_path))


def test_signup_rejects_disposable_email():
    c = app_module.app.test_client()
    r = c.post('/api/auth/signup', json={'email': 'bot123@mailinator.com', 'password': 'password123'})
    assert r.status_code == 400 and r.get_json()['code'] == 'EMAIL_NOT_ALLOWED'


def test_login_rejects_disposable_email_even_for_old_accounts():
    c = app_module.app.test_client()
    r = c.post('/api/auth/login', json={'email': 'old@yopmail.com', 'password': 'whatever12'})
    assert r.status_code == 403 and r.get_json()['code'] == 'EMAIL_NOT_ALLOWED'


def test_deleted_account_loses_access(monkeypatch):
    c = authed_client(app_module, uid='ghost-user')
    app_module._account_check_cache.clear()
    monkeypatch.setattr(svc, 'user_exists_online', lambda uid: False)
    r = c.get('/api/projects')
    assert r.status_code == 401 and r.get_json()['code'] == 'ACCOUNT_DELETED'


@pytest.mark.parametrize('answer', [True, None])
def test_existing_or_unknown_account_keeps_access(monkeypatch, answer):
    c = authed_client(app_module, uid='live-user')
    app_module._account_check_cache.clear()
    monkeypatch.setattr(svc, 'user_exists_online', lambda uid: answer)
    r = c.get('/api/projects')
    assert r.status_code != 401


def test_bulk_delete_skips_admins_and_self(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    svc._save_users_to_json({
        'admin1': {'email': 'nsayegh2003@gmail.com', 'is_admin': True},
        'other-admin': {'email': 'boss@example.com', 'is_admin': True},
        'fake1': {'email': 'a@x.com'}, 'fake2': {'email': 'b@x.com'},
    })
    c = authed_client(app_module, uid='admin1')
    r = c.post('/api/admin/users/bulk-delete', json={'uids': ['fake1', 'fake2', 'admin1', 'other-admin']})
    body = r.get_json()
    assert r.status_code == 200 and sorted(body['deleted']) == ['fake1', 'fake2']
    assert sorted(body['skipped']) == ['admin1', 'other-admin']
    left = svc._load_users_from_json()
    assert 'admin1' in left and 'other-admin' in left and 'fake1' not in left


def test_bulk_delete_requires_admin():
    c = authed_client(app_module, uid='plain-user')
    svc._save_users_to_json({'plain-user': {'email': 'p@x.com'}})
    assert c.post('/api/admin/users/bulk-delete', json={'uids': ['x']}).status_code == 403


# ---- bundled list, admin-managed rules and strict mode ----
from email_rules import EmailPolicy, MAJOR_PROVIDERS  # noqa: E402


def test_bundled_list_blocks_temp_mail_org_domain_from_real_world_test():
    assert is_disposable_email('xefehoy663@ofags.com')
    assert not is_disposable_email('someone@gmail.com')


def _policy(tmp_path, monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    return EmailPolicy(svc, str(tmp_path))


def test_default_policy_allows_unknown_company_domain(tmp_path, monkeypatch):
    assert _policy(tmp_path, monkeypatch).check('boss@mycompany.com') is None


def test_admin_blocked_domain_applies_immediately(tmp_path, monkeypatch):
    p = _policy(tmp_path, monkeypatch)
    p.set(False, ['Fresh-Temp.example', 'bad domain'], [])
    assert p.check('x@fresh-temp.example')[0] == 'EMAIL_NOT_ALLOWED'
    assert p.get()['blocked_domains'] == ['fresh-temp.example']      # junk entries dropped, lower-cased


def test_strict_mode_only_accepts_known_providers_and_approved_domains(tmp_path, monkeypatch):
    p = _policy(tmp_path, monkeypatch)
    p.set(True, [], ['mycompany.com'])
    assert p.check('a@gmail.com') is None and p.check('a@outlook.com') is None
    assert p.check('a@team.mycompany.com') is None
    assert p.check('brandnewtemp@zzzz-new-domain.xyz')[0] == 'EMAIL_DOMAIN_NOT_APPROVED'
    assert p.check('x@ofags.com')[0] == 'EMAIL_NOT_ALLOWED'          # blocklist still wins


def test_policy_survives_restart_offline(tmp_path, monkeypatch):
    _policy(tmp_path, monkeypatch).set(True, [], [])
    assert EmailPolicy(svc, str(tmp_path)).check('a@zzzz-new-domain.xyz')[0] == 'EMAIL_DOMAIN_NOT_APPROVED'


def test_signup_blocked_in_strict_mode(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    app_module.email_policy.set(True, [], [])
    try:
        r = app_module.app.test_client().post('/api/auth/signup', json={'email': 'bot@brand-new-temp.xyz', 'password': 'password123'})
        assert r.status_code == 400 and r.get_json()['code'] == 'EMAIL_DOMAIN_NOT_APPROVED'
    finally:
        app_module.email_policy.set(False, [], [])


def test_admin_email_policy_endpoints(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    svc._save_users_to_json({'adm': {'email': 'nsayegh2003@gmail.com', 'is_admin': True}, 'u': {'email': 'u@x.com'}})
    c = authed_client(app_module, uid='adm')
    try:
        r = c.post('/api/admin/email-policy', json={'strict': True, 'blockedDomains': ['a.example'], 'allowedDomains': ['b.example']})
        assert r.get_json() == {'success': True, 'strict': True, 'blockedDomains': ['a.example'], 'allowedDomains': ['b.example']}
        assert c.get('/api/admin/email-policy').get_json()['strict'] is True
        assert c.post('/api/admin/email-policy', json={'blockedDomains': 'not-a-list'}).status_code == 400
        assert authed_client(app_module, uid='u').post('/api/admin/email-policy', json={'strict': True}).status_code == 403
    finally:
        app_module.email_policy.set(False, [], [])
