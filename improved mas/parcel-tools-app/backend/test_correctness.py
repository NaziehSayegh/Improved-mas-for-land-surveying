"""Regression tests for calculation / file-handling / robustness bugs found in the audit."""
import json, os, sys, tempfile, threading
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module  # noqa: E402
from test_support import authed_client  # noqa: E402

c = authed_client(app_module)
TMP = tempfile.mkdtemp()
SQ = [{'x': 0, 'y': 0}, {'x': 10, 'y': 0}, {'x': 10, 'y': 10}, {'x': 0, 'y': 10}]


# ---------- calculate-area ----------
def test_area_basic_and_curve_still_work():
    r = c.post('/api/calculate-area', json={'points': SQ})
    assert r.status_code == 200 and r.get_json()['area'] == 100.0 and r.get_json()['warnings'] == []
    r = c.post('/api/calculate-area', json={'points': SQ, 'curves': [{'M': 1, 'sign': 1, 'fromIndex': 0, 'toIndex': 1}]})
    assert r.status_code == 200 and r.get_json()['area'] > 100.0


def test_bad_bodies_give_400_not_500():
    for body in ([1, 2], {'points': 5}, {'points': 'abc'}, {'points': None}):
        assert c.post('/api/calculate-area', json=body).status_code == 400, body
    assert c.post('/api/calculate-area').status_code == 400   # no JSON at all


def test_bad_curves_rejected():
    for curve in ({'M': 'abc'}, {'M': 1e999, 'fromIndex': 0, 'toIndex': 1}, {'M': 1, 'fromIndex': 'a', 'toIndex': 1}, 5):
        r = c.post('/api/calculate-area', data=json.dumps({'points': SQ, 'curves': [curve]}), content_type='application/json')
        assert r.status_code == 400, curve


def test_negative_curve_index_ignored():
    r = c.post('/api/calculate-area', json={'points': SQ, 'curves': [{'M': 1, 'fromIndex': -1, 'toIndex': -2}]})
    assert r.status_code == 200 and r.get_json()['curveAdjustment'] == 0


def test_never_returns_nan_or_infinity():
    r = c.post('/api/calculate-area', json={'points': [{'x': 0, 'y': 0}, {'x': 1e300, 'y': 0}, {'x': 1e300, 'y': 1e300}]})
    assert r.status_code == 400
    assert b'Infinity' not in r.data and b'NaN' not in r.data


def test_nan_coordinates_are_dropped():
    r = c.post('/api/calculate-area', data='{"points":[{"x":NaN,"y":0},{"x":10,"y":0},{"x":10,"y":10},{"x":0,"y":10}]}',
               content_type='application/json')
    assert r.status_code == 200 and r.get_json()['point_count'] == 3


def test_self_intersecting_boundary_is_flagged():
    bow = [{'x': 0, 'y': 0}, {'x': 10, 'y': 10}, {'x': 10, 'y': 0}, {'x': 0, 'y': 10}]
    r = c.post('/api/calculate-area', json={'points': bow})
    assert r.status_code == 200 and r.get_json()['warnings']
    assert c.post('/api/calculate-area', json={'points': SQ}).get_json()['warnings'] == []


# ---------- area error ----------
def test_area_error_validation_and_success():
    assert c.post('/api/calculate-area-error', json={'points': [{'x': 1}, {'x': 2}, {'x': 3}], 'area': 5}).status_code == 400
    assert c.post('/api/calculate-area-error', json={'points': SQ, 'area': 'abc'}).status_code == 400
    assert c.post('/api/calculate-area-error', json={'points': [dict(p, errorX=None) for p in SQ], 'area': 100}).status_code == 400
    r = c.post('/api/calculate-area-error', json={'points': SQ, 'area': 100})
    assert r.status_code == 200 and r.get_json()['standardError'] > 0


# ---------- batch ----------
def test_batch_skips_parcels_with_missing_points():
    pts = {'1': {'x': 100, 'y': 100}, '2': {'x': 110, 'y': 100}, '3': {'x': 110, 'y': 110}, '4': {'x': 100, 'y': 110}}
    r = c.post('/api/calculate-batch-areas', json={'points': pts, 'parcels': [
        {'id': 'ok', 'ids': ['1', '2', '3', '4']}, {'id': 'bad', 'ids': ['1', '2', '3', 'MISSING']}]})
    j = r.get_json()
    assert [x['id'] for x in j['results']] == ['ok'] and j['results'][0]['area'] == 100.0
    assert j['skipped'] == [{'id': 'bad', 'missingPoints': ['MISSING']}]


def test_batch_bad_input():
    assert c.post('/api/calculate-batch-areas', json={'parcels': 'x', 'points': {}}).status_code == 400
    r = c.post('/api/calculate-batch-areas', json={'parcels': [{'id': 'p', 'ids': ['1']}], 'points': {'1': None}})
    assert r.status_code == 200 and r.get_json()['results'] == []


# ---------- points files ----------
def _write(name, data):
    p = os.path.join(TMP, name)
    open(p, 'wb').write(data)
    return p


def test_bom_does_not_corrupt_first_id():
    p = _write('bom.pnt', b'\xef\xbb\xbf1,0,0\r\n2,10,0\r\n3,10,10\r\n')
    ids = [x['id'] for x in c.post('/api/reload-points-file', json={'filePath': p}).get_json()['points']]
    assert ids == ['1', '2', '3']
    ids = [x['id'] for x in c.post('/api/import-points', json={'data': '﻿1,0,0\r\n2,1,1\r\n3,2,5'}).get_json()['points']]
    assert ids == ['1', '2', '3']


def test_arabic_cp1256_ids_are_kept():
    p = _write('ar.pnt', 'أ1,0,0\n2,1,1\n'.encode('cp1256'))
    ids = [x['id'] for x in c.post('/api/reload-points-file', json={'filePath': p}).get_json()['points']]
    assert ids == ['أ1', '2']


def test_utf8_arabic_ids_are_kept():
    p = _write('ar8.pnt', 'قطعة1,0,0\n2,1,1\n'.encode('utf-8'))
    ids = [x['id'] for x in c.post('/api/reload-points-file', json={'filePath': p}).get_json()['points']]
    assert ids == ['قطعة1', '2']


def test_duplicate_ids_are_reported():
    p = _write('dup.pnt', b'1,0,0\n1,5,5\n2,1,1\n')
    j = c.post('/api/reload-points-file', json={'filePath': p}).get_json()
    assert j['count'] == 2 and j['duplicateIds'] == ['1'] and j['duplicateCount'] == 1
    j = c.post('/api/import-points', json={'data': '1,0,0\n1,5,5\n2,1,1'}).get_json()
    assert j['duplicateIds'] == ['1']


def test_export_points_validation():
    assert c.post('/api/export-points', json={'points': None}).status_code == 400
    assert c.post('/api/export-points', json={'points': [{'id': '1', 'x': 1, 'y': 2}]}).status_code == 200


# ---------- auth input ----------
def test_auth_bad_input_is_400():
    anon = app_module.app.test_client()
    assert anon.post('/api/auth/signup').status_code == 400
    assert anon.post('/api/auth/signup', json={'email': 5, 'password': '12345678'}).status_code == 400
    assert anon.post('/api/auth/signup', json={'email': 'nope', 'password': '12345678'}).status_code == 400
    assert anon.post('/api/auth/login', json={'email': None, 'password': None}).status_code == 400


def test_ai_ask_bad_messages_do_not_crash():
    assert c.post('/api/ai/ask', json={'messages': 'hi'}).status_code == 200
    assert c.post('/api/ai/ask', json={'messages': [{'role': 'user', 'content': 5}]}).status_code == 200


# ---------- persistence ----------
def test_concurrent_recent_file_writes_do_not_corrupt():
    def w(i):
        authed_client(app_module).post('/api/recent-files', json={'type': 'projects', 'path': f'/p/{i}', 'name': f'n{i}'})
    ts = [threading.Thread(target=w, args=(i,)) for i in range(40)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    data = json.load(open(app_module.RECENT_FILES_FILE))        # must be valid JSON
    assert len(data['projects']) == 40


def test_atomic_write_leaves_no_temp_files_and_replaces_content():
    from atomic_io import atomic_write_text
    p = os.path.join(TMP, 'atomic.txt')
    atomic_write_text(p, 'one')
    atomic_write_text(p, 'two')
    assert open(p).read() == 'two'
    assert not [f for f in os.listdir(TMP) if f.endswith('.tmp')]
