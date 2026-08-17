import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module

app = app_module.app
client = app.test_client()

def run_end_to_end_verification():
    print("==================================================================")
    print("PARCEL TOOLS COMPLETE END-TO-END FRONTEND <-> BACKEND TEST")
    print("==================================================================")

    # 1. Health & paths
    h = client.get('/api/health')
    assert h.status_code == 200 and h.get_json()['status'] == 'ok'
    print("✅ 1. Health Endpoint: 200 OK")

    # 2. License Status
    lic = client.get('/api/license/status')
    assert lic.status_code == 200
    print(f"✅ 2. License Status: 200 OK (Status: {lic.get_json().get('status')})")

    # 3. Points Import & Parse
    raw_pnt = "1, 1000.0, 2000.0\n2, 1050.0, 2000.0\n3, 1050.0, 2040.0\n4, 1000.0, 2040.0"
    imp = client.post('/api/import-points', json={'content': raw_pnt, 'format': 'auto'})
    assert imp.status_code == 200
    pts = imp.get_json().get('points', [])
    assert len(pts) == 4
    print(f"✅ 3. Points Ingestion & Parsing: 200 OK ({len(pts)} points imported)")

    # 4. Single Parcel Calculation
    calc = client.post('/api/calculate-area', json={
        'points': pts,
        'curves': [{'fromIndex': 1, 'toIndex': 2, 'M': 5.0, 'sign': 1}]
    })
    assert calc.status_code == 200
    c_data = calc.get_json()
    assert c_data['baseArea'] == 2000.0
    print(f"✅ 4. Area Calculation + Curves: 200 OK (Base: {c_data['baseArea']} m², Final: {c_data['area']:.2f} m²)")

    # 5. Batch Areas Calculation
    batch = client.post('/api/calculate-batch-areas', json={
        'parcels': [
            {'id': 'P1', 'ids': ['1', '2', '3', '4'], 'curves': []},
            {'id': 'P2', 'ids': ['2', '3', '4', '1'], 'curves': []}
        ],
        'points': {p['id']: {'x': p['x'], 'y': p['y']} for p in pts}
    })
    assert batch.status_code == 200
    b_res = batch.get_json().get('results', [])
    assert len(b_res) == 2
    print(f"✅ 5. Batch Parcel Area Calculations: 200 OK ({len(b_res)} parcels computed)")

    # 6. Save & Load Project State
    import tempfile
    temp_dir = tempfile.gettempdir()
    proj_path = os.path.join(temp_dir, "test_e2e_project.prcl")
    proj_data = {
        'projectName': 'E2E_Test_Project',
        'savedParcels': [{'id': 1, 'number': '101', 'ids': ['1', '2', '3', '4'], 'area': 2000.0, 'perimeter': 180.0}],
        'loadedPoints': {p['id']: {'x': p['x'], 'y': p['y']} for p in pts},
        'fileHeading': {'block': '1', 'quarter': '2', 'parcels': '101', 'place': 'Ramallah', 'additionalInfo': 'Test'}
    }
    save_res = client.post('/api/project/save', json={
        'projectName': 'E2E_Test_Project',
        'projectData': proj_data,
        'filePath': proj_path
    })
    assert save_res.status_code == 200
    print(f"✅ 6. Project Persistence to Disk: 200 OK (Saved to {proj_path})")

    load_res = client.post('/api/project/load', json={'filePath': proj_path})
    assert load_res.status_code == 200
    loaded_data = load_res.get_json().get('projectData', {})
    assert loaded_data.get('projectName') == 'E2E_Test_Project'
    print(f"✅ 7. Project Loading & State Verification: 200 OK (Loaded {len(loaded_data.get('savedParcels', []))} parcels)")

    # 8. Export Points File
    exp_pts = client.post('/api/export-points', json={'points': pts})
    assert exp_pts.status_code == 200
    assert '1, 1000.0, 2000.0' in exp_pts.get_json().get('data', '')
    print("✅ 8. Points Export: 200 OK")

    # 9. Multi-file Streaming Compression Engine
    comp_res = client.post('/api/compress-files', json={
        'files': [
            {'archiveName': 'project.prcl', 'content': json.dumps(proj_data)},
            {'archiveName': 'coordinates.pnt', 'content': raw_pnt}
        ],
        'compressionLevel': 6,
        'comment': 'End-to-end verification archive'
    })
    assert comp_res.status_code == 200
    c_info = comp_res.get_json()
    assert c_info['filesCount'] == 2
    print(f"✅ 9. Multi-File Chunked Compression: 200 OK ({c_info['compressedSizeBytes']} bytes created in {c_info['durationMs']}ms)")

    # 10. One-click Comprehensive Project Archive Exporter
    arch_res = client.post('/api/project/export-archive', json={
        'projectName': 'E2E_Complete_Archive',
        'projectData': proj_data
    })
    assert arch_res.status_code == 200
    arch_info = arch_res.get_json()
    assert arch_info['success'] is True
    print(f"✅ 10. Full Project Backup Archive Exporter: 200 OK (Archive created in {arch_info['durationMs']}ms)")

    print("\n==================================================================")
    print("ALL 10 CORE MODULES PASSED END-TO-END VERIFICATION!")
    print("==================================================================")

if __name__ == '__main__':
    run_end_to_end_verification()
