"""
License Management System for Parcel Tools
Handles license validation, trial mode, and activation
"""

import json
import os
import hashlib
import hmac
from datetime import datetime, timedelta
import base64

# Secret key for license validation (CHANGE THIS TO YOUR OWN SECRET!)
LICENSE_SECRET = "PARCELTOOLS_SECRET_KEY_CHANGE_ME_2024"  # TODO: Change this!

class LicenseManager:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.license_file = os.path.join(data_dir, 'license.json')
        print(f'[License] License file path: {self.license_file}')
        print(f'[License] Data directory: {self.data_dir}')
        
    def get_license_info(self):
        """Get current license status"""
        print(f'[License] Checking license file: {self.license_file}')
        print(f'[License] File exists: {os.path.exists(self.license_file)}')
        
        if not os.path.exists(self.license_file):
            # No license file exists - check/start trial
            return self._check_trial_status()
        
        try:
            with open(self.license_file, 'r', encoding='utf-8') as f:
                license_data = json.load(f)
            
            # Check if it's a paid license
            if license_data.get('type') == 'paid':
                return self._check_paid_license(license_data)
            
            # Invalid license file, fall back to trial check
            return self._check_trial_status()
            
        except Exception as e:
            print(f"Error reading license: {e}")
            return self._check_trial_status()

    def _check_trial_status(self):
        """Check or start 7-day free trial"""
        trial_file = os.path.join(self.data_dir, 'trial_info.json')
        
        try:
            if os.path.exists(trial_file):
                with open(trial_file, 'r', encoding='utf-8') as f:
                    trial_data = json.load(f)
                
                start_date_str = trial_data.get('start_date')
                if not start_date_str:
                    # Invalid trial file, reset it
                    return self._start_new_trial(trial_file)
                
                start_date = datetime.fromisoformat(start_date_str)
                now = datetime.now()
                
                # Calculate expiration (7 days)
                expiration_date = start_date + timedelta(days=7)
                days_left = (expiration_date - now).days
                
                if now > expiration_date:
                    return {
                        'status': 'expired',
                        'is_valid': False,
                        'message': 'Trial Expired - Please Purchase'
                    }
                
                return {
                    'status': 'trial',
                    'is_valid': True,
                    'days_left': days_left + 1, # +1 to include today
                    'message': f'Trial Mode ({days_left + 1} days left)'
                }
            else:
                # Start new trial
                return self._start_new_trial(trial_file)
                
        except Exception as e:
            print(f"Trial check error: {e}")
            # Fallback to expired if error
            return {
                'status': 'error',
                'is_valid': False,
                'message': 'License Error'
            }

    def _start_new_trial(self, trial_file):
        """Start a new 7-day trial"""
        try:
            trial_data = {
                'start_date': datetime.now().isoformat(),
                'type': 'trial'
            }
            
            os.makedirs(self.data_dir, exist_ok=True)
            with open(trial_file, 'w', encoding='utf-8') as f:
                json.dump(trial_data, f, indent=2)
                
            return {
                'status': 'trial',
                'is_valid': True,
                'days_left': 7,
                'message': '7-Day Free Trial Started'
            }
        except Exception as e:
            return {
                'status': 'error',
                'is_valid': False,
                'message': f'Could not start trial: {str(e)}'
            }
    
    # Trial mode removed - customers must purchase
    def _check_paid_license(self, license_data):
        """Validate paid license key"""
        license_key = license_data.get('key', '')
        email = license_data.get('email', '')
        
        if self.validate_license_key(license_key, email):
            return {
                'status': 'activated',
                'is_valid': True,
                'email': email,
                'activated_date': license_data.get('activated_date'),
                'message': 'Licensed version'
            }
        else:
            return {
                'status': 'invalid',
                'is_valid': False,
                'message': 'Invalid license key'
            }
    
    # Trial mode removed - no free trials available
    
    def get_machine_id(self):
        """Get unique machine identifier"""
        try:
            if sys.platform == 'win32':
                cmd = 'wmic csproduct get uuid'
                uuid = subprocess.check_output(cmd).decode().split('\n')[1].strip()
                return uuid
            else:
                # Fallback for other OS
                import uuid
                return str(uuid.getnode())
        except Exception:
            # Fallback if wmic fails
            import uuid
            return str(uuid.getnode())

    def validate_online(self, license_key, email, machine_id):
        """
        Verify license with online database (Supabase)
        Returns: {'success': Bool, 'message': Str}
        """
        # TODO: Replace with your actual Supabase/API URL and Key
        API_URL = "https://vhzgtdlcgdekczerzqfh.supabase.co" 
        API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemd0ZGxjZ2Rla2N6ZXJ6cWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDU2NzQsImV4cCI6MjA4MDQyMTY3NH0.cg6OfTJxPIWTeafNkz5RwqbVTjpaFTwwHzxkxRJsfDA"
        
        if API_URL == "YOUR_SUPABASE_URL":
            # Online check disabled/not configured
            # For now, allow it (fallback to offline)
            return {'success': True, 'message': 'Online check skipped'}
            
        try:
            # Example Supabase RPC call
            headers = {
                "apikey": API_KEY,
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "p_license_key": license_key,
                "p_email": email,
                "p_machine_id": machine_id
            }
            
            response = requests.post(
                f"{API_URL}/rest/v1/rpc/activate_license",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                # result should be like: {"success": true, "message": "Activated"}
                return result
            else:
                return {'success': False, 'message': f'Server error: {response.status_code}'}
                
        except Exception as e:
            print(f"Online validation failed: {e}")
            # Decide: Fail open (allow) or Fail closed (deny)?
            # Usually fail open if internet is down, but fail closed if we want strict security.
            # For this demo, we'll return True to not break the app.
            return {'success': True, 'message': 'Could not connect to server'}

    def activate_license(self, license_key, email):
        """Activate a paid license"""
        # 1. Validate the license key format (Offline)
        if not self.validate_license_key(license_key, email):
            return {
                'success': False,
                'error': 'Invalid license key or email'
            }
        
        # 2. Online Verification (Device Limit Check)
        machine_id = self.get_machine_id()
        online_result = self.validate_online(license_key, email, machine_id)
        
        if not online_result.get('success'):
            return {
                'success': False,
                'error': online_result.get('message', 'Activation failed')
            }
        
        # 3. Save activated license locally
        license_data = {
            'type': 'paid',
            'key': license_key,
            'email': email,
            'machine_id': machine_id,
            'activated_date': datetime.now().isoformat(),
            'version': '2.0.0'
        }
        
        try:
            # Ensure directory exists
            os.makedirs(self.data_dir, exist_ok=True)
            print(f'[License] Saving license to: {self.license_file}')
            
            with open(self.license_file, 'w', encoding='utf-8') as f:
                json.dump(license_data, f, indent=2)
            
            # Verify the file was created
            if os.path.exists(self.license_file):
                print(f'[License] ✅ License saved successfully!')
                print(f'[License] File size: {os.path.getsize(self.license_file)} bytes')
            else:
                print(f'[License] ❌ WARNING: License file was not created!')
            
            return {
                'success': True,
                'message': 'License activated successfully!',
                'email': email,
                'saved_to': self.license_file  # Return path for debugging
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to save license: {str(e)}'
            }
    
    def validate_license_key(self, license_key, email):
        """
        Validate license key against valid_licenses.txt database
        
        License Key Format: XXXX-XXXX-XXXX-XXXX
        """
        try:
            # Remove dashes and normalize
            clean_key = license_key.replace('-', '').upper()
            clean_email = email.lower().strip()
            
            if len(clean_key) != 16:
                return False
            
            # Check against valid_licenses.txt file
            valid_licenses_file = os.path.join(os.path.dirname(__file__), 'valid_licenses.txt')
            
            if os.path.exists(valid_licenses_file):
                with open(valid_licenses_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        # Skip comments and empty lines
                        if not line or line.startswith('#'):
                            continue
                        
                        # Format: email:license_key
                        if ':' in line:
                            stored_email, stored_key = line.split(':', 1)
                            stored_email = stored_email.strip().lower()
                            stored_key = stored_key.strip().replace('-', '').upper()
                            
                            # Check if email and key match
                            if clean_email == stored_email and clean_key == stored_key:
                                return True
            
            # Fallback: Also check HMAC-generated keys
            expected = self.generate_license_key(email)
            if license_key.upper() == expected.upper():
                return True
            
            return False
            
        except Exception as e:
            print(f"License validation error: {e}")
            return False
    
    def generate_license_key(self, email):
        """
        Generate a license key for an email
        Uses same algorithm as payment page for consistency
        """
        # Simple hash that matches the JavaScript version
        email_str = email.lower() + 'parceltools2024'
        hash_val = 0
        for char in email_str:
            hash_val = ((hash_val << 5) - hash_val) + ord(char)
            hash_val = hash_val & 0xFFFFFFFF  # Keep as 32-bit
        
        # Convert to hex and format as XXXX-XXXX-XXXX-XXXX
        hex_hash = format(abs(hash_val), '016X')
        formatted = '-'.join([
            hex_hash[0:4],
            hex_hash[4:8],
            hex_hash[8:12],
            hex_hash[12:16]
        ])
        
        return formatted
    
    def deactivate_license(self):
        """Remove/deactivate current license"""
        try:
            if os.path.exists(self.license_file):
                os.remove(self.license_file)
            return {'success': True, 'message': 'License deactivated'}
        except Exception as e:
            return {'success': False, 'error': str(e)}


# Helper function to generate keys (for testing/admin use)
def generate_key_for_email(email):
    """Helper to generate license keys - use this on your payment server"""
    lm = LicenseManager('.')
    return lm.generate_license_key(email)


if __name__ == '__main__':
    # Test the license system
    print("=== License Manager Test ===\n")
    
    # Test key generation
    test_email = "customer@example.com"
    key = generate_key_for_email(test_email)
    print(f"Generated key for {test_email}:")
    print(f"License Key: {key}\n")
    
    # Test validation
    lm = LicenseManager('./test_data')
    os.makedirs('./test_data', exist_ok=True)
    
    print("Testing license activation...")
    result = lm.activate_license(key, test_email)
    print(f"Activation result: {result}\n")
    
    print("Checking license status...")
    status = lm.get_license_info()
    print(f"License status: {status}")

