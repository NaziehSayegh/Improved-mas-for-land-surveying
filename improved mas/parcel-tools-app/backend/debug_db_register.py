import urllib.request
import json
import sys
import os

# Add current directory to path so we can import license_manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from license_manager import LicenseManager

def test_db_register():
    print("=== Testing DB Registration ===")
    
    # Initialize LicenseManager to get credentials
    lm = LicenseManager('.')
    
    print(f"Supabase URL: {lm.supabase_url}")
    print(f"Supabase Key: {lm.supabase_key[:10]}...")
    
    # Test Data
    license_key = "TEST-KEY-12345"
    email = "test@example.com"
    machine_id = "TEST-MACHINE-ID"
    
    print(f"\nRegistering:\nKey: {license_key}\nEmail: {email}\nMachine: {machine_id}")
    
    rpc_url = f"{lm.supabase_url}/rest/v1/rpc/register_new_license"
    headers = {
        "apikey": lm.supabase_key,
        "Authorization": f"Bearer {lm.supabase_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "p_license_key": license_key,
        "p_email": email,
        "p_machine_id": machine_id
    }
    
    try:
        req = urllib.request.Request(rpc_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        
        with urllib.request.urlopen(req) as response:
            print(f"\nHTTP Status: {response.status}")
            body = response.read().decode('utf-8')
            print("Response Body:")
            print(body)
            
            result = json.loads(body)
            if result.get('success'):
                print("\n✅ SUCCESS! DB updated.")
            else:
                print(f"\n❌ FAILED: {result.get('message')}")
                
    except urllib.error.HTTPError as e:
        print(f"\n❌ HTTP Error: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    test_db_register()
