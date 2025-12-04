import sys
import os

# Add current directory to path so we can import license_manager
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from license_manager import LicenseManager

def test_key():
    email = "nsayegh2003@yahoo.com"
    key = "0000-0000-255D-5D55"
    
    print(f"Testing Email: '{email}'")
    print(f"Testing Key: '{key}'")
    
    lm = LicenseManager('.')
    
    # 1. Test Generation
    generated = lm.generate_license_key(email)
    print(f"Generated Key: '{generated}'")
    
    # 2. Test Validation
    is_valid = lm.validate_license_key(key, email)
    print(f"Is Valid: {is_valid}")
    
    if not is_valid:
        print("\n--- Debugging Mismatch ---")
        clean_key = key.replace('-', '').upper()
        clean_email = email.lower().strip()
        print(f"Clean Key: '{clean_key}'")
        print(f"Clean Email: '{clean_email}'")
        
        expected = lm.generate_license_key(clean_email)
        expected_clean = expected.replace('-', '').upper()
        print(f"Expected Clean: '{expected_clean}'")
        
        print(f"Match? {clean_key == expected_clean}")

if __name__ == "__main__":
    test_key()
