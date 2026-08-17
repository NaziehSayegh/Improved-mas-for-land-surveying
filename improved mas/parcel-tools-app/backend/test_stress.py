import requests
import time
import os
import concurrent.futures

BASE_URL = 'http://localhost:5000/api'

def main():
    # 1. Health & status check
    try:
        status_res = requests.get(f'{BASE_URL}/compress/status', timeout=5)
        print('Engine Status:', status_res.status_code, status_res.json())
    except Exception as e:
        print('Error connecting to backend:', e)
        return

    # 2. Prepare 50 synthetic test files
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

    # 3. Test concurrent compression
    def send_compress_req(batch_id):
        res = requests.post(f'{BASE_URL}/compress-files', json={
            'files': test_files,
            'compressionLevel': 6,
            'comment': f'Stress test batch {batch_id}'
        }, timeout=15)
        return batch_id, res.status_code, res.json()

    start = time.time()
    print('==> Launching 10 simultaneous multi-file compression requests (510 files total across workers)...')
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(send_compress_req, i) for i in range(10)]
        for f in concurrent.futures.as_completed(futures):
            b_id, code, data = f.result()
            print(f'  [Batch {b_id}] Status: {code}, Files: {data.get("filesCount")}, Compressed Size: {data.get("compressedSizeBytes")} bytes, Ratio: {data.get("compressionRatioPercent")}% in {data.get("durationMs")}ms')

    total_time = time.time() - start
    print(f'==> All simultaneous compression tasks completed in {total_time:.2f}s!')

    # 4. Test project archive export endpoint
    print('==> Testing project archive export...')
    proj_res = requests.post(f'{BASE_URL}/project/export-archive', json={
        'projectName': 'CompleteSurveyProject',
        'projectData': {
            'savedParcels': [{'id': 1, 'number': '101', 'area': 5000, 'ids': ['1', '2', '3', '4']}],
            'points': {'1': {'x': 100, 'y': 200}, '2': {'x': 200, 'y': 200}, '3': {'x': 200, 'y': 300}, '4': {'x': 100, 'y': 300}}
        }
    }, timeout=10)
    print('Project Archive Result:', proj_res.status_code, proj_res.json())

if __name__ == '__main__':
    main()
