"""'Last seen' timestamps must carry a timezone so an admin in another timezone reads the right time."""
import os
import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_customer_mode import env, signup  # noqa: E402,F401  (the fake Firestore fixture)


def _aware_and_recent(value):
    dt = datetime.fromisoformat(value)
    assert dt.tzinfo is not None, f'{value!r} has no timezone'
    assert abs(datetime.now(timezone.utc) - dt) < timedelta(minutes=2)


def test_device_last_seen_is_timezone_aware(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    assert s.add_device(uid, 'a' * 64, 'PC one', computer_name='PC1')['success']
    (first,) = env.fs.docs[f'users/{uid}']['devices'].values()
    _aware_and_recent(first['last_seen'])
    assert s.add_device(uid, 'a' * 64, 'PC one', computer_name='PC1')['success']      # the PC is seen again
    (again,) = env.fs.docs[f'users/{uid}']['devices'].values()
    _aware_and_recent(again['last_seen'])


def test_last_login_is_timezone_aware(env):
    s = env.service('a'); uid = signup(s, 'a@x.com')
    _aware_and_recent(env.fs.docs[f'users/{uid}']['last_login'])
