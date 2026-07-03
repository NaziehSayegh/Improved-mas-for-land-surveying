"""
License Management System for Parcel Tools
Handles license validation, trial mode, and activation
"""

import json as json_lib
import os
import hashlib
import hmac
from datetime import datetime, timedelta
import base64
import sys
import subprocess
import urllib.request
import urllib.parse
import urllib.error

# Windows Registry support — survives app uninstallation
try:
    import winreg as _winreg
    _HAS_WINREG = True
except ImportError:
    _HAS_WINREG = False

# Registry path where trial dates are stored
_REGISTRY_KEY_PATH = r'Software\NaziehSayegh\ParcelTools'

# Secret key for license validation (CHANGE THIS TO YOUR OWN SECRET!)
LICENSE_SECRET = "a8f3d9e2c1b74f6a0d5e8c3b2a9f1e4d7c6b5a8f3d9e2c1b74f6a0d5e8c3b2a"

class LicenseManager:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.license_file = os.path.join(data_dir, 'license.json')
        print(f'[License] License file path: {self.license_file}')
        print(f'[License] Data directory: {self.data_dir}')
        
        # Supabase removed - using Firebase instead
        
    def get_license_info(self):
        """Get current license status"""
        print(f'[License] Checking license file: {self.license_file}')
        print(f'[License] File exists: {os.path.exists(self.license_file)}')
        
        if not os.path.exists(self.license_file):
            # No license file exists - check/start trial
            return self._check_trial_status()
        
        try:
            with open(self.license_file, 'r', encoding='utf-8') as f:
                license_data = json_lib.load(f)
            
            # Check if it's a paid license
            if license_data.get('type') == 'paid':
                return self._check_paid_license(license_data)
            
            # Invalid license file, fall back to trial check
            return self._check_trial_status()
            
        except Exception as e:
            print(f"Error reading license: {e}")
            return self._check_trial_status()

    # ── Registry-Based Trial System ─────────────────────────────────────────────
    # Trial start dates are stored in the Windows Registry under:
    #   HKEY_CURRENT_USER\Software\NaziehSayegh\ParcelTools
    # This key is NOT removed by NSIS uninstallers, so deleting and reinstalling
    # the app does NOT reset the 30-day trial clock.
    # On non-Windows, a hidden folder (~/.parceltools_system/) is used instead.

    def _get_or_create_registry_date(self, value_name):
        """Read (or create) a trial start date stored permanently in the Windows Registry.
        Returns (date_iso_string, is_newly_created).
        Falls back to a hidden system folder on non-Windows."""
        if _HAS_WINREG:
            try:
                key = _winreg.CreateKeyEx(
                    _winreg.HKEY_CURRENT_USER,
                    _REGISTRY_KEY_PATH,
                    0,
                    _winreg.KEY_ALL_ACCESS
                )
                try:
                    date_str, _ = _winreg.QueryValueEx(key, value_name)
                    datetime.fromisoformat(date_str)   # validate format
                    print(f'[License] Registry date found for {value_name}: {date_str}')
                    return date_str, False
                except (FileNotFoundError, OSError, ValueError):
                    # Value does not exist yet — stamp it now
                    date_str = datetime.now().isoformat()
                    _winreg.SetValueEx(key, value_name, 0, _winreg.REG_SZ, date_str)
                    print(f'[License] Registry date created for {value_name}: {date_str}')
                    return date_str, True
                finally:
                    _winreg.CloseKey(key)
            except Exception as e:
                print(f'[License] Registry error: {e}')

        # ── Non-Windows / Registry fallback: hidden system folder ──────────────
        fallback_dir = os.path.join(os.path.expanduser('~'), '.parceltools_system')
        os.makedirs(fallback_dir, exist_ok=True)
        fallback_file = os.path.join(fallback_dir, f'{value_name}.dat')
        try:
            if os.path.exists(fallback_file):
                with open(fallback_file, 'r') as f:
                    date_str = f.read().strip()
                datetime.fromisoformat(date_str)   # validate
                return date_str, False
        except Exception:
            pass
        date_str = datetime.now().isoformat()
        try:
            with open(fallback_file, 'w') as f:
                f.write(date_str)
        except Exception as e:
            print(f'[License] Fallback file write error: {e}')
        return date_str, True

    def _compute_trial_response(self, start_date_str, expired_status, trial_status_label):
        """Shared helper: compute days-left and build the trial/expired response dict."""
        start_date = datetime.fromisoformat(start_date_str)
        now = datetime.now()
        expiration_date = start_date + timedelta(days=30)
        days_left = (expiration_date - now).days

        if now > expiration_date:
            return {
                'status': 'expired',
                'is_valid': False,
                'message': expired_status
            }

        return {
            'status': 'trial',
            'is_valid': True,
            'days_left': max(1, days_left + 1),   # +1 to include today
            'message': f'{trial_status_label} ({days_left + 1} days left)'
        }

    def _check_trial_status(self):
        """Check the 30-day trial for the PREMIUM (full) version.
        Date is persisted in the Windows Registry — survives reinstallation."""
        try:
            date_str, is_new = self._get_or_create_registry_date('PremiumTrialStart')
            if date_str is None:
                return {'status': 'error', 'is_valid': False, 'message': 'License Error'}

            result = self._compute_trial_response(
                date_str,
                expired_status='Trial Expired - Please Purchase a License',
                trial_status_label='Trial Mode'
            )
            if is_new:
                result['message'] = '30-Day Free Trial Started'
            print(f'[License] Premium trial status: {result}')
            return result
        except Exception as e:
            print(f'[License] Premium trial check error: {e}')
            return {'status': 'error', 'is_valid': False, 'message': 'License Error'}

    def _check_demo_trial_status(self):
        """Check the 30-day trial for the DEMO version.
        Date is persisted in the Windows Registry — survives reinstallation.
        Demo cannot be licensed; on expiry the user must buy the full version."""
        try:
            date_str, is_new = self._get_or_create_registry_date('DemoTrialStart')
            if date_str is None:
                return {'status': 'expired', 'is_valid': False, 'message': 'License Error'}

            result = self._compute_trial_response(
                date_str,
                expired_status='Demo Trial Expired - Please Download the Full Version',
                trial_status_label='Demo Trial'
            )
            if is_new:
                result['message'] = '30-Day Demo Trial Started'
            print(f'[License] Demo trial status: {result}')
            return result
        except Exception as e:
            print(f'[License] Demo trial check error: {e}')
            return {'status': 'expired', 'is_valid': False, 'message': 'License Error'}
    
    def _sign_license(self, data_dict):
        """Compute HMAC-SHA256 signature for a license data dict."""
        d = dict(data_dict)
        d.pop('signature', None)
        serialized = json_lib.dumps(d, sort_keys=True)
        return hmac.new(LICENSE_SECRET.encode(), serialized.encode(), 'sha256').hexdigest()

    def _verify_license_signature(self, data_dict):
        """Verify HMAC-SHA256 signature of a license data dict.
        Returns True if signature matches, or if no signature field exists (backward compatibility).
        Returns False if signature field exists but does not match.
        """
        d = dict(data_dict)
        stored_sig = d.pop('signature', None)
        if stored_sig is None:
            # No signature present - old license file, allow for backward compatibility
            return True
        expected_sig = self._sign_license(data_dict)
        return hmac.compare_digest(stored_sig, expected_sig)

    # Trial mode removed - customers must purchase
    def _check_paid_license(self, license_data):
        """Validate paid license key"""
        # Verify HMAC signature to detect tampering
        if not self._verify_license_signature(license_data):
            print('[License] ⚠️ License file signature mismatch - possible tampering detected')
            return {
                'status': 'invalid',
                'is_valid': False,
                'message': 'License file integrity check failed. Please re-activate your license.'
            }

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
                try:
                    import winreg
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
                        val, _ = winreg.QueryValueEx(key, "MachineGuid")
                        if val and str(val).strip():
                            return str(val).strip()
                except Exception:
                    pass
                try:
                    cmd = 'wmic csproduct get uuid'
                    uuid = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().split('\n')[1].strip()
                    if uuid:
                        return uuid
                except Exception:
                    pass
            import uuid
            return str(uuid.getnode())
        except Exception:
            import uuid
            return str(uuid.getnode())

    def get_machine_id_hash(self):
        """Return SHA-256 hash of the machine ID (safe to store in DB)"""
        raw = self.get_machine_id()
        return hashlib.sha256(raw.encode()).hexdigest()

    # ── Session Token System ────────────────────────────────────────────────────
    # Tokens are HMAC-signed strings: base64(uid:machine_hash:expiry) + "." + HMAC
    # They are stored in sessionStorage (cleared on window close) and sent as
    # X-Session-Token header. The backend verifies every protected request.

    _TOKEN_TTL_SECONDS = 24 * 60 * 60  # 24-hour tokens

    def generate_session_token(self, uid: str, machine_id_hash: str) -> str:
        """Issue a signed session token for a user on this machine."""
        import time
        expiry = int(time.time()) + self._TOKEN_TTL_SECONDS
        payload = f'{uid}:{machine_id_hash}:{expiry}'
        payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode()
        sig = hmac.new(
            LICENSE_SECRET.encode(),
            payload_b64.encode(),
            'sha256'
        ).hexdigest()
        return f'{payload_b64}.{sig}'

    def verify_session_token(self, token: str, machine_id_hash: str):
        """Verify a session token.
        Returns (uid, machine_id_hash) on success.
        Raises ValueError with a descriptive message on failure.
        """
        import time
        try:
            parts = token.split('.')
            if len(parts) != 2:
                raise ValueError('Malformed token')
            payload_b64, provided_sig = parts

            # Verify HMAC
            expected_sig = hmac.new(
                LICENSE_SECRET.encode(),
                payload_b64.encode(),
                'sha256'
            ).hexdigest()
            if not hmac.compare_digest(provided_sig, expected_sig):
                raise ValueError('Invalid token signature')

            # Decode payload
            payload = base64.urlsafe_b64decode(payload_b64.encode()).decode()
            uid, token_machine_hash, expiry_str = payload.split(':', 2)

            # Check expiry
            if int(time.time()) > int(expiry_str):
                raise ValueError('Token expired')

            # Check machine ID binding
            if not hmac.compare_digest(token_machine_hash, machine_id_hash):
                raise ValueError('Token was issued for a different machine')

            return uid, token_machine_hash

        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f'Token verification error: {e}')

    # Supabase validation removed - using Firebase instead

    def verify_gumroad_key(self, license_key):
        """
        Verify key with Gumroad API
        Returns: {'valid': Bool, 'email': Str, 'message': Str}
        """
        try:
            # Imports moved to global scope
            # import json - removed
            
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
                    result = json_lib.loads(response.read().decode('utf-8'))
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
        """Activate a paid license (Gumroad validation only)"""
        
        # Clean inputs
        clean_key = license_key.strip()
        clean_email = email.lower().strip()
        
        machine_id = self.get_machine_id()
        
        # Check Gumroad for valid license
        print("[License] Checking Gumroad...")
        gumroad_result = self.verify_gumroad_key(clean_key)
        
        if gumroad_result['valid']:
            # Valid Gumroad key
            print("[License] Valid Gumroad key")
            # Use Gumroad email as the authoritative email
            clean_email = gumroad_result['email'].lower()
        else:
            # Check Legacy Math Key (Fallback)
            if not self.validate_license_key(clean_key, clean_email):
                return {'success': False, 'error': 'Invalid License Key'}
        
        # 3. Save activated license locally
        license_data = {
            'type': 'paid',
            'key': clean_key,
            'email': clean_email,
            'machine_id': hashlib.sha256(machine_id.encode()).hexdigest(),
            'activated_date': datetime.now().isoformat(),
            'version': '2.0.5',
            'provider': 'gumroad'
        }
        license_data['signature'] = self._sign_license(license_data)
        
        try:
            # Ensure directory exists
            os.makedirs(self.data_dir, exist_ok=True)
            print(f'[License] Saving license to: {self.license_file}')
            
            with open(self.license_file, 'w', encoding='utf-8') as f:
                json_lib.dump(license_data, f, indent=2)
            
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

