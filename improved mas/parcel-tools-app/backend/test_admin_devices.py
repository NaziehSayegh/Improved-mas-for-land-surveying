"""Admin: per-user PC limit and permanent account deletion; add_device must keep working."""
import os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
import app as app_module  # noqa: E402
from test_support import authed_client  # noqa: E402

svc = app_module.firebase_service
H = lambda n: ('%064x' % n)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(svc, '_is_online', lambda: False)
    svc._save_users_to_json({'u1': {'email': 'a@x.com', 'created_at': '2026-01-01'}})


def test_default_limit_is_two_devices():
    assert svc.add_device('u1', H(1), 'A')['success']
    assert svc.add_device('u1', H(2), 'B')['success']
    r = svc.add_device('u1', H(3), 'C')
    assert not r['success'] and '2' in r['error']
    assert svc.add_device('u1', H(1), 'A')['success']  # known device still allowed


def test_raised_limit_allows_more_pcs_and_is_validated():
    assert svc.set_user_max_devices('u1', 4)['success']
    for n in range(1, 5):
        assert svc.add_device('u1', H(n), 'P')['success']
    assert not svc.add_device('u1', H(5), 'P')['success']
    assert not svc.set_user_max_devices('u1', 0)['success']
    assert not svc.set_user_max_devices('u1', 'abc')['success']
    assert not svc.set_user_max_devices('u1', 51)['success']


def test_delete_user_removes_record():
    assert svc.delete_user_account('u1')['success']
    assert 'u1' not in svc._load_users_from_json()


def test_admin_cannot_delete_self():
    c = authed_client(app_module, uid='admin1')
    svc._save_users_to_json({'admin1': {'email': 'nsayegh2003@gmail.com', 'is_admin': True}})
    r = c.post('/api/admin/users/admin1/delete')
    assert r.status_code == 400
    assert 'admin1' in svc._load_users_from_json()
