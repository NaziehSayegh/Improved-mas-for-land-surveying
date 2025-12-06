
import sys
import os
sys.path.insert(0, os.getcwd())
from license_manager import LicenseManager

# Mock valid gumroad response (injecting into class)
def mock_verify_gumroad_key(self, key):
    print("MOCK: Verifying Gumroad Key -> VALID")
    return {'valid': True, 'email': 'test@test.com'}

LicenseManager.verify_gumroad_key = mock_verify_gumroad_key

# Mock online validation to return "Invalid license key" to force Gumroad check path
def mock_validate_online(self, k, e, m):
    print("MOCK: Online Validation -> Invalid (forcing fallback)")
    return {'success': False, 'message': 'Invalid license key'}

LicenseManager.validate_online = mock_validate_online

lm = LicenseManager('./data')
try:
    print("Attempting activation with MOCK data...")
    # This should trigger lines 295+ in activate_license where json usage happens
    lm.activate_license("TEST-KEY", "test@test.com")
    print("Success: No crash occurred!")
except Exception as e:
    print("\n---------------- CRASH DETECTED ----------------")
    import traceback
    traceback.print_exc()
    print(f"Error: {e}")
