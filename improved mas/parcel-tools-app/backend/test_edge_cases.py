import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module

app = app_module.app
client = app.test_client()

def test_all_edge_cases():
    print("==================================================================")
    print("SURVEYING & GEOMETRY EDGE CASE VALIDATION SUITE")
    print("==================================================================")

    # 1. Closed traverse repeat vertex [P1, P2, P3, P4, P1]
    res1 = client.post('/api/calculate-area', json={
        'points': [
            {'x': 0, 'y': 0},
            {'x': 100, 'y': 0},
            {'x': 100, 'y': 50},
            {'x': 0, 'y': 50},
            {'x': 0, 'y': 0} # Duplicate closing point
        ],
        'curves': []
    })
    assert res1.status_code == 200, f"Failed: {res1.get_json()}"
    data1 = res1.get_json()
    assert data1['area'] == 5000.0, f"Expected 5000.0, got {data1['area']}"
    assert data1['point_count'] == 4, f"Expected 4 corners, got {data1['point_count']}"
    print("✅ 1. Closed Traverse Repeat Vertex: PASSED (Area: 5000.0 m², Corners: 4)")

    # 2. Negative & Large UTM Coordinates
    res2 = client.post('/api/calculate-area', json={
        'points': [
            {'x': -500.5, 'y': -200.25},
            {'x': 1000.5, 'y': -200.25},
            {'x': 1000.5, 'y': 800.75},
            {'x': -500.5, 'y': 800.75}
        ],
        'curves': []
    })
    assert res2.status_code == 200
    data2 = res2.get_json()
    expected_area = 1501.0 * 1001.0
    assert abs(data2['area'] - expected_area) < 1e-4, f"Mismatch: {data2['area']} vs {expected_area}"
    print(f"✅ 2. Negative & Float Coordinates: PASSED (Area: {data2['area']} m²)")

    # 3. String formatted numbers in JSON payload (tolerance against malformed input)
    res3 = client.post('/api/calculate-area', json={
        'points': [
            {'x': "100.0", 'y': "200.0"},
            {'x': "300.0", 'y': "200.0"},
            {'x': "300.0", 'y': "400.0"},
            {'x': "100.0", 'y': "400.0"}
        ],
        'curves': []
    })
    assert res3.status_code == 200
    assert res3.get_json()['area'] == 40000.0
    print("✅ 3. String-formatted Coordinates Sanitization: PASSED (Area: 40000.0 m²)")

    # 4. Curve Adjustments (Positive bulge, Negative bulge, and High-curvature Arc)
    res4 = client.post('/api/calculate-area', json={
        'points': [
            {'x': 0, 'y': 0},
            {'x': 100, 'y': 0},
            {'x': 100, 'y': 100},
            {'x': 0, 'y': 100}
        ],
        'curves': [
            {'fromIndex': 0, 'toIndex': 1, 'M': 10.0, 'sign': 1},   # Outward curve
            {'fromIndex': 2, 'toIndex': 3, 'M': 5.0, 'sign': -1}    # Inward curve
        ]
    })
    assert res4.status_code == 200
    data4 = res4.get_json()
    assert data4['baseArea'] == 10000.0
    assert len(data4['curveDetails']) == 2
    assert data4['area'] > 10000.0 # Net positive adjustment
    print(f"✅ 4. Curve Adjustments (Positive & Negative): PASSED (Final Area: {data4['area']:.2f} m²)")

    # 5. Invalid / Edge Polygon Rejection (< 3 points)
    res5 = client.post('/api/calculate-area', json={
        'points': [{'x': 0, 'y': 0}, {'x': 10, 'y': 10}],
        'curves': []
    })
    assert res5.status_code == 400
    print("✅ 5. Insufficient Points Rejection (< 3 pts): PASSED (Returned 400 cleanly)")

    # 6. Compression Edge Cases: Empty file, Unicode characters, and Special comments
    res6 = client.post('/api/compress-files', json={
        'files': [
            {'archiveName': 'empty_test.txt', 'content': ''},
            {'archiveName': 'unicode_arabic_عربي.txt', 'content': 'إحداثيات مساحية دقيقة - فلسطين'},
            {'archiveName': 'nested/folder/data.pnt', 'content': '1, 100.5, 200.5\n2, 300.5, 400.5'}
        ],
        'compressionLevel': 9,
        'comment': 'Unicode & Edge Case Archive'
    })
    assert res6.status_code == 200
    data6 = res6.get_json()
    assert data6['filesCount'] == 3
    print(f"✅ 6. Compression Edge Cases (Empty, Unicode, Deeply Nested): PASSED ({data6['compressedSizeBytes']}B)")

    print("\n==================================================================")
    print("ALL EDGE CASES TESTED & VERIFIED WITH 100% SUCCESS")
    print("==================================================================")

if __name__ == '__main__':
    test_all_edge_cases()
