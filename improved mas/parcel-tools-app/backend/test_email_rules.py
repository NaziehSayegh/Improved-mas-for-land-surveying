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
    ('a@notmailinator.com', False), ('', False), ('no-at-sign', False),
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
