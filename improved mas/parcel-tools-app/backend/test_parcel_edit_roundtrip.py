"""Regression: an edited parcel (number/corners) must survive save -> load."""
import json
import os
import tempfile

sys_path = None
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as backend
import pytest
from test_support import authed_client


def _roundtrip(parcel):
    client = authed_client(backend)
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, 'p.prcl')
        data = {
            'projectName': 'p',
            'loadedPoints': {'1': {'x': 0, 'y': 0}, '2': {'x': 10, 'y': 0},
                             '3': {'x': 10, 'y': 10}, '4': {'x': 0, 'y': 10}},
            'savedParcels': [parcel],
        }
        r = client.post('/api/project/save', json={'projectName': 'p', 'projectData': data, 'filePath': path})
        assert r.status_code == 200, r.get_json()
        r = client.post('/api/project/load', json={'filePath': path, 'fileName': 'p.prcl'})
        assert r.status_code == 200, r.get_json()
        return r.get_json()['projectData']['savedParcels'][0]


@pytest.fixture(autouse=True)
def _no_recent_files(monkeypatch):
    monkeypatch.setattr(backend, 'add_to_recent_files', lambda *a, **k: None)


def test_edited_number_survives_reload():
    # A parcel as the app holds it after one load+save cycle, then renamed in the editor:
    # `number` is the edited value, `parcelNumber` is the stale alias from the previous load.
    p = _roundtrip({'id': 'a', 'number': '102/B', 'parcelNumber': '102', 'parcel_number': '102',
                    'ids': ['1', '2', '3', '4'], 'enteredIds': ['1', '2', '3', '4'], 'curves': []})
    assert p['parcelNumber'] == '102/B'


def test_edited_corners_survive_reload():
    p = _roundtrip({'id': 'a', 'number': '5', 'parcelNumber': '5',
                    'ids': ['1', '2', '3'], 'enteredIds': ['1', '2', '3', '4'], 'curves': []})
    assert p['ids'] == ['1', '2', '3']


def test_extra_parcel_fields_survive_reload():
    # CAD-created parcels carry source='cad' (drives the CAD badge); the loader must not drop it.
    p = _roundtrip({'id': 'a', 'number': '7', 'ids': ['1', '2', '3', '4'], 'curves': [], 'source': 'cad',
                    'pointCount': 4})
    assert p.get('source') == 'cad'
    assert p.get('id') == 'a'


def test_load_skips_malformed_points_instead_of_failing(tmp_path):
    f = tmp_path / 'junk.prcl'
    f.write_text(json.dumps({
        'savedParcels': [{'number': '5', 'ids': ['2', '3', '4']}],
        'loadedPoints': {'1': None, '2': [1, 2], '3': {'x': 'q', 'y': 1}, '4': {'x': 5, 'y': 6}, '5': 'bad'},
    }))
    client = authed_client(backend)
    r = client.post('/api/project/load', json={'filePath': str(f)})
    assert r.status_code == 200, r.get_json()
    pts = r.get_json()['projectData']['loadedPoints']
    assert pts['2'] == {'x': 1.0, 'y': 2.0}
    assert pts['4'] == {'x': 5.0, 'y': 6.0}
    assert '3' not in pts and '1' not in pts and '5' not in pts
