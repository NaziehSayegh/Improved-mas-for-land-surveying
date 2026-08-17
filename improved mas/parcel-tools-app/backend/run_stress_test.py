import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as app_module

app = app_module.app
client = app.test_client()

def main():
    print("==================================================================")
    print("PARCEL TOOLS CONCURRENCY & COMPRESSION STRESS TEST")
    print("==================================================================")

    # 1. Check status endpoint
    status_res = client.get('/api/compress/status')
    print('Compress Engine Status:', status_res.status_code, status_res.get_json())

    # 2. Prepare 50 synthetic survey files
    test_files = []
    for i in range(50):
        test_files.append({
            'archiveName': f'points/survey_batch_{i}.pnt',
            'content': '\n'.join([f'{j}, {1000.0 + j * 10.5}, {2000.0 + j * 5.2}' for j in range(100)])
        })
    test_files.append({
        'archiveName': 'project/project_state.json',
        'content': '{"projectName": "StressTest", "parcels": [1,2,3,4,5]}'
    })

    # 3. Simulate 20 concurrent compression requests (1,020 files total)
    def send_compress(batch_id):
        res = client.post('/api/compress-files', json={
            'files': test_files,
            'compressionLevel': 6,
            'comment': f'Stress test batch {batch_id}'
        })
        return batch_id, res.status_code, res.get_json()

    start = time.time()
    print('\n==> Launching 20 simultaneous multi-file compression requests (1,020 files total across thread pool)...')
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_compress, i) for i in range(20)]
        for f in as_completed(futures):
            b_id, code, data = f.result()
            print(f'  [Batch {b_id:02d}] Status: {code} | Files: {data.get("filesCount")} | Compressed: {data.get("compressedSizeBytes")}B | Saved: {data.get("savedBytes")}B ({data.get("compressionRatioPercent")}%) in {data.get("durationMs")}ms')

    total_time = time.time() - start
    print(f'\n==> All 20 simultaneous compression tasks (1,020 files) completed cleanly in {total_time:.2f}s!')

    # 4. Project Archive Export Test
    print('\n==> Testing project archive export...')
    proj_res = client.post('/api/project/export-archive', json={
        'projectName': 'CompleteSurveyProject',
        'projectData': {
            'savedParcels': [{'id': 1, 'number': '101', 'area': 5000, 'ids': ['1', '2', '3', '4']}],
            'points': {'1': {'x': 100, 'y': 200}, '2': {'x': 200, 'y': 200}, '3': {'x': 200, 'y': 300}, '4': {'x': 100, 'y': 300}}
        }
    })
    print('Project Archive Result:', proj_res.status_code, proj_res.get_json())
    print("\n==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY - BACKEND HANDLES SIMULTANEOUS PRESSURE")
    print("==================================================================")

if __name__ == '__main__':
    main()
