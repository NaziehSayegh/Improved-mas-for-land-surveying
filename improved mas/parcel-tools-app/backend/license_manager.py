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
import sys
import subprocess

# Secret key for license validation (CHANGE THIS TO YOUR OWN SECRET!)
LICENSE_SECRET = "PARCELTOOLS_SECRET_KEY_CHANGE_ME_2024"  # TODO: Change this!

class LicenseManager:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.license_file = os.path.join(data_dir, 'license.json')
        print(f'[License] License file path: {self.license_file}')
        print(f'[License] Data directory: {self.data_dir}')
        
        # Supabase Credentials
        self.supabase_url = "https://vhzgtdlcgdekczerzqfh.supabase.co"
        self.supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoemd0ZGxjZ2Rla2N6ZXJ6cWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDU2NzQsImV4cCI6MjA4MDQyMTY3NH0.cg6OfTJxPIWTeafNkz5RwqbVTjpaFTwwHzxkxRJsfDA"
        
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
        provider = license_data.get('provider', 'legacy')
        
        # If it's a Gumroad key, we trust the local file (verified at activation)
        if provider == 'gumroad':
            return {
                'status': 'activated',
                'is_valid': True,
                'email': email,
                'activated_date': license_data.get('activated_date'),
                'message': 'Licensed version (Gumroad)'
            }
        
        # Legacy keys: Check math
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
        if self.supabase_url == "YOUR_SUPABASE_URL":
            # Online check disabled/not configured
            # For now, allow it (fallback to offline)
            return {'success': True, 'message': 'Online check skipped'}
            
        try:
            # Use standard library urllib instead of requests to avoid dependency issues
            import urllib.request
            import urllib.error
            
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "p_license_key": license_key,
                "p_email": email,
                "p_machine_id": machine_id
            }
            
            json_data = json.dumps(payload).encode('utf-8')
            
            req = urllib.request.Request(
                f"{API_URL}/rest/v1/rpc/activate_license",
                data=json_data,
                headers=headers,
                method='POST'
            )
            
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    result = json.loads(response.read().decode('utf-8'))
                    return result
                else:
                    return {'success': False, 'message': f'Server error: {response.status}'}
                
        except urllib.error.HTTPError as e:
            error_msg = e.read().decode('utf-8')
            print(f"Online validation HTTP error: {e.code} - {error_msg}")
            return {'success': False, 'message': f'Server Error ({e.code}): {error_msg}'}
        except Exception as e:
            print(f"Online validation failed: {e}")
            # DEBUGGING: Return the actual error to the user so we know what's wrong
            return {'success': False, 'message': f'Online Check Failed: {str(e)}'}

    def verify_gumroad_key(self, license_key):
        """
        Verify key with Gumroad API
        Returns: {'valid': Bool, 'email': Str, 'message': Str}
        """
        try:
            import urllib.request
            import urllib.parse
            
            # Gumroad Verify Endpoint
            url = "https://api.gumroad.com/v2/licenses/verify"
            
            # Product ID (Required for new products)
            product_id = "kk7iYfcvGdH3hYjxntwNIg=="
            
            data = urllib.parse.urlencode({
                'product_id': product_id,
                'license_key': license_key
            }).encode('utf-8')
            
            req = urllib.request.Request(url, data=data, method='POST')
            
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    result = json.loads(response.read().decode('utf-8'))
                    if result.get('success') and not result.get('purchase', {}).get('refunded', False):
                        return {
                            'valid': True,
                            'email': result['purchase']['email'],
                            'message': 'Valid Gumroad License'
                        }
                    else:
                        return {'valid': False, 'message': 'License refunded or invalid'}
                else:
                    return {'valid': False, 'message': 'Gumroad verification failed'}
                    
        except urllib.error.HTTPError as e:
            # Gumroad returns 404 for invalid keys
            return {'valid': False, 'message': 'Invalid Gumroad Key'}
        except Exception as e:
            print(f"Gumroad check error: {e}")
            return {'valid': False, 'message': f'Gumroad Error: {str(e)}'}

    def activate_license(self, license_key, email):
        """Activate a paid license (Hybrid: Supabase + Gumroad)"""
        
        # Clean inputs
        clean_key = license_key.strip() # Gumroad keys might not have dashes or might be UUIDs
        clean_email = email.lower().strip()
        
        # 2. Online Verification (Device Limit Check)
        machine_id = self.get_machine_id()
        
        # Step A: Check Supabase (Is it already registered?)
        online_result = self.validate_online(clean_key, clean_email, machine_id)
        
        if online_result.get('success'):
            # It's in Supabase and valid!
            pass
            
        elif "Invalid license key" in online_result.get('message', ''):
            # Not in Supabase? Check Gumroad!
            print("[License] Key not in DB, checking Gumroad...")
            gumroad_result = self.verify_gumroad_key(clean_key)
            
            if gumroad_result['valid']:
                # It's a valid new sale! Register it in Supabase.
                print("[License] Valid Gumroad key, registering in Supabase...")
                
                # Call the register_new_license RPC
                try:
                    import urllib.request
                    import json
                    
                    rpc_url = f"{self.supabase_url}/rest/v1/rpc/register_new_license"
                    headers = {
                        "apikey": self.supabase_key,
                        "Authorization": f"Bearer {self.supabase_key}",
                        "Content-Type": "application/json"
                    }
                    
                    payload = {
                        "p_license_key": clean_key,
                        "p_email": gumroad_result['email'], # Use email from Gumroad to be safe
                        "p_machine_id": machine_id
                    }
                    
                    req = urllib.request.Request(rpc_url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
                    
                    with urllib.request.urlopen(req) as response:
                        if response.status == 200:
                            reg_result = json.loads(response.read().decode('utf-8'))
                            if not reg_result.get('success'):
                                return {'success': False, 'error': reg_result.get('message', 'Device limit reached')}
                        else:
                            print(f"Failed to register license: {response.status}")
                            # Fallback: Allow local activation but warn? 
                            # No, let's be strict or lenient? Let's be lenient for now to avoid blocking paid users.
                            pass 
                            
                except Exception as e:
                    print(f"Error registering license in DB: {e}")
                    # If DB fails but Gumroad is valid, we should probably still allow access?
                    # Yes, let's allow access locally.
                    pass

                # Check if email matches (optional, but good security)
                if gumroad_result['email'].lower() != clean_email:
                     # If they typed a different email but key is valid, maybe we update the email?
                     # For now, let's just warn or ignore. Gumroad email is the truth.
                     pass
                     
                pass # Proceed to save local file
            else:
                 # Check Legacy Math Key (Fallback)
                if not self.validate_license_key(clean_key, clean_email):
                    return {'success': False, 'error': 'Invalid License Key (Gumroad & Legacy)'}
        else:
            # Some other error (Device limit reached, server error)
            return {'success': False, 'error': online_result.get('message')}
        
        # 3. Save activated license locally
        license_data = {
            'type': 'paid',
            'key': clean_key,
            'email': clean_email,
            'machine_id': machine_id,
            'activated_date': datetime.now().isoformat(),
            'version': '2.0.0',
            'provider': 'gumroad'
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
            # Use clean_email to ensure no whitespace issues
            expected = self.generate_license_key(clean_email)
            
            # Compare clean keys (ignore dashes)
            expected_clean = expected.replace('-', '').upper()
            
            if clean_key == expected_clean:
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

