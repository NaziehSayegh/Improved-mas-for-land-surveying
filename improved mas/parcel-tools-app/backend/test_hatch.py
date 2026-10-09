"""Hatch -> parcel area: holes must subtract whatever their winding, and arcs must stay exact."""
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


def _signed(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def _area_like_frontend(ent):
    """Corner polygon + exact circular segments (what DxfImport computes), or flattened polygon."""
    segs = ent.get('segments')
    if segs:
        corners = [(s['x'], s['y']) for s in segs if s['type'] == 'line']
        ccw = _signed(corners) > 0
        area = abs(_signed(corners))
        for s in segs:
            if s['type'] == 'arc':
                seg = 0.5 * s['r'] ** 2 * (s['theta'] - math.sin(s['theta']))
                area += seg if ccw == s['ccw'] else -seg
        return area
    pts = [(p['x'], p['y']) for p in ent['points']]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return abs(_signed(pts))


def _hatch_area(doc):
    p = os.path.join(TMP, 'h.dxf')
    doc.saveas(p)
    r = c.post('/api/parse-cad', json={'filePath': p})
    assert r.status_code == 200
    filled = [e for e in r.get_json()['entities'] if e.get('filled')]
    assert len(filled) == 1
    return _area_like_frontend(filled[0]), filled[0]


def _doc():
    d = ezdxf.new('R2010')
    return d, d.modelspace().add_hatch()


RECT_CCW = [(0, 0), (100, 0), (100, 50), (0, 50)]
RECT_CW = RECT_CCW[::-1]
HOLE_CCW = [(20, 10), (40, 10), (40, 30), (20, 30)]
HOLE_CW = HOLE_CCW[::-1]


def test_simple_hatch():
    d, h = _doc()
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    assert _hatch_area(d)[0] == pytest.approx(5000)


@pytest.mark.parametrize('outer', [RECT_CCW, RECT_CW])
@pytest.mark.parametrize('hole', [HOLE_CCW, HOLE_CW])
def test_hole_is_subtracted_regardless_of_winding(outer, hole):
    d, h = _doc()
    h.paths.add_polyline_path(outer, is_closed=True, flags=1)
    h.paths.add_polyline_path(hole, is_closed=True, flags=16)
    assert _hatch_area(d)[0] == pytest.approx(4600)


@pytest.mark.parametrize('bulge,expected', [(-1.0, 5000 - math.pi * 25 ** 2 / 2), (1.0, 5000 + math.pi * 25 ** 2 / 2)])
def test_bulged_polyline_hatch_keeps_exact_arcs(bulge, expected):
    d, h = _doc()
    h.paths.add_polyline_path([(0, 0, 0), (100, 0, 0), (100, 50, 0), (0, 50, bulge)], is_closed=True)
    area, ent = _hatch_area(d)
    assert ent.get('segments') and len(ent['segments']) > 4 and area == pytest.approx(expected, rel=1e-6)


def test_edge_path_with_rounded_corner_is_exact():
    d, h = _doc()
    ep = h.paths.add_edge_path()
    ep.add_line((0, 0), (90, 0)); ep.add_arc((90, 10), 10, 270, 360, ccw=True)
    ep.add_line((100, 10), (100, 50)); ep.add_line((100, 50), (0, 50)); ep.add_line((0, 50), (0, 0))
    area, ent = _hatch_area(d)
    assert ent.get('segments') and area == pytest.approx(5000 - 100 + math.pi * 100 / 4, rel=1e-6)


def test_unordered_reversed_edges_are_chained():
    d, h = _doc()
    ep = h.paths.add_edge_path()
    for a, b in [((0, 50), (0, 0)), ((100, 0), (0, 0)), ((100, 50), (100, 0)), ((0, 50), (100, 50))]:
        ep.add_line(a, b)
    assert _hatch_area(d)[0] == pytest.approx(5000)


@pytest.mark.parametrize('r', [10, 100])
def test_circle_hatch_is_accurate(r):
    d, h = _doc()
    h.paths.add_edge_path().add_arc((0, 0), r, 0, 360)
    assert _hatch_area(d)[0] == pytest.approx(math.pi * r * r, rel=1e-3)   # was 2.5% off for r=10
