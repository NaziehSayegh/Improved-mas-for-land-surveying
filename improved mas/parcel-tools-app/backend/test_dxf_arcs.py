"""DXF arcs: bulge polylines (incl. arcs longer than a half circle), heavy POLYLINE, open polylines, ARC/CIRCLE."""
import math, os, sys, tempfile
_home = tempfile.mkdtemp()
os.environ['HOME'] = _home
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'
os.environ['LOCALAPPDATA'] = _home
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pytest  # noqa: E402
ezdxf = pytest.importorskip('ezdxf')
import app as app_module  # noqa: E402
from test_support import authed_client  # noqa: E402

c = authed_client(app_module)
TMP = tempfile.mkdtemp()


def _parse(doc):
    p = os.path.join(TMP, 'a.dxf')
    doc.saveas(p)
    r = c.post('/api/parse-cad', json={'filePath': p})
    assert r.status_code == 200
    return r.get_json()['entities']


def _seg_area(r, theta):
    return 0.5 * r * r * (theta - math.sin(theta))


@pytest.mark.parametrize('bulge', [0.2, 0.5, 1.0, 1.5, 3.0, -0.2, -1.0, -1.5, -3.0])
def test_arc_params_sweep_and_endpoints(bulge):
    a = app_module._bulge_arc_params(0, 0, 10, 0, bulge)
    assert math.hypot(0 - a['cx'], 0 - a['cy']) == pytest.approx(a['r'], abs=1e-4)
    assert math.hypot(10 - a['cx'], 0 - a['cy']) == pytest.approx(a['r'], abs=1e-4)
    s, e = a['startAngle'], a['endAngle']
    sweep = (e - s) % (2 * math.pi) if bulge > 0 else -((s - e) % (2 * math.pi))
    assert sweep == pytest.approx(4 * math.atan(bulge), abs=1e-4)


def _tri_with_arc(bulge, heavy=False):
    doc = ezdxf.new('R2010')
    msp = doc.modelspace()
    if heavy:
        pl = msp.add_polyline2d([(0, 0), (10, 0), (5, 10)], close=True, dxfattribs={'layer': 'PARCEL'})
        pl.vertices[0].dxf.bulge = bulge
    else:
        msp.add_lwpolyline([(0, 0, 0, 0, bulge), (10, 0), (5, 10)], format='xyseb', close=True,
                           dxfattribs={'layer': 'PARCEL'})
    return doc


@pytest.mark.parametrize('heavy', [False, True])
@pytest.mark.parametrize('bulge', [0.3, 1.0, 2.0, 4.0])
def test_closed_polyline_with_arc_keeps_exact_arc(bulge, heavy):
    ents = _parse(_tri_with_arc(bulge, heavy))
    pl = [e for e in ents if e['type'] in ('LWPOLYLINE', 'POLYLINE')]
    assert len(pl) == 1, 'polyline lost'
    arcs = [s for s in pl[0]['segments'] if s['type'] == 'arc']
    assert len(arcs) == 1
    theta = 4 * math.atan(bulge)
    r = 10 / (2 * math.sin(theta / 2))
    assert arcs[0]['r'] == pytest.approx(r, rel=1e-4)
    # flattened points must enclose triangle + exact segment
    pts = [(p['x'], p['y']) for p in pl[0]['points']]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    area = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts))) / 2)
    # arc bulges outward of a ccw triangle? bulge>0 on bottom edge goes below chord => adds area
    assert area == pytest.approx(50 + _seg_area(r, theta), rel=2e-3)


def test_heavy_polyline_works_without_any_lwpolyline_before_it():
    ents = _parse(_tri_with_arc(1.0, heavy=True))
    assert any(e['type'] == 'POLYLINE' for e in ents)


def test_open_polyline_ignores_bulge_on_last_vertex():
    doc = ezdxf.new('R2010')
    doc.modelspace().add_lwpolyline([(0, 0), (10, 0), (10, 10, 0, 0, 1.0)], format='xyseb',
                                    dxfattribs={'layer': 'PARCEL'})
    ents = _parse(doc)
    pl = [e for e in ents if e['type'] == 'LWPOLYLINE'][0]
    assert not any(s['type'] == 'arc' for s in pl['segments'])
    assert len(pl['points']) == 3


def test_arc_entity_is_smooth_for_large_radius():
    doc = ezdxf.new('R2010')
    doc.modelspace().add_arc((0, 0), 1000, 0, 180)
    ent = [e for e in _parse(doc) if e['type'] == 'ARC'][0]
    pts = ent['points']
    assert len(pts) > 60
    mx = max(abs(math.hypot(p['x'], p['y']) - 1000) for p in pts)
    assert mx < 0.01
    # sagitta between points small
    d = math.hypot(pts[1]['x'] - pts[0]['x'], pts[1]['y'] - pts[0]['y'])
    assert 1000 - math.sqrt(1000 ** 2 - (d / 2) ** 2) < 0.5


def test_arc_start_equals_end_is_full_circle():
    doc = ezdxf.new('R2010')
    doc.modelspace().add_arc((0, 0), 10, 90, 90)
    ent = [e for e in _parse(doc) if e['type'] == 'ARC']
    assert ent and len(ent[0]['points']) > 30


def test_circle_area_error_small():
    doc = ezdxf.new('R2010')
    doc.modelspace().add_circle((0, 0), 100)
    ent = [e for e in _parse(doc) if e['type'] == 'CIRCLE'][0]
    pts = [(p['x'], p['y']) for p in ent['points']][:-1]
    area = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts))) / 2)
    assert area == pytest.approx(math.pi * 100 ** 2, rel=2e-4)


def test_mirrored_arc_extrusion():
    doc = ezdxf.new('R2010')
    doc.modelspace().add_arc((10, 0), 5, 0, 90, dxfattribs={'extrusion': (0, 0, -1)})
    ent = [e for e in _parse(doc) if e['type'] == 'ARC'][0]
    # in WCS the centre is at x=-10, so the arc is to the left of x=-5
    assert all(p['x'] <= -5 + 1e-3 for p in ent['points'])
