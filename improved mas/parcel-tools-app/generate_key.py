import sys
import os

# Add backend to path to import license_manager
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from license_manager import LicenseManager
except ImportError:
    # Try direct import if running from backend folder
    sys.path.append(os.path.dirname(__file__))
    from license_manager import LicenseManager

def generate():
    print("=== Parcel Tools Key Generator ===")
    email = input("Enter Customer Email: ").strip()
    
    if not email:
        print("Error: Email cannot be empty")
        return

    lm = LicenseManager('.')
    key = lm.generate_license_key(email)
    
    print("\n" + "="*40)
    print(f"Customer: {email}")
    print(f"License Key: {key}")
    print("="*40)
    print("\nNEXT STEP: Go to Supabase -> 'licenses' table -> Insert Row")
    print(f"license_key: {key}")
    print(f"email: {email}")
    print("max_devices: 2")
    print("="*40)
    
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    generate()
