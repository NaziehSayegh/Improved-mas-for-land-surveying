"""Shared helper so test scripts can call the (now authenticated) API."""


def authed_client(app_module, uid='test-user'):
    """Flask test client that sends a valid session token with every request."""
    lm = app_module.license_manager
    token = lm.generate_session_token(uid, lm.get_machine_id_hash())
    client = app_module.app.test_client()
    client.environ_base['HTTP_X_SESSION_TOKEN'] = token
    return client
