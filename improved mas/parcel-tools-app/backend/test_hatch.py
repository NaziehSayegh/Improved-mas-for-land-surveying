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


# ---- true arcs everywhere (holes too): few corners, exact area ----
def _corner_count(ent):
    segs = ent.get('segments') or []
    return len([s for s in segs if s['type'] == 'line'])


def test_round_hole_keeps_arcs_and_exact_area():
    d, h = _doc()
    h.paths.add_polyline_path(RECT_CCW, is_closed=True, flags=1)
    ep = h.paths.add_edge_path(flags=16)
    ep.add_arc((50, 25), 10, 0, 180)
    ep.add_arc((50, 25), 10, 180, 360)
    area, ent = _hatch_area(d)
    assert _corner_count(ent) <= 12                       # was 135 corners
    assert area == pytest.approx(5000 - math.pi * 100, rel=1e-6)


@pytest.mark.parametrize('outer_ccw', [True, False])
def test_round_hole_either_winding(outer_ccw):
    d, h = _doc()
    h.paths.add_polyline_path(RECT_CCW if outer_ccw else RECT_CW, is_closed=True, flags=1)
    ep = h.paths.add_edge_path(flags=16)
    ep.add_arc((50, 25), 10, 0, 180, ccw=True)
    ep.add_arc((50, 25), 10, 180, 360, ccw=True)
    area, _ = _hatch_area(d)
    assert area == pytest.approx(5000 - math.pi * 100, rel=1e-6)


def test_rounded_corner_and_rect_hole():
    d, h = _doc()
    ep = h.paths.add_edge_path(flags=1)
    ep.add_line((0, 0), (90, 0)); ep.add_arc((90, 10), 10, 270, 360, ccw=True)
    ep.add_line((100, 10), (100, 50)); ep.add_line((100, 50), (0, 50)); ep.add_line((0, 50), (0, 0))
    h.paths.add_polyline_path(HOLE_CCW, is_closed=True, flags=16)
    area, ent = _hatch_area(d)
    assert _corner_count(ent) <= 12
    assert area == pytest.approx(5000 - 100 + math.pi * 100 / 4 - 400, rel=1e-6)


def test_full_circle_and_half_disc_are_exact_with_few_corners():
    d, h = _doc()
    h.paths.add_edge_path().add_arc((0, 0), 10, 0, 360)
    area, ent = _hatch_area(d)
    assert _corner_count(ent) == 4 and area == pytest.approx(math.pi * 100, rel=1e-6)
    d, h = _doc()
    ep = h.paths.add_edge_path(); ep.add_arc((0, 0), 50, 0, 180); ep.add_line((-50, 0), (50, 0))
    area, ent = _hatch_area(d)
    assert _corner_count(ent) == 3 and area == pytest.approx(math.pi * 2500 / 2, rel=1e-6)


def test_island_inside_a_hole_is_added_back():
    d, h = _doc()
    h.paths.add_polyline_path([(0, 0), (100, 0), (100, 100), (0, 100)], is_closed=True, flags=1)       # 10000
    h.paths.add_polyline_path([(10, 10), (90, 10), (90, 90), (10, 90)], is_closed=True, flags=16)       # hole 6400
    h.paths.add_polyline_path([(40, 40), (60, 40), (60, 60), (40, 60)], is_closed=True, flags=1)        # island 400
    p = os.path.join(TMP, 'island.dxf')
    d.saveas(p)
    ents = [e for e in c.post('/api/parse-cad', json={'filePath': p}).get_json()['entities'] if e.get('filled')]
    assert sorted(round(_area_like_frontend(e)) for e in ents) == [400, 3600]    # ring (10000-6400) and the island


def test_two_separate_loops_become_two_parcels():
    d, h = _doc()
    ep = h.paths.add_edge_path()
    for a, b in [((0, 0), (20, 0)), ((20, 0), (20, 10)), ((20, 10), (0, 10)), ((0, 10), (0, 0)),
                 ((0, -300), (10, -300)), ((10, -300), (10, -290)), ((10, -290), (0, -290)), ((0, -290), (0, -300))]:
        ep.add_line(a, b)
    p = os.path.join(TMP, 'two.dxf')
    d.saveas(p)
    ents = [e for e in c.post('/api/parse-cad', json={'filePath': p}).get_json()['entities'] if e.get('filled')]
    assert sorted(round(_area_like_frontend(e)) for e in ents) == [100, 200]


# ---- hatch appearance (pattern / solid / gradient) is sent to the CAD view ----
def _hatch_entity(doc):
    p = os.path.join(TMP, 'style.dxf')
    doc.saveas(p)
    ents = [e for e in c.post('/api/parse-cad', json={'filePath': p}).get_json()['entities'] if e.get('filled')]
    assert len(ents) == 1
    return ents[0]


def test_pattern_hatch_sends_its_pattern_lines():
    d = ezdxf.new('R2010')
    h = d.modelspace().add_hatch(color=1)
    h.set_pattern_fill('ANSI31', scale=2.0)
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    style = _hatch_entity(d)['hatch']
    assert style['solid'] is False and style['name'] == 'ANSI31'
    assert len(style['lines']) == 1 and style['lines'][0]['angle'] == pytest.approx(45.0)
    ox, oy = style['lines'][0]['offset']
    assert math.hypot(ox, oy) == pytest.approx(6.35, rel=1e-3)          # 3.175 x scale 2


def test_crosshatch_has_two_line_families_and_angle_is_applied():
    d = ezdxf.new('R2010')
    h = d.modelspace().add_hatch(color=2)
    h.set_pattern_fill('ANSI37', scale=1.0, angle=15)
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    lines = _hatch_entity(d)['hatch']['lines']
    assert sorted(round(l['angle']) for l in lines) == [60, 150]


def test_solid_hatch_is_marked_solid_and_gradient_is_reported():
    d = ezdxf.new('R2010')
    h = d.modelspace().add_hatch(color=3)
    h.set_solid_fill(color=3)
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    style = _hatch_entity(d)['hatch']
    assert style['solid'] is True and style['lines'] == [] and style['gradient'] is None
    d = ezdxf.new('R2010')
    h = d.modelspace().add_hatch(color=3)
    h.set_gradient((255, 0, 0), (0, 0, 255))
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    g = _hatch_entity(d)['hatch']['gradient']
    assert g['color1'] == '#ff0000' and g['color2'] == '#0000ff'


def test_hatch_with_hole_sends_separate_loops_for_drawing():
    d, h = _doc()
    h.paths.add_polyline_path(RECT_CCW, is_closed=True, flags=1)
    h.paths.add_polyline_path(HOLE_CW, is_closed=True, flags=16)
    _, ent = _hatch_area(d)
    assert len(ent['rings']) == 2 and sorted(len(r) for r in ent['rings']) == [4, 4]
    d, h = _doc()
    h.paths.add_polyline_path(RECT_CCW, is_closed=True)
    _, ent = _hatch_area(d)
    assert 'rings' not in ent                      # simple hatches keep the lighter format
