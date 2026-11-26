"""The version number is written in several places by hand at every release. They must all agree."""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.abspath(os.path.join(HERE, '..'))
REPO = os.path.abspath(os.path.join(APP_DIR, '..', '..'))
sys.path.insert(0, HERE)


def _read(*parts):
    with open(os.path.join(*parts), encoding='utf-8') as f:
        return f.read()


def _package_version():
    return json.loads(_read(APP_DIR, 'package.json'))['version']


def test_backend_fallback_version_matches_package_json(monkeypatch):
    # In the packaged app the version comes from Electron (package.json). The built-in fallback is what a dev run
    # or any other launch uses, and what gets recorded against the user, so it must not drift.
    monkeypatch.delenv('PARCEL_TOOLS_VERSION', raising=False)
    src = _read(HERE, 'app.py')
    m = re.search(r"APP_VERSION = os\.environ\.get\('PARCEL_TOOLS_VERSION'\) or '([^']+)'", src)
    assert m, 'APP_VERSION line not found'
    assert m.group(1) == _package_version()


def test_release_notes_lead_with_the_current_version():
    first = re.search(r"What's New in v(\d+\.\d+\.\d+)", _read(APP_DIR, 'RELEASE_NOTES.md'))
    assert first and first.group(1) == _package_version()


def test_website_and_purchase_page_name_the_current_version():
    v = _package_version()
    site = _read(REPO, 'index.html')
    assert f'releases/download/v{v}/Parcel-Tools-Setup-{v}.exe' in site
    assert f'v{v} Released' in site
    assert f'Version {v} Premium' in _read(APP_DIR, 'public', 'buy.html')


def test_update_window_fallbacks_name_the_current_version():
    v = _package_version()
    src = _read(APP_DIR, 'src', 'components', 'UpdateManagerModal.jsx')
    versions = set(re.findall(r"\|\| '(\d+\.\d+\.\d+)'", src))
    assert versions == {v}, versions
