"""The REST Firestore client and the per-user token store (no network: a fake server stands in)."""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
from fake_firebase import FakeAuth, FakeFirestore  # noqa: E402
from rest_firestore import (PermissionDenied, FirestoreError, RestFirestore, decode_value, encode_value,  # noqa: E402
                            _field_path, _leaf_paths)
from user_auth import AccountGone, NoCredentials, UserAuth, AuthError  # noqa: E402
from google.cloud.firestore_v1.base_query import FieldFilter  # noqa: E402


def make(allow=None):
    fake = FakeFirestore(allow=allow)
    return RestFirestore('demo', lambda: 'tok', opener=fake), fake


# ---------- value encoding ----------
@pytest.mark.parametrize('v', [None, True, False, 0, 7, -3, 2.5, 'x', '', {'a': 1, 'b': {'c': [1, 'two', None]}}, [], {}])
def test_value_round_trip(v):
    assert decode_value(encode_value(v)) == v


def test_wire_format_of_values():
    assert encode_value(5) == {'integerValue': '5'} and encode_value(True) == {'booleanValue': True}
    assert encode_value('a') == {'stringValue': 'a'} and encode_value(None) == {'nullValue': None}
    assert encode_value(datetime(2026, 1, 2, tzinfo=timezone.utc)) == {'timestampValue': '2026-01-02T00:00:00+00:00'.replace('+00:00', 'Z')}


def test_field_path_quotes_unsafe_segments():
    assert _field_path(['devices', 'a1b2-c3', 'last_seen']) == 'devices.`a1b2-c3`.last_seen'
    assert _field_path(['plain_name']) == 'plain_name'


def test_leaf_paths_merge_nested_but_keep_empty_maps_as_values():
    assert _leaf_paths({'a': 1, 'd': {'x': 1, 'y': {'z': 2}}, 'e': {}}) == [('a',), ('d', 'x'), ('d', 'y', 'z'), ('e',)]


# ---------- documents ----------
def test_get_missing_document_does_not_exist():
    db, _ = make()
    snap = db.collection('users').document('nope').get()
    assert snap.exists is False and snap.to_dict() is None


def test_set_replaces_and_get_returns_it():
    db, fake = make()
    db.collection('users').document('u1').set({'email': 'a@x.com', 'n': 1})
    db.collection('users').document('u1').set({'email': 'b@x.com'})
    snap = db.collection('users').document('u1').get()
    assert snap.exists and snap.id == 'u1' and snap.to_dict() == {'email': 'b@x.com'}


def test_set_merge_keeps_other_fields_and_merges_nested_maps():
    db, _ = make()
    ref = db.collection('users').document('u1')
    ref.set({'email': 'a@x.com', 'devices': {'d1': {'name': 'PC1'}}})
    ref.set({'is_active': False, 'devices': {'d2': {'name': 'PC2'}}}, merge=True)
    assert ref.get().to_dict() == {'email': 'a@x.com', 'is_active': False,
                                   'devices': {'d1': {'name': 'PC1'}, 'd2': {'name': 'PC2'}}}


def test_set_merge_with_empty_map_clears_it_like_the_admin_sdk():
    db, _ = make()
    ref = db.collection('users').document('u1')
    ref.set({'devices': {'d1': {'n': 1}}, 'keep': 1})
    ref.set({'devices': {}}, merge=True)
    assert ref.get().to_dict() == {'devices': {}, 'keep': 1}


def test_update_dotted_paths_with_uuid_device_ids():
    db, fake = make()
    ref = db.collection('users').document('u1')
    dev = '3f2c8e0a-1111-4b6e-9a77-0d5c3b9f1e22'
    ref.set({'devices': {dev: {'last_seen': 'old', 'device_name': 'PC'}}})
    ref.update({f'devices.{dev}.last_seen': 'new', 'last_login': 'now'})
    assert ref.get().to_dict() == {'devices': {dev: {'last_seen': 'new', 'device_name': 'PC'}}, 'last_login': 'now'}
    patch_url = [r[1] for r in fake.requests if r[0] == 'PATCH'][-1]
    assert 'currentDocument.exists=true' in patch_url and '%60' in patch_url        # backtick-quoted uuid segment


def test_update_of_missing_document_fails_like_the_admin_sdk():
    db, _ = make()
    with pytest.raises(FirestoreError) as e:
        db.collection('users').document('ghost').update({'a': 1})
    assert e.value.status == 404


def test_delete_document():
    db, _ = make()
    ref = db.collection('users').document('u1'); ref.set({'a': 1}); ref.delete()
    assert ref.get().exists is False


def test_ids_with_unusual_characters_are_url_encoded():
    db, fake = make()
    db.collection('users').document('a b/c').set({'x': 1})
    assert '/users/a%20b%2Fc' in fake.requests[-1][1]


# ---------- queries ----------
def test_stream_lists_every_page():
    db, _ = make()
    for i in range(650):
        db.collection('users').document(f'u{i:04d}').set({'n': i})
    ids = [s.id for s in db.collection('users').stream()]
    assert len(ids) == 650 and ids[0] == 'u0000' and ids[-1] == 'u0649'


def test_where_with_both_calling_styles_and_limit():
    db, _ = make()
    for i, email in enumerate(['a@x.com', 'b@x.com', 'a@x.com']):
        db.collection('users').document(f'u{i}').set({'email': email})
    r1 = list(db.collection('users').where('email', '==', 'a@x.com').stream())
    r2 = list(db.collection('users').where(filter=FieldFilter('email', '==', 'a@x.com')).limit(1).stream())
    assert [s.id for s in r1] == ['u0', 'u2'] and [s.id for s in r2] == ['u0']
    assert list(db.collection('users').where('email', '==', 'zzz').stream()) == []


def test_unsupported_operator_is_rejected():
    db, _ = make()
    with pytest.raises(ValueError):
        db.collection('users').where('a', 'like', 1)


# ---------- authorisation ----------
def test_every_request_carries_the_users_token():
    db, fake = make()
    db.collection('users').document('u1').get()
    assert all(r[3] == 'tok' for r in fake.requests)


def test_permission_denied_is_reported_as_such():
    db, _ = make(allow=lambda method, coll, doc, token: False)
    with pytest.raises(PermissionDenied):
        db.collection('users').document('someone-else').get()
    with pytest.raises(PermissionDenied):
        list(db.collection('users').stream())


def test_missing_token_is_unauthenticated():
    fake = FakeFirestore(); fake.token_ok = lambda t: False
    db = RestFirestore('demo', lambda: 'bad', opener=fake)
    with pytest.raises(PermissionDenied):
        db.collection('users').document('u').get()


# ---------- UserAuth ----------
def make_auth(tmp_path, clock=None):
    fa = FakeAuth()
    kwargs = {'clock': clock} if clock else {}
    return UserAuth('apikey', str(tmp_path), opener=fa, **kwargs), fa


def test_sign_up_remembers_tokens_and_persists_them_privately(tmp_path):
    ua, fa = make_auth(tmp_path)
    uid = ua.sign_up('a@x.com', 'password123')
    assert ua.current_uid == uid and ua.has_credentials() and ua.id_token() == f'id-{uid}-0'
    state_file = tmp_path / 'auth_state.json'
    assert json.loads(state_file.read_text())['current_uid'] == uid
    if os.name == 'posix':
        assert oct(os.stat(state_file).st_mode & 0o777) == '0o600'
    again = UserAuth('apikey', str(tmp_path), opener=fa)                      # survives an app restart
    assert again.current_uid == uid and again.has_credentials()


def test_duplicate_signup_is_an_auth_error(tmp_path):
    ua, _ = make_auth(tmp_path); ua.sign_up('a@x.com', 'password123')
    with pytest.raises(AuthError) as e:
        ua.sign_up('a@x.com', 'password123')
    assert 'EMAIL_EXISTS' in str(e.value)


def test_expired_id_token_is_refreshed_with_the_refresh_token(tmp_path):
    now = [1000.0]
    ua, fa = make_auth(tmp_path, clock=lambda: now[0])
    uid = ua.sign_up('a@x.com', 'password123')
    now[0] += 3600 - 60                       # inside the safety margin: must refresh
    tok = ua.id_token()
    assert tok != f'id-{uid}-0' and any('securetoken' in c for c in fa.calls)
    assert ua.id_token() == tok               # fresh again, no second refresh
    assert sum('securetoken' in c for c in fa.calls) == 1


def test_not_signed_in_raises(tmp_path):
    ua, _ = make_auth(tmp_path)
    assert not ua.has_credentials()
    with pytest.raises(NoCredentials):
        ua.id_token()


def test_deleted_or_disabled_account_is_detected_and_forgotten(tmp_path):
    now = [1000.0]
    ua, fa = make_auth(tmp_path, clock=lambda: now[0])
    uid = ua.sign_up('a@x.com', 'password123')
    fa.users[uid]['gone'] = True
    now[0] += 7200
    with pytest.raises(AccountGone):
        ua.id_token()
    assert not ua.has_credentials() and ua.current_uid is None


def test_delete_self_removes_login_and_forgets(tmp_path):
    ua, fa = make_auth(tmp_path); ua.sign_up('a@x.com', 'password123')
    ua.delete_self()
    assert fa.users == {} and not ua.has_credentials()


def test_forget_logs_out(tmp_path):
    ua, _ = make_auth(tmp_path); ua.sign_up('a@x.com', 'password123')
    ua.forget()
    assert not ua.has_credentials()
