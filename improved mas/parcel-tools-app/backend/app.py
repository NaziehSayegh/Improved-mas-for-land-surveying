"""
Flask Backend API for Parcel Tools Desktop App
Provides endpoints for area calculations, point management, and data operations
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import math
from datetime import datetime
import re
import builtins
import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from license_manager import LicenseManager
from firebase_service import FirebaseService
from firebase_config import is_firebase_available

# Some environments (like packaged Windows apps) don't have a writable console.
# Printing in those cases raises "OSError: [Errno 22] Invalid argument" and can
# crash API requests. Wrap print so logging never interrupts request handling.
_original_print = builtins.print


# Reconfigure stdout/stderr to use UTF-8 (fixes Windows charmap errors)
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def safe_print(*args, **kwargs):
    try:
        _original_print(*args, **kwargs)
    except UnicodeEncodeError:
        # Fallback: try to print with replacement characters
        try:
            encoding = sys.stdout.encoding or 'utf-8'
            clean_args = [str(arg).encode(encoding, 'replace').decode(encoding) for arg in args]
            _original_print(*clean_args, **kwargs)
        except Exception:
            pass
    except OSError:
        # Ignore console write failures (no console attached)
        pass


builtins.print = safe_print
print = safe_print  # noqa: A001

app = Flask(__name__)
CORS(app)  # Enable CORS for Electron frontend

# ----------------------------------------------------------------------------
# DEBUG LOGGING SETUP
# ----------------------------------------------------------------------------
log_file = os.path.join(os.path.expanduser('~'), 'parcel_tools_backend_debug.log')
try:
    # Open log file in append mode
    log_f = open(log_file, 'a', encoding='utf-8', buffering=1)
    
    def log_message(*args, **kwargs):
        # Extract print formatting options
        sep = kwargs.get('sep', ' ')
        msg = sep.join(str(arg) for arg in args)
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted = f"[{timestamp}] {msg}\n"
        try:
            log_f.write(formatted)
            log_f.flush()
        except:
            pass
        # Also print to original stdout/stderr for dev console
        # Exclude keyword arguments that are not supported by original_print if needed,
        # but original_print supports all standard kwargs.
        try:
            _original_print(*args, **kwargs)
        except:
            pass

    # Redirect print
    builtins.print = log_message
    
    # Redirect stderr
    class LoggerWriter:
        def __init__(self, writer):
            self.writer = writer
        def write(self, message):
            if message.strip():
                log_message(f"[STDERR] {message.strip()}")
        def flush(self):
            pass
            
    sys.stderr = LoggerWriter(sys.stderr)
    
    print("========== BACKEND STARTING ==========")
    print(f"Executable: {sys.executable}")
    print(f"CWD: {os.getcwd()}")
    print(f"Python Version: {sys.version}")
    
except Exception as e:
    _original_print(f"Failed to setup file logging: {e}")

# ----------------------------------------------------------------------------


# Data storage paths
# In packaged app, use user's AppData folder instead of app directory (which might be read-only)
if os.environ.get('PORTABLE_EXECUTABLE_DIR'):
    # Running from packaged Electron app
    import sys
    if sys.platform == 'win32':
        APP_DATA = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
        DATA_DIR = os.path.join(APP_DATA, 'ParcelTools', 'data')
    else:
        DATA_DIR = os.path.join(os.path.expanduser('~'), '.parceltools', 'data')
else:
    # Development mode - use backend/data
    DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

PROJECTS_FILE = os.path.join(DATA_DIR, 'projects.json')
POINTS_DIR = os.path.join(DATA_DIR, 'points')
AI_CONFIG_FILE = os.path.join(DATA_DIR, 'ai_config.json')
RECENT_FILES_FILE = os.path.join(DATA_DIR, 'recent_files.json')

# Initialize License Manager
license_manager = LicenseManager(DATA_DIR)

# Initialize Firebase Service
firebase_service = FirebaseService(DATA_DIR)
print(f'[Backend] Firebase available: {is_firebase_available()}')

# Ensure data directories exist
print(f'[Backend] Data directory: {DATA_DIR}')
try:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(POINTS_DIR, exist_ok=True)
    print(f'[Backend] Data directories created successfully')
except Exception as e:
    print(f'[Backend ERROR] Failed to create data directories: {e}')
    # Fall back to temp directory if we can't create in AppData
    import tempfile
    DATA_DIR = os.path.join(tempfile.gettempdir(), 'ParcelTools', 'data')
    PROJECTS_FILE = os.path.join(DATA_DIR, 'projects.json')
    POINTS_DIR = os.path.join(DATA_DIR, 'points')
    AI_CONFIG_FILE = os.path.join(DATA_DIR, 'ai_config.json')
    RECENT_FILES_FILE = os.path.join(DATA_DIR, 'recent_files.json')
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(POINTS_DIR, exist_ok=True)
    print(f'[Backend] Using fallback temp directory: {DATA_DIR}')


def load_projects():
    """Load projects from JSON file"""
    if os.path.exists(PROJECTS_FILE):
        with open(PROJECTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_projects(projects):
    """Save projects to JSON file"""
    with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)


def load_ai_config():
    if os.path.exists(AI_CONFIG_FILE):
        try:
            with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_ai_config(cfg):
    try:
        with open(AI_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
        return True
    except Exception:
        return False


def load_recent_files():
    """Load recent files history"""
    if os.path.exists(RECENT_FILES_FILE):
        try:
            with open(RECENT_FILES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {'projects': [], 'points': []}
    return {'projects': [], 'points': []}


def save_recent_files(recent_files):
    """Save recent files history"""
    try:
        # Ensure directory exists
        recent_dir = os.path.dirname(RECENT_FILES_FILE)
        if recent_dir and not os.path.exists(recent_dir):
            os.makedirs(recent_dir, exist_ok=True)
        
        with open(RECENT_FILES_FILE, 'w', encoding='utf-8') as f:
            json.dump(recent_files, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f'[Recent Files ERROR] Failed to save: {e}')
        return False


def add_to_recent_files(file_type, file_path, file_name, metadata=None):
    """Add a file to recent files history"""
    print(f'[Recent Files] Adding {file_type}: {file_path}')
    recent = load_recent_files()
    print(f'[Recent Files] Current {file_type} count: {len(recent.get(file_type, []))}')
    file_list = recent.get(file_type, [])
    
    # Remove if already exists
    file_list = [f for f in file_list if f.get('path') != file_path]
    
    # Add to beginning
    file_entry = {
        'path': file_path,
        'name': file_name,
        'lastAccessed': datetime.now().isoformat(),
        'metadata': metadata or {}
    }
    file_list.insert(0, file_entry)
    
    # Keep only last 50 entries per type
    file_list = file_list[:50]
    
    recent[file_type] = file_list
    save_result = save_recent_files(recent)
    print(f'[Recent Files] Save result: {save_result}, New {file_type} count: {len(file_list)}')
    return recent



@app.route('/api/debug/paths', methods=['GET'])
def debug_paths():
    """Debug endpoint to check paths"""
    return jsonify({
        'data_dir': DATA_DIR,
        'license_file': license_manager.license_file,
        'exists': os.path.exists(license_manager.license_file),
        'app_data_env': os.environ.get('LOCALAPPDATA'),
        'portable_env': os.environ.get('PORTABLE_EXECUTABLE_DIR'),
        'is_packaged': bool(os.environ.get('PORTABLE_EXECUTABLE_DIR'))
    })


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Parcel Tools API is running'})


# ============================================================================
# AUTH HELPERS
# ============================================================================

def _verify_firebase_password(email: str, password: str):
    """
    Verify password via Firebase REST API (sign-in-with-password).
    Returns uid on success, raises Exception on failure.
    Firebase Admin SDK cannot verify passwords — we must use the REST API.
    """
    import urllib.request, urllib.parse, urllib.error, json as _json
    from firebase_config import get_firebase_api_key
    api_key = get_firebase_api_key()
    if not api_key:
        raise Exception('Firebase API key not configured — cannot verify password')
    url = f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}'
    payload = _json.dumps({'email': email, 'password': password, 'returnSecureToken': True}).encode()
    req = urllib.request.Request(url, data=payload,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = _json.loads(resp.read())
            return data['localId']  # Firebase uid
    except urllib.error.HTTPError as e:
        err_body = _json.loads(e.read().decode())
        msg = err_body.get('error', {}).get('message', 'Authentication failed')
        raise Exception(msg)


def require_auth(f):
    """
    Decorator — validates X-Session-Token header on every protected endpoint.
    Injects `g.uid` and `g.machine_id_hash` into the Flask request context.
    Checks if user account is disabled.
    """
    from functools import wraps
    from flask import g
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('X-Session-Token', '')
        if not token:
            return jsonify({'error': 'Authentication required', 'code': 'NO_TOKEN'}), 401
        machine_hash = license_manager.get_machine_id_hash()
        try:
            uid, _ = license_manager.verify_session_token(token, machine_hash)
            user_data = firebase_service.get_user(uid)
            if user_data and user_data.get('is_active') is False:
                return jsonify({
                    'error': 'Your account has been disabled. Please contact support.',
                    'code': 'ACCOUNT_DISABLED'
                }), 403
            g.uid = uid
            g.machine_id_hash = machine_hash
        except ValueError as e:
            return jsonify({'error': str(e), 'code': 'INVALID_TOKEN'}), 401
        return f(*args, **kwargs)
    return decorated


# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    """
    Create a new user account.
    Demo:    { "email": "...", "password": "...", "accountType": "demo" }
    Premium: { "email": "...", "password": "...", "accountType": "premium", "licenseKey": "XXXX-..." }
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        account_type = data.get('accountType', 'premium')   # 'demo' | 'premium'
        license_key = data.get('licenseKey', '').strip()

        print(f'[Auth] Signup attempt: {email}, type={account_type}')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        # If no license key is provided during signup, default to free trial (demo mode)
        if not license_key:
            account_type = 'demo'
        elif account_type == 'premium':
            # Validate the license
            gumroad_ok = license_manager.verify_gumroad_key(license_key)
            legacy_ok  = license_manager.validate_license_key(license_key, email)
            if not gumroad_ok.get('valid') and not legacy_ok:
                return jsonify({'error': 'Invalid license key. Please check your Gumroad email.'}), 400

        # Collect machine binding info
        machine_id_hash = license_manager.get_machine_id_hash()

        # Get trial start from Registry (already set on first app launch)
        trial_info = license_manager._check_demo_trial_status() if account_type == 'demo' \
                     else license_manager._check_trial_status()
        trial_start = trial_info.get('trial_start') or datetime.now().isoformat()

        # Create Firebase user
        result = firebase_service.create_user(
            email, password, license_key,
            account_type=account_type,
            machine_id_hash=machine_id_hash,
            trial_start=trial_start
        )

        if not result['success']:
            return jsonify({'error': result.get('error', 'Failed to create account')}), 400

        uid = result['user_id']

        # Save license for premium accounts
        if account_type == 'premium' and license_key:
            firebase_service.save_license(uid, {
                'key': license_key, 'email': email,
                'activated_date': datetime.now().isoformat(), 'type': 'paid'
            })

        # Auto-activate license key locally if premium signup
        if account_type == 'premium' and license_key:
            try:
                license_manager.activate_license(license_key, email)
                print(f'[Auth] Auto-activated license key locally on signup for {email}')
            except Exception as lic_err:
                print(f'[Auth] Warning: Could not auto-activate license on signup: {lic_err}')

        # Issue session token (machine-bound)
        session_token = license_manager.generate_session_token(uid, machine_id_hash)

        # Track PC device on signup
        import socket, getpass, platform
        try:
            computer_name = socket.gethostname()
            os_username = getpass.getuser()
            os_platform = f"{platform.system()} {platform.release()}"
            device_name = f"{computer_name} ({os_username}) [{os_platform}]"
        except Exception:
            computer_name = None
            os_username = None
            os_platform = None
            device_name = "Windows PC"
        firebase_service.add_device(
            uid, machine_id_hash, device_name,
            computer_name=computer_name,
            os_user=os_username,
            os_platform=os_platform
        )

        print(f'[Auth] Account created: {email} ({account_type})')
        return jsonify({
            'success': True,
            'message': 'Account created successfully',
            'userId': uid,
            'email': email,
            'accountType': account_type,
            'sessionToken': session_token,
        })

    except Exception as e:
        print(f'[Auth ERROR] Signup failed: {e}')
        return jsonify({'error': str(e)}), 500


def _ensure_premium_license_activated(uid, user_data, email_val):
    if not user_data or user_data.get('account_type') != 'premium':
        return
    try:
        lic_key = user_data.get('license_key')
        if not lic_key and email_val:
            lic_key = license_manager.generate_license_key(email_val)
            if firebase_service._is_online() and uid:
                try:
                    firebase_service.db.collection('users').document(uid).set({'license_key': lic_key}, merge=True)
                except Exception as db_e:
                    print(f'[Auth] Warning: Could not update Firestore license_key: {db_e}')
            all_u = firebase_service._load_users_from_json()
            if uid and uid in all_u:
                all_u[uid]['license_key'] = lic_key
                firebase_service._save_users_to_json(all_u)
            user_data['license_key'] = lic_key
        if lic_key and email_val:
            license_manager.activate_license(lic_key, email_val)
            print(f'[Auth] Auto-activated license key locally for {email_val}')
    except Exception as e:
        print(f'[Auth] Warning in _ensure_premium_license_activated: {e}')


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """
    Login — verifies password via Firebase REST API, checks machine binding,
    issues a signed HMAC session token.
    Expected JSON: { "email": "...", "password": "..." }
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        print(f'[Auth] Login attempt for: {email}')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # ── 1. Verify password via Firebase REST API ──────────────────────────
        try:
            uid = _verify_firebase_password(email, password)
        except Exception as pw_err:
            err_msg = str(pw_err)
            if 'INVALID_PASSWORD' in err_msg or 'EMAIL_NOT_FOUND' in err_msg:
                return jsonify({'error': 'Incorrect email or password'}), 401
            # Fallback: try Admin SDK lookup (offline mode)
            result = firebase_service.verify_user_credentials(email, password)
            if not result['success']:
                return jsonify({'error': 'Incorrect email or password'}), 401
            uid = result['user_id']

        # ── 2. Get user profile from Firestore ────────────────────────────────
        user_data = firebase_service.get_user(uid)
        if not user_data:
            return jsonify({'error': 'User profile not found'}), 404

        # ── 3. Check if account is active ────────────────────────────────────
        if user_data.get('is_active') is False:
            return jsonify({
                'error': 'Your account has been disabled. Please contact support.',
                'code': 'ACCOUNT_DISABLED'
            }), 403

        # ── 4. & 5. Track device and check 2-device limit (maximum 2 devices) ──
        machine_id_hash = license_manager.get_machine_id_hash()
        stored_hash = user_data.get('machine_id_hash', '')

        import socket
        import getpass
        import platform
        try:
            computer_name = socket.gethostname()
            os_username = getpass.getuser()
            os_platform = f"{platform.system()} {platform.release()}"
            device_name = f"{computer_name} ({os_username}) [{os_platform}]"
        except Exception:
            computer_name = None
            os_username = None
            os_platform = None
            device_name = "Windows PC"

        device_result = firebase_service.add_device(
            uid, machine_id_hash, device_name,
            computer_name=computer_name,
            os_user=os_username,
            os_platform=os_platform
        )

        if not device_result.get('success'):
            print(f"[Auth] Login rejected for {email}: {device_result.get('error')}")
            return jsonify({
                'error': device_result.get('error', 'Device limit reached. Maximum 2 devices allowed. Please sign out from another device first.'),
                'code': 'DEVICE_LIMIT_REACHED',
                'deviceCount': device_result.get('device_count', 2)
            }), 403

        # If no primary machine binding yet, bind now for backward compatibility
        if not stored_hash:
            if firebase_service._is_online():
                firebase_service.db.collection('users').document(uid).update(
                    {'machine_id_hash': machine_id_hash}
                )
            else:
                users_json = firebase_service._load_users_from_json()
                if uid in users_json:
                    users_json[uid]['machine_id_hash'] = machine_id_hash
                    firebase_service._save_users_to_json(users_json)

        # ── 6. Update last_login ──────────────────────────────────────────────
        if firebase_service._is_online():
            firebase_service.db.collection('users').document(uid).update(
                {'last_login': datetime.now().isoformat()}
            )

        # ── 7. Auto-activate license key locally if present or premium ────────
        _ensure_premium_license_activated(uid, user_data, email)

        # ── 8. Issue session token ────────────────────────────────────────────
        session_token = license_manager.generate_session_token(uid, machine_id_hash)

        now_ts = int(datetime.now().timestamp())
        print(f'[Auth] Login successful: {email} (type={user_data.get("account_type","?")})')
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'userId': uid,
            'email': email,
            'accountType': user_data.get('account_type', 'premium'),
            'isAdmin': user_data.get('is_admin', False),
            'licenseKey': user_data.get('license_key'),
            'sessionToken': session_token,
            'loginTimestamp': now_ts,
        })

    except Exception as e:
        print(f'[Auth ERROR] Login failed: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify', methods=['POST'])
def auth_verify():
    """
    Verify session token validity.
    Expected JSON: { "sessionToken": "...", "userId": "..." } (userId kept for backward-compat)
    """
    try:
        data = request.get_json()
        session_token = data.get('sessionToken') or request.headers.get('X-Session-Token')
        user_id = data.get('userId')

        machine_hash = license_manager.get_machine_id_hash()
        now_ts = int(datetime.now().timestamp())

        if session_token:
            try:
                uid, _ = license_manager.verify_session_token(session_token, machine_hash)
                user_data = firebase_service.get_user(uid)
                if user_data and user_data.get('is_active') is False:
                    return jsonify({'valid': False, 'error': 'Account disabled'}), 403
                
                device_res = firebase_service.add_device(uid, machine_hash, "Windows PC")
                if not device_res.get('success'):
                    return jsonify({'valid': False, 'error': device_res.get('error', 'Device limit reached. Maximum 2 devices allowed.'), 'code': 'DEVICE_LIMIT_REACHED'}), 403

                email_val = user_data.get('email') if user_data else ''
                account_type_val = user_data.get('account_type', 'premium') if user_data else 'premium'
                is_admin_val = user_data.get('is_admin', False) or (email_val.lower() in ['nsayegh2003@yahoo.com', 'nsayegh2003@gmail.com']) if user_data else False
                _ensure_premium_license_activated(uid, user_data, email_val)
                return jsonify({
                    'valid': True,
                    'email': email_val,
                    'accountType': account_type_val,
                    'isAdmin': is_admin_val,
                    'licenseKey': user_data.get('license_key') if user_data else None,
                    'loginTimestamp': now_ts,
                })
            except ValueError:
                pass  # fall through to userId check

        # Backward-compat: plain userId fallback
        if user_id:
            user_data = firebase_service.get_user(user_id)
            if user_data and user_data.get('is_active') is False:
                return jsonify({'valid': False, 'error': 'Account disabled'}), 403
            
            device_res = firebase_service.add_device(user_id, machine_hash, "Windows PC")
            if not device_res.get('success'):
                return jsonify({'valid': False, 'error': device_res.get('error', 'Device limit reached. Maximum 2 devices allowed.'), 'code': 'DEVICE_LIMIT_REACHED'}), 403

            email_val = user_data.get('email') if user_data else ''
            account_type_val = user_data.get('account_type', 'premium') if user_data else 'premium'
            is_admin_val = user_data.get('is_admin', False) or (email_val.lower() in ['nsayegh2003@yahoo.com', 'nsayegh2003@gmail.com']) if user_data else False
            _ensure_premium_license_activated(user_id, user_data, email_val)
            new_token = license_manager.generate_session_token(user_id, machine_hash)
            return jsonify({
                'valid': True,
                'email': email_val,
                'accountType': account_type_val,
                'isAdmin': is_admin_val,
                'licenseKey': user_data.get('license_key') if user_data else None,
                'sessionToken': new_token,
                'loginTimestamp': now_ts,
            })

        return jsonify({'valid': False, 'error': 'Invalid or expired session'}), 401

    except Exception as e:
        print(f'[Auth ERROR] Verification failed: {e}')
        return jsonify({'valid': False, 'error': str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """Logout and deactivate device. Expected JSON: { "userId": "..." }"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        print(f'[Auth] Logout request for user: {user_id}')
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        machine_id_hash = license_manager.get_machine_id_hash()
        firebase_service.remove_device(user_id, machine_id_hash)
        return jsonify({'success': True, 'message': 'Logged out successfully'})
    except Exception as e:
        print(f'[Auth ERROR] Logout failed: {e}')
        return jsonify({'error': str(e)}), 500


# ============================================================================
# ADMIN ENDPOINTS  (require_auth + is_admin check)
# ============================================================================

def _require_admin(f):
    """Decorator that requires both a valid session token AND is_admin=True."""
    from functools import wraps
    from flask import g
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        user_data = firebase_service.get_user(g.uid)
        is_admin = False
        if user_data:
            is_admin = user_data.get('is_admin', False) or user_data.get('email', '').lower() in ['nsayegh2003@yahoo.com', 'nsayegh2003@gmail.com']
        if not is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


@app.route('/api/admin/users', methods=['GET'])
@_require_admin
def admin_list_users():
    """Admin: list all registered users."""
    try:
        users = firebase_service.get_all_users()
        # Compute trial days_left and trial_expires_at for display
        from datetime import datetime as _dt, timedelta as _td
        for u in users:
            ts = u.get('trial_start')
            if ts:
                try:
                    start = _dt.fromisoformat(ts)
                    expires = start + _td(days=30)
                    left = (expires - _dt.now()).days + 1
                    u['trial_days_left'] = max(0, left)
                    u['trial_expires_at'] = expires.isoformat()
                except Exception:
                    u['trial_days_left'] = None
                    u['trial_expires_at'] = None
        return jsonify({'success': True, 'users': users})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<uid>/extend-trial', methods=['POST'])
@_require_admin
def admin_extend_trial(uid):
    """Admin: extend a user's trial by resetting trial_start to today."""
    try:
        new_start = datetime.now().isoformat()
        result = firebase_service.extend_user_trial(uid, new_start)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<uid>/toggle-active', methods=['POST'])
@_require_admin
def admin_toggle_active(uid):
    """Admin: enable or disable a user account."""
    try:
        data = request.get_json()
        is_active = bool(data.get('isActive', True))
        result = firebase_service.set_user_active(uid, is_active)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<uid>/reset-machine', methods=['POST'])
@_require_admin
def admin_reset_machine(uid):
    """Admin: clear machine binding — allows user to log in from a new PC."""
    try:
        result = firebase_service.reset_user_machine(uid)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<uid>/upgrade-premium', methods=['POST'])
@_require_admin
def admin_upgrade_premium(uid):
    """Admin: upgrade a demo account to premium."""
    try:
        result = firebase_service.upgrade_user_to_premium(uid)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users/<uid>/deactivate-license', methods=['POST'])
@_require_admin
def admin_deactivate_license(uid):
    """Admin: deactivate a user's license key, reverting them to demo status."""
    try:
        result = firebase_service.deactivate_user_license(uid)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/calculate-area', methods=['POST'])
def calculate_area():
    """
    Calculate parcel area using shoelace formula
    Expected JSON: { "points": [{"x": 0, "y": 0}, ...], "curves": [...] (optional) }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        curves = data.get('curves', [])
        
        if len(points) < 3:
            return jsonify({'error': 'At least 3 points required'}), 400
        
        # Shoelace formula for polygon area
        base_area = 0
        n = len(points)
        for i in range(n):
            j = (i + 1) % n
            base_area += points[i]['x'] * points[j]['y']
            base_area -= points[j]['x'] * points[i]['y']
        
        base_area = abs(base_area) / 2
        
        # Calculate perimeter
        perimeter = 0
        for i in range(n):
            j = (i + 1) % n
            dx = points[j]['x'] - points[i]['x']
            dy = points[j]['y'] - points[i]['y']
            perimeter += math.sqrt(dx * dx + dy * dy)
        
        # Calculate centroid
        cx = sum(p['x'] for p in points) / n
        cy = sum(p['y'] for p in points) / n
        
        # Apply curve adjustments
        curve_adjustments = []
        total_curve_adjustment = 0
        
        if curves:
            for curve in curves:
                M = curve.get('M', 0)
                sign = curve.get('sign', 1)
                from_idx = curve.get('fromIndex', 0)
                to_idx = curve.get('toIndex', 1)
                
                if M > 0 and from_idx < len(points) and to_idx < len(points):
                    # Calculate chord length
                    from_pt = points[from_idx]
                    to_pt = points[to_idx]
                    dx = to_pt['x'] - from_pt['x']
                    dy = to_pt['y'] - from_pt['y']
                    C = math.sqrt(dx * dx + dy * dy)
                    
                    if C > 0:
                        # Calculate radius and segment area
                        R = (C * C) / (8.0 * M) + (M / 2.0)
                        theta = 2.0 * math.asin(min(1.0, C / (2.0 * R)))
                        seg_area = 0.5 * R * R * (theta - math.sin(theta))
                        
                        adjustment = seg_area * sign
                        total_curve_adjustment += adjustment
                        
                        curve_adjustments.append({
                            'C': C,
                            'R': R,
                            'F': M,
                            'segmentArea': seg_area,
                            'adjustment': adjustment
                        })
        
        final_area = base_area + total_curve_adjustment
        
        return jsonify({
            'baseArea': round(base_area, 4),
            'curveAdjustment': round(total_curve_adjustment, 4),
            'area': round(final_area, 4),
            'perimeter': round(perimeter, 4),
            'centroid': {'x': round(cx, 4), 'y': round(cy, 4)},
            'point_count': n,
            'curveDetails': curve_adjustments
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/calculate-area-error', methods=['POST'])
def calculate_area_error():
    """
    Calculate error statistics for parcel area
    Error propagation based on coordinate precision
    Expected JSON: { 
        "points": [{"x": 0, "y": 0, "errorX": 0.01, "errorY": 0.01}, ...], 
        "area": 1000.0,
        "coordinateError": 0.01 (optional, default if not in points)
    }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        area = data.get('area', 0)
        default_coord_error = data.get('coordinateError', 0.01)  # Default 1cm error
        
        if len(points) < 3:
            return jsonify({'error': 'At least 3 points required'}), 400
        
        n = len(points)
        
        # Error propagation for shoelace formula
        # Area A = 0.5 * |Σ(xi*yi+1 - xi+1*yi)|
        # Partial derivatives: ∂A/∂xi = 0.5 * (yi-1 - yi+1)
        #                      ∂A/∂yi = 0.5 * (xi+1 - xi-1)
        
        variance_sum = 0.0
        
        for i in range(n):
            # Get coordinate errors (use default if not provided)
            error_x = points[i].get('errorX', default_coord_error)
            error_y = points[i].get('errorY', default_coord_error)
            
            # Previous and next indices (circular)
            prev_idx = (i - 1) % n
            next_idx = (i + 1) % n
            
            # Partial derivatives
            dA_dxi = 0.5 * (points[prev_idx]['y'] - points[next_idx]['y'])
            dA_dyi = 0.5 * (points[next_idx]['x'] - points[prev_idx]['x'])
            
            # Variance contribution: (∂A/∂xi)²σx² + (∂A/∂yi)²σy²
            variance_sum += (dA_dxi ** 2) * (error_x ** 2) + (dA_dyi ** 2) * (error_y ** 2)
        
        # Standard error of area
        standard_error = math.sqrt(variance_sum)
        
        # Relative error (percentage)
        relative_error = (standard_error / area * 100) if area > 0 else 0
        
        # Confidence intervals (assuming normal distribution)
        # 68% confidence (1σ), 95% confidence (2σ), 99.7% confidence (3σ)
        ci_68_lower = area - standard_error
        ci_68_upper = area + standard_error
        ci_95_lower = area - 2 * standard_error
        ci_95_upper = area + 2 * standard_error
        ci_99_lower = area - 3 * standard_error
        ci_99_upper = area + 3 * standard_error
        
        # Error ellipse parameters (simplified)
        # Maximum error contribution
        max_error_contribution = max([
            math.sqrt((0.5 * (points[(i-1)%n]['y'] - points[(i+1)%n]['y']))**2 * 
                     (points[i].get('errorX', default_coord_error)**2) +
                     (0.5 * (points[(i+1)%n]['x'] - points[(i-1)%n]['x']))**2 * 
                     (points[i].get('errorY', default_coord_error)**2))
            for i in range(n)
        ])
        
        return jsonify({
            'area': round(area, 4),
            'standardError': round(standard_error, 6),
            'relativeError': round(relative_error, 4),
            'variance': round(variance_sum, 8),
            'confidenceIntervals': {
                '68': {
                    'lower': round(ci_68_lower, 4),
                    'upper': round(ci_68_upper, 4),
                    'range': round(2 * standard_error, 4)
                },
                '95': {
                    'lower': round(ci_95_lower, 4),
                    'upper': round(ci_95_upper, 4),
                    'range': round(4 * standard_error, 4)
                },
                '99': {
                    'lower': round(ci_99_lower, 4),
                    'upper': round(ci_99_upper, 4),
                    'range': round(6 * standard_error, 4)
                }
            },
            'maxErrorContribution': round(max_error_contribution, 6),
            'pointCount': n
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def parse_points_content(text_data):
    """Parse raw points file content into a list of points dicts"""
    points = []
    for line in text_data.strip().split('\n'):
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('//'):
            continue
        
        # Replace semicolons with commas
        line = line.replace(';', ',')
        
        # Split by comma or whitespace
        parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
        
        if len(parts) >= 3:
            try:
                point_id = parts[0]
                x = float(parts[1])
                y = float(parts[2])
                points.append({'id': point_id, 'x': x, 'y': y})
            except ValueError:
                continue
    return points


def calculate_single_parcel_metrics(parcel, points_map):
    """Calculate area and perimeter for a single parcel using a points map"""
    point_ids = parcel.get('ids', [])
    curves = parcel.get('curves', [])
    
    # Prepare points for this parcel
    parcel_points = []
    for pid in point_ids:
        pid_str = str(pid)
        if pid_str in points_map:
            parcel_points.append(points_map[pid_str])
        else:
            # Point not found, use default or skip
            parcel_points.append({'x': 0, 'y': 0})
    
    area = 0.0
    perimeter = 0.0
    
    if len(parcel_points) >= 3:
        # If the last point is duplicate of the first point, slice it off to avoid duplicate calculation
        pts = parcel_points
        if len(pts) > 3 and pts[0]['x'] == pts[-1]['x'] and pts[0]['y'] == pts[-1]['y']:
            pts = pts[:-1]
        
        n = len(pts)
        sum1 = 0.0
        sum2 = 0.0
        for i in range(n):
            j = (i + 1) % n
            sum1 += pts[i]['x'] * pts[j]['y']
            sum2 += pts[j]['x'] * pts[i]['y']
        area = 0.5 * abs(sum1 - sum2)
        
        # Perimeter
        for i in range(n):
            j = (i + 1) % n
            dx = pts[j]['x'] - pts[i]['x']
            dy = pts[j]['y'] - pts[i]['y']
            perimeter += math.sqrt(dx*dx + dy*dy)
    
    # Apply curves
    for curve in curves:
        try:
            m = float(curve.get('M', 0))
            sign = 1 if curve.get('sign', 1) == 1 else -1
            from_id = str(curve.get('from'))
            to_id = str(curve.get('to'))
            
            if from_id in points_map and to_id in points_map:
                p1 = points_map[from_id]
                p2 = points_map[to_id]
                
                dx = p2['x'] - p1['x']
                dy = p2['y'] - p1['y']
                chord = math.sqrt(dx*dx + dy*dy)
                
                if m > 0 and chord > 0:
                    R = (chord**2)/(8*m) + (m/2)
                    theta = 2 * math.asin(min(1.0, chord/(2*R)))
                    segment_area = 0.5 * R**2 * (theta - math.sin(theta))
                    area += sign * segment_area
        except Exception:
            pass # Ignore curve errors in batch
            
    return area, perimeter


@app.route('/api/calculate-batch-areas', methods=['POST'])
def calculate_batch_areas():
    """
    Calculate area for multiple parcels in one request.
    Expected JSON: {
        "parcels": [{ "id": "uuid", "ids": ["1", "2", "3", "1"], "curves": [...] }],
        "points": { "1": {"x": 0, "y": 0}, ... }
    }
    """
    try:
        data = request.get_json()
        parcels = data.get('parcels', [])
        points_map = data.get('points', {})
        
        results = []
        
        for parcel in parcels:
            area, perimeter = calculate_single_parcel_metrics(parcel, points_map)
            results.append({
                'id': parcel.get('id'),
                'area': area,
                'perimeter': perimeter
            })
            
        return jsonify({'results': results})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/save', methods=['POST'])
def save_project_file():
    """Save complete project state to file - REQUIRES user-selected filePath"""
    try:
        data = request.get_json()
        project_name = data.get('projectName', 'untitled')
        project_data = data.get('projectData', {})
        custom_filepath = data.get('filePath')  # REQUIRED: user must select a path
        
        print(f'[Save] ========== START SAVE REQUEST ==========')
        print(f'[Save] Project name: {project_name}')
        print(f'[Save] Raw file path from frontend: {repr(custom_filepath)}')
        print(f'[Save] Path type: {type(custom_filepath)}')
        print(f'[Save] Path length: {len(custom_filepath) if custom_filepath else 0}')
        
        # REQUIRE user-selected path - never save to app data directory
        if not custom_filepath:
            return jsonify({'error': 'File path is required. User must select a save location.'}), 400
        
        # Clean and normalize the path
        filepath = custom_filepath.strip()
        print(f'[Save] After strip: {repr(filepath)}')
        
        # Check for path separators
        has_forward_slash = '/' in filepath
        has_back_slash = '\\' in filepath
        print(f'[Save] Has forward slash: {has_forward_slash}, Has backslash: {has_back_slash}')
        
        # Normalize path separators to Windows style
        filepath = filepath.replace('/', '\\')
        print(f'[Save] After normalizing separators: {repr(filepath)}')
        
        # Split into directory and filename
        file_dir = os.path.dirname(filepath)
        file_name = os.path.basename(filepath)
        print(f'[Save] Directory part: {repr(file_dir)}')
        print(f'[Save] Filename part: {repr(file_name)}')
        
        # Fix common Windows path issues
        # Remove trailing dots or spaces from filename (Windows doesn't allow these)
        original_filename = file_name
        file_name = file_name.rstrip('. ')
        if file_name != original_filename:
            print(f'[Save] Cleaned filename from {repr(original_filename)} to {repr(file_name)}')
        
        if not file_name:
            return jsonify({'error': 'Invalid filename - filename is empty after cleaning'}), 400
        
        # Check for reserved Windows filenames
        reserved_names = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                         'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                         'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
        name_without_ext = os.path.splitext(file_name)[0].upper()
        if name_without_ext in reserved_names:
            print(f'[Save ERROR] Reserved Windows filename: {file_name}')
            return jsonify({'error': f'"{file_name}" is a reserved Windows filename. Please choose a different name.'}), 400
        
        # Remove any invalid characters from filename (excluding drive letter colon)
        invalid_chars = '<>"|?*'
        filename_part = file_name
        for char in invalid_chars:
            if char in filename_part:
                print(f'[Save ERROR] Invalid character found in filename: {repr(char)}')
                return jsonify({'error': f'Invalid character in filename: {char}. Please remove it and try again.'}), 400
        
        # Check for colons in the filename itself (not drive letter)
        if ':' in filename_part:
            print(f'[Save ERROR] Colon found in filename: {filename_part}')
            return jsonify({'error': 'Filename cannot contain colons (:). Please use a different name.'}), 400
        
        # Rebuild filepath with cleaned filename
        filepath = os.path.join(file_dir, file_name) if file_dir else file_name
        print(f'[Save] After rejoining dir and filename: {repr(filepath)}')
        
        # Ensure .prcl extension
        if not filepath.lower().endswith('.prcl'):
            filepath += '.prcl'
            print(f'[Save] Added .prcl extension: {repr(filepath)}')
        
        # Convert to absolute path if relative
        if not os.path.isabs(filepath):
            filepath = os.path.abspath(filepath)
            print(f'[Save] Converted to absolute path: {repr(filepath)}')
        
        # Check path length (Windows limit is 260 characters unless long path support enabled)
        if len(filepath) > 250:  # Leave some buffer
            print(f'[Save ERROR] Path too long ({len(filepath)} characters): {filepath}')
            return jsonify({'error': f'File path is too long ({len(filepath)} characters). Please choose a shorter path or filename.'}), 400
        
        # Ensure directory exists (for the user-selected path)
        file_dir = os.path.dirname(filepath)
        print(f'[Save] Final directory to check/create: {repr(file_dir)}')
        
        if file_dir:
            print(f'[Save] Checking if directory exists: {os.path.exists(file_dir)}')
            print(f'[Save] Checking if directory is dir: {os.path.isdir(file_dir) if os.path.exists(file_dir) else "N/A"}')
            
            try:
                if not os.path.exists(file_dir):
                    print(f'[Save] Creating directory: {file_dir}')
                    os.makedirs(file_dir, exist_ok=True)
                    print(f'[Save] Directory created successfully')
                else:
                    print(f'[Save] Directory already exists')
            except OSError as dir_error:
                print(f'[Save ERROR] Failed to create directory: {dir_error}')
                print(f'[Save ERROR] Error type: {type(dir_error).__name__}')
                print(f'[Save ERROR] Error errno: {getattr(dir_error, "errno", "N/A")}')
                return jsonify({'error': f'Cannot create directory: {str(dir_error)}'}), 400
        
        # Validate we can write to this location
        if file_dir and not os.path.exists(file_dir):
            print(f'[Save ERROR] Directory does not exist after creation attempt: {file_dir}')
            return jsonify({'error': 'Directory path is invalid or cannot be created'}), 400
        
        # Check if we have write permission
        if file_dir:
            try:
                # Try to access the directory
                test_path = os.path.join(file_dir, '.parcel_tools_test')
                print(f'[Save] Testing write permission with test file: {test_path}')
                with open(test_path, 'w') as test_file:
                    test_file.write('test')
                os.remove(test_path)
                print(f'[Save] Write permission test passed')
            except Exception as perm_error:
                print(f'[Save ERROR] No write permission: {perm_error}')
                return jsonify({'error': f'No write permission in directory: {file_dir}'}), 400
        
        # Final validation before write
        print(f'[Save] ==== FINAL PRE-WRITE VALIDATION ====')
        print(f'[Save] Final filepath: {repr(filepath)}')
        print(f'[Save] File exists check: {os.path.exists(filepath)}')
        print(f'[Save] Directory exists check: {os.path.exists(file_dir)}')
        print(f'[Save] Is absolute path: {os.path.isabs(filepath)}')
        print(f'[Save] Data size: {len(str(project_data))} chars')
        
        # Check for any non-ASCII characters in path that might cause issues
        try:
            filepath_ascii = filepath.encode('ascii')
            print(f'[Save] Path is pure ASCII')
        except UnicodeEncodeError:
            print(f'[Save] WARNING: Path contains non-ASCII characters')
            # Try to normalize the path
            try:
                import unicodedata
                filepath_normalized = unicodedata.normalize('NFKD', filepath)
                print(f'[Save] Normalized path: {repr(filepath_normalized)}')
            except:
                print(f'[Save] Could not normalize path')
        
        # Try to write the file
        print(f'[Save] ==== ATTEMPTING FILE WRITE ====')
        
        try:
            # Use a more explicit open mode
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                json.dump(project_data, f, indent=2, ensure_ascii=False)
            print(f'[Save] SUCCESS: File written successfully!')
            
            # Verify file was created
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                print(f'[Save] SUCCESS: File verified - Size: {file_size} bytes')
            else:
                print(f'[Save ERROR] File was written but cannot be found!')
                return jsonify({'error': 'File written but verification failed'}), 500
                
        except OSError as write_error:
            print(f'[Save ERROR] ==== FILE WRITE FAILED (OSError) ====')
            print(f'[Save ERROR] Error: {write_error}')
            print(f'[Save ERROR] Error type: {type(write_error).__name__}')
            print(f'[Save ERROR] Error errno: {getattr(write_error, "errno", "N/A")}')
            print(f'[Save ERROR] Error strerror: {getattr(write_error, "strerror", "N/A")}')
            print(f'[Save ERROR] Error filename: {getattr(write_error, "filename", "N/A")}')
            print(f'[Save ERROR] Error args: {write_error.args}')
            
            error_msg = str(write_error)
            if 'Errno 22' in error_msg or 'Invalid argument' in error_msg:
                detailed_error = f'Invalid file path. Windows path rules violated. Path: {filepath}'
                print(f'[Save ERROR] {detailed_error}')
                # Give more specific hint
                if len(filepath) > 200:
                    detailed_error += ' (Path is very long - try a shorter location)'
                if any(ord(c) > 127 for c in filepath):
                    detailed_error += ' (Path contains non-English characters - try an English path)'
                return jsonify({'error': detailed_error}), 400
            return jsonify({'error': f'Cannot write file: {error_msg}'}), 400
        except UnicodeError as write_error:
            print(f'[Save ERROR] ==== UNICODE ERROR ====')
            print(f'[Save ERROR] Error: {write_error}')
            return jsonify({'error': f'Unicode encoding error in path or filename: {str(write_error)}'}), 400
        except Exception as write_error:
            print(f'[Save ERROR] ==== UNEXPECTED WRITE ERROR ====')
            print(f'[Save ERROR] Error: {write_error}')
            print(f'[Save ERROR] Error type: {type(write_error).__name__}')
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Unexpected error writing file: {str(write_error)}'}), 400
        
        # Add to recent files (don't let this fail the save operation)
        try:
            metadata = {
                'projectName': project_name,
                'parcelCount': len(project_data.get('savedParcels', [])),
                'pointsCount': len(project_data.get('loadedPoints', {}))
            }
            print(f'[Save] Adding to recent files: {filepath}')
            add_to_recent_files('projects', filepath, os.path.basename(filepath), metadata)
            print(f'[Save] Recent files updated successfully')
        except Exception as recent_error:
            print(f'[Save WARNING] Failed to update recent files: {recent_error}')
            # Don't fail the save operation just because recent files failed
        
        print(f'[Save] ========== SAVE COMPLETE ==========')
        
        return jsonify({
            'success': True,
            'message': 'Project saved successfully',
            'filePath': filepath,
            'fileName': os.path.basename(filepath)
        })
    
    except Exception as e:
        print(f'[Save ERROR] ========== UNEXPECTED EXCEPTION ==========')
        print(f'[Save ERROR] {e}')
        print(f'[Save ERROR] Error type: {type(e).__name__}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/project/load', methods=['POST'])
def load_project_file():
    """Load project from file content or file path"""
    try:
        data = request.get_json()
        print(f'[Load Project] Received request data keys: {list(data.keys()) if data else "None"}')
        
        file_content = data.get('fileContent', '')
        file_path = data.get('filePath', '')
        file_name = data.get('fileName', '')
        
        print(f'[Load Project] file_content length: {len(file_content) if file_content else 0}')
        print(f'[Load Project] file_path: {file_path}')
        print(f'[Load Project] file_name: {file_name}')
        
        # If file path or name is provided, try to load from backend/data
        loaded_file_path = None
        if file_path or file_name:
            if file_name and not file_path:
                # Load from backend/data directory
                file_path = os.path.join(DATA_DIR, file_name)
                print(f'[Load Project] Constructed path from filename: {file_path}')
            
            print(f'[Load Project] Checking if file exists: {file_path}')
            if os.path.exists(file_path):
                loaded_file_path = file_path
                print(f'[Load Project] File exists, loading: {file_path}')
                with open(file_path, 'r', encoding='utf-8') as f:
                    project_data = json.load(f)
                print(f'[Load Project] Successfully loaded project data from file')
            else:
                error_msg = f'File not found: {file_path}'
                print(f'[Load Project ERROR] {error_msg}')
                return jsonify({'error': error_msg}), 404
        elif file_content:
            # Parse JSON from provided content
            print(f'[Load Project] Parsing JSON from file content')
            project_data = json.loads(file_content)
            print(f'[Load Project] Successfully parsed JSON from content')
            # If we have a path from the file, use it
            if file_path and os.path.exists(file_path):
                loaded_file_path = file_path
        else:
            error_msg = 'No file content, filePath, or fileName provided'
            print(f'[Load Project ERROR] {error_msg}')
            return jsonify({'error': error_msg}), 400
        
        # Synchronize with the latest points from pointsFilePath if it exists
        points_file_path = project_data.get('pointsFilePath')
        if points_file_path and os.path.exists(points_file_path):
            print(f'[Load Project] Found associated points file: {points_file_path}')
            try:
                with open(points_file_path, 'r', encoding='utf-8') as pf:
                    pnt_content = pf.read()
                
                imported_points = parse_points_content(pnt_content)
                if imported_points:
                    points_map = {p['id']: {'x': p['x'], 'y': p['y']} for p in imported_points}
                    project_data['loadedPoints'] = points_map
                    print(f'[Load Project] Synchronized {len(points_map)} points from points file.')
                    
                    # Recalculate areas and perimeters for all saved parcels
                    saved_parcels = project_data.get('savedParcels', [])
                    for parcel in saved_parcels:
                        area, perimeter = calculate_single_parcel_metrics(parcel, points_map)
                        parcel['area'] = area
                        parcel['perimeter'] = perimeter
                        
                        # Also update point coordinates inside parcel points list if present
                        if 'points' in parcel:
                            parcel['points'] = [
                                {
                                    'id': str(pt.get('id')),
                                    'x': points_map[str(pt.get('id'))]['x'] if str(pt.get('id')) in points_map else 0,
                                    'y': points_map[str(pt.get('id'))]['y'] if str(pt.get('id')) in points_map else 0
                                }
                                for pt in parcel.get('points', [])
                            ]
            except Exception as sync_err:
                print(f'[Load Project WARNING] Failed to sync points file: {sync_err}')
        
        # Add to recent files if we have a valid path
        if loaded_file_path:
            try:
                metadata = {
                    'projectName': project_data.get('projectName', ''),
                    'parcelCount': len(project_data.get('savedParcels', [])),
                    'pointsCount': len(project_data.get('loadedPoints', {}))
                }
                print(f'[Load Project] Adding to recent files: {loaded_file_path}')
                add_to_recent_files('projects', loaded_file_path, os.path.basename(loaded_file_path), metadata)
            except Exception as recent_err:
                print(f'[Load Project WARNING] Failed to add to recent files: {str(recent_err)}')
                # Don't fail the whole load if recent files fails
        
        print(f'[Load Project] Success! Returning project data')
        return jsonify({
            'success': True,
            'projectData': project_data,
            'filePath': loaded_file_path  # Return the file path for auto-save
        })
    
    except json.JSONDecodeError as e:
        error_msg = f'Invalid JSON: {str(e)}'
        print(f'[Load Project ERROR] {error_msg}')
        return jsonify({'error': error_msg}), 400
    except Exception as e:
        error_msg = str(e)
        print(f'[Load Project ERROR] Unexpected exception: {error_msg}')
        import traceback
        traceback.print_exc()  # Print full stack trace to console
        return jsonify({'error': error_msg}), 500


@app.route('/api/projects', methods=['GET'])
def list_project_files():
    """List all saved project files (from DATA_DIR, recent files, and common user directories)"""
    try:
        print('[List Projects] ========== START LIST PROJECTS ==========')
        projects = []
        project_paths_seen = set()  # Track paths to avoid duplicates
        scan_full = request.args.get('scan') == 'full'  # Optional: scan common directories
        print(f'[List Projects] Scan full: {scan_full}')
        
        # First, get projects from DATA_DIR
        if os.path.exists(DATA_DIR):
            for filename in os.listdir(DATA_DIR):
                if filename.endswith('.prcl'):
                    filepath = os.path.join(DATA_DIR, filename)
                    try:
                        if os.path.exists(filepath):
                            with open(filepath, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            
                            projects.append({
                                'fileName': filename,
                                'filePath': filepath,
                                'projectName': data.get('projectName', filename.replace('.prcl', '')),
                                'savedParcels': len(data.get('savedParcels', [])),
                                'pointsFile': data.get('pointsFileName', 'N/A'),
                                'lastModified': os.path.getmtime(filepath)
                            })
                            project_paths_seen.add(filepath)
                    except Exception:
                        continue
        
        # Scan common user directories for .prcl files
        if scan_full:
            print('[List Projects] Scanning common directories for .prcl files...')
            common_dirs = []
            
            # Add common Windows directories
            import sys
            if sys.platform == 'win32':
                user_home = os.path.expanduser('~')
                common_dirs = [
                    os.path.join(user_home, 'Documents'),
                    os.path.join(user_home, 'Desktop'),
                    os.path.join(user_home, 'Downloads'),
                    user_home
                ]
            
            for directory in common_dirs:
                if not os.path.exists(directory):
                    continue
                
                try:
                    # Search recursively but limit depth to 3 levels
                    for root, dirs, files in os.walk(directory):
                        # Calculate depth
                        depth = root[len(directory):].count(os.sep)
                        if depth > 2:
                            dirs[:] = []  # Don't recurse deeper
                            continue
                        
                        for filename in files:
                            if filename.endswith('.prcl'):
                                filepath = os.path.join(root, filename)
                                
                                if filepath in project_paths_seen:
                                    continue
                                
                                try:
                                    with open(filepath, 'r', encoding='utf-8') as f:
                                        data = json.load(f)
                                    
                                    projects.append({
                                        'fileName': filename,
                                        'filePath': filepath,
                                        'projectName': data.get('projectName', filename.replace('.prcl', '')),
                                        'savedParcels': len(data.get('savedParcels', [])),
                                        'pointsFile': data.get('pointsFileName', 'N/A'),
                                        'lastModified': os.path.getmtime(filepath)
                                    })
                                    project_paths_seen.add(filepath)
                                except Exception:
                                    continue
                except Exception as e:
                    print(f'[List Projects] Error scanning {directory}: {e}')
                    continue
        
        # Also include projects from recent files (includes custom paths from Save As)
        # First clean up recent files to remove deleted entries
        recent = load_recent_files()
        cleaned_projects = []
        cleaned_points = []
        needs_cleanup = False
        
        # Clean projects in recent files
        for file_entry in recent.get('projects', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_projects.append(file_entry)
            else:
                needs_cleanup = True  # Found deleted file
        
        # Clean points in recent files
        for file_entry in recent.get('points', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_points.append(file_entry)
            else:
                needs_cleanup = True  # Found deleted file
        
        # Save cleaned list if needed
        if needs_cleanup:
            recent['projects'] = cleaned_projects
            recent['points'] = cleaned_points
            save_recent_files(recent)
        
        # Now process cleaned projects list
        for file_entry in cleaned_projects:
            filepath = file_entry.get('path', '')
            
            # Double-check file still exists (race condition protection)
            if not filepath or not os.path.exists(filepath):
                continue
            
            if filepath not in project_paths_seen:
                try:
                    # Check if it's already in DATA_DIR (skip to avoid duplicates)
                    if not filepath.startswith(DATA_DIR):
                        with open(filepath, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        # Get last modified time
                        last_modified = os.path.getmtime(filepath)
                        
                        projects.append({
                            'fileName': os.path.basename(filepath),
                            'filePath': filepath,
                            'projectName': data.get('projectName', file_entry.get('name', '').replace('.prcl', '')),
                            'savedParcels': len(data.get('savedParcels', [])),
                            'pointsFile': data.get('pointsFileName', 'N/A'),
                            'lastModified': last_modified
                        })
                        project_paths_seen.add(filepath)
                except Exception:
                    # If file can't be read, skip it (already cleaned from recent files)
                    continue
        
        # Sort by last modified
        projects.sort(key=lambda x: x['lastModified'], reverse=True)
        
        print(f'[List Projects] Returning {len(projects)} projects')
        print('[List Projects] ========== END LIST PROJECTS ==========')
        
        return jsonify(projects)
    
    except Exception as e:
        print(f'[List Projects ERROR] ========== EXCEPTION ==========')
        print(f'[List Projects ERROR] {e}')
        print(f'[List Projects ERROR] Error type: {type(e).__name__}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/check-file-modified', methods=['POST'])
def check_file_modified():
    """Check if a file has been modified"""
    try:
        data = request.get_json()
        file_path = data.get('filePath', '')
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        modified_time = os.path.getmtime(file_path)
        
        return jsonify({'modified': modified_time})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/reload-points-file', methods=['POST'])
def reload_points_file():
    """Reload points from file"""
    try:
        data = request.get_json()
        file_path = data.get('filePath', '')
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Read points
        points = []
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or line.startswith('//'):
                    continue
                
                line = line.replace(';', ',')
                parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
                
                if len(parts) >= 3:
                    try:
                        point_id = parts[0]
                        x = float(parts[1])
                        y = float(parts[2])
                        points.append({'id': point_id, 'x': x, 'y': y})
                    except ValueError:
                        continue
        
        # Add to recent files
        metadata = {'pointsCount': len(points)}
        add_to_recent_files('points', file_path, os.path.basename(file_path), metadata)
        
        return jsonify({'points': points, 'count': len(points)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/import-points', methods=['POST'])
def import_points():
    """
    Import points from text data
    Expected JSON: { "data": "id,x,y\n1,0,0\n2,100,0\n..." }
    """
    try:
        data = request.get_json()
        text_data = data.get('data', '')
        
        points = []
        for line in text_data.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
            
            # Replace semicolons with commas
            line = line.replace(';', ',')
            
            # Split by comma or whitespace
            parts = [p.strip() for p in (line.split(',') if ',' in line else line.split()) if p.strip()]
            
            if len(parts) >= 3:
                try:
                    point_id = parts[0]
                    x = float(parts[1])
                    y = float(parts[2])
                    points.append({'id': point_id, 'x': x, 'y': y})
                except ValueError:
                    continue
        
        if not points:
            return jsonify({'error': 'No valid points found'}), 400
        
        return jsonify({'points': points, 'count': len(points)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/save-points-file', methods=['POST'])
def save_points_file():
    """
    Save points back to .pnt/.txt file
    Expected JSON: { "fileName": "points.pnt", "content": "text data", "filePath": "..." }
    """
    try:
        data = request.get_json()
        file_name = data.get('fileName', 'points.pnt')
        content = data.get('content', '')
        file_path = data.get('filePath', '')
        
        # If we have a path, use it; otherwise save to data directory
        if file_path and os.path.dirname(file_path):
            save_path = file_path
        else:
            save_path = os.path.join(DATA_DIR, file_name)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(save_path) if os.path.dirname(save_path) else DATA_DIR, exist_ok=True)
        
        # Write file
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return jsonify({
            'success': True,
            'message': 'Points file saved successfully',
            'fileName': os.path.basename(save_path),
            'filePath': save_path
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export-points', methods=['POST'])
def export_points():
    """
    Export points to text format
    Expected JSON: { "points": [{"id": "1", "x": 0, "y": 0}, ...] }
    """
    try:
        data = request.get_json()
        points = data.get('points', [])
        
        lines = ['# Parcel Tools - Point Export', f'# Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', '# Format: ID, X, Y', '']
        
        for point in points:
            lines.append(f"{point.get('id', '')}, {point.get('x', 0)}, {point.get('y', 0)}")
        
        return jsonify({'data': '\n'.join(lines)})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    """
    Export parcels to PDF - PROFESSIONAL SURVEYING FORMAT
    Expected JSON: { "parcels": [...], "points": {...} }
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        import io
        import base64
        
        data = request.get_json()
        parcels = data.get('parcels', [])
        points_by_id = data.get('points', {})
        file_heading = data.get('fileHeading', {})
        error_results = data.get('errorResults', None)  # Current/Unsaved calculation
        saved_error_calculations = data.get('savedErrorCalculations', []) # List of saved calculations
        is_buggy = data.get('isBuggy', False)
        
        # Create PDF in memory
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        def draw_bg_watermark(canvas_obj):
            if is_buggy:
                canvas_obj.saveState()
                canvas_obj.setFillColorRGB(0.95, 0.8, 0.8)
                canvas_obj.setFont("Helvetica-Bold", 36)
                canvas_obj.translate(width / 2, height / 2)
                canvas_obj.rotate(45)
                canvas_obj.drawCentredString(0, 0, "DEMO VERSION - UNSAVED BUILD")
                canvas_obj.restoreState()

        # Draw watermark on first page
        draw_bg_watermark(c)
        
        # Track if heading was added (only once) and page count
        heading_added = False
        page_count = 1
        
        def draw_page_number(canvas_obj, p_count):
            canvas_obj.saveState()
            canvas_obj.setFont("Courier-Bold", 10)
            page_text = f"Page {p_count}"
            canvas_obj.drawRightString(width - 40, 50, page_text)
            canvas_obj.restoreState()
        
        for parcel_idx, parcel in enumerate(parcels):
            # Only add new page if we run out of space, not for each parcel
            if parcel_idx == 0:
                y_position = height - 40
            else:
                # Check if we need a new page (add spacing between parcels)
                if y_position < 100:
                    draw_page_number(c, page_count)
                    
                    c.showPage()
                    draw_bg_watermark(c)
                    page_count += 1
                    y_position = height - 40
                else:
                    y_position -= 30  # Space between parcels
            
            # Add file heading on first page only if it exists and has content
            if not heading_added and file_heading:
                # Check if heading has any actual content
                has_content = any([
                    file_heading.get('block'),
                    file_heading.get('quarter'),
                    file_heading.get('parcels'),
                    file_heading.get('place'),
                    file_heading.get('additionalInfo')
                ])
                
                if has_content:
                    c.setFont("Courier-Bold", 11)
                    c.drawString(40, y_position, "=" * 60)
                    y_position -= 15
                    
                    if file_heading.get('block'):
                        c.drawString(40, y_position, f"BLOCK: {file_heading['block']}")
                        y_position -= 12
                    if file_heading.get('quarter'):
                        c.drawString(40, y_position, f"QUARTER: {file_heading['quarter']}")
                        y_position -= 12
                    if file_heading.get('parcels'):
                        c.drawString(40, y_position, f"PARCELS: {file_heading['parcels']}")
                        y_position -= 12
                    if file_heading.get('place'):
                        c.drawString(40, y_position, f"PLACE: {file_heading['place']}")
                        y_position -= 12
                    if file_heading.get('additionalInfo'):
                        y_position -= 5
                        c.setFont("Courier", 9)
                        c.drawString(40, y_position, file_heading['additionalInfo'])
                        y_position -= 12
                    
                    c.setFont("Courier-Bold", 11)
                    c.drawString(40, y_position, "=" * 60)
                    y_position -= 25
                    
                    heading_added = True
            
            parcel_num = parcel.get('number', 'N/A')
            ids = parcel.get('ids', [])
            area = parcel.get('area', 0)
            curves = parcel.get('curves', [])
            
            # Get unique IDs (remove closing duplicate)
            ids_unique = ids[:-1] if len(ids) >= 2 and ids[-1] == ids[0] else ids[:]
            
            # PARCEL NUMBER
            c.setFont("Courier", 12)
            c.drawString(40, y_position, f"PARCEL  NUMBER    {parcel_num}")
            y_position -= 30
            
            # ANGLES IN DEGREES
            c.setFont("Courier", 10)
            c.drawString(40, y_position, "ANGLES   IN   DEGREES")
            y_position -= 15
            c.drawString(40, y_position, "=" * 60)
            y_position -= 25
            
            # Table header
            c.setFont("Courier", 9)
            header = f"{'FROM':<4}  {'TO':<4}  {'DISTANCE':>8}  {'AZIMUTH':>8}    {'POINT':<5}  {'Y':>10}  {'X':>10}"
            c.drawString(40, y_position, header)
            y_position -= 12
            
            sep = f"{'====':<4}  {'====':<4}  {'========':>8}  {'========':>8}    {'=====':<5}  {'==========':>10}  {'==========':>10}"
            c.drawString(40, y_position, sep)
            y_position -= 12
            
            # Calculate and draw each leg
            for i in range(len(ids_unique)):
                from_id = ids_unique[i]
                to_id = ids_unique[(i + 1) % len(ids_unique)]
                
                if from_id in points_by_id and to_id in points_by_id:
                    from_pt = points_by_id[from_id]
                    to_pt = points_by_id[to_id]
                    
                    # Calculate distance
                    dx = to_pt['x'] - from_pt['x']
                    dy = to_pt['y'] - from_pt['y']
                    distance = math.sqrt(dx * dx + dy * dy)
                    
                    # Calculate azimuth (bearing from north)
                    azimuth = math.degrees(math.atan2(dx, dy))
                    if azimuth < 0:
                        azimuth += 360.0
                    
                    # Format line exactly like the example
                    line = (
                        f"{str(from_id):<4}  {str(to_id):<4}  "
                        f"{distance:>8.2f}  {azimuth:>8.4f}    "
                        f"{str(to_id):<5}  {to_pt['y']:>10.2f}  {to_pt['x']:>10.2f}"
                    )
                    c.drawString(40, y_position, line)
                    y_position -= 12
                    
                    if y_position < 100:
                        draw_page_number(c, page_count)
                        
                        c.showPage()
                        draw_bg_watermark(c)
                        page_count += 1
                        y_position = height - 40
                        
                        # Redraw table header on new page
                        c.setFont("Courier", 9)
                        c.drawString(40, y_position, header)
                        y_position -= 12
                        c.drawString(40, y_position, sep)
                        y_position -= 12
            
            y_position -= 10
            
            # Curve calculations if any
            if curves:
                for curve in curves:
                    from_id = curve.get('from')
                    to_id = curve.get('to')
                    M = curve.get('M', 0)
                    sign = curve.get('sign', 1)
                    
                    if from_id in points_by_id and to_id in points_by_id:
                        from_pt = points_by_id[from_id]
                        to_pt = points_by_id[to_id]
                        
                        # Calculate chord length
                        dx = to_pt['x'] - from_pt['x']
                        dy = to_pt['y'] - from_pt['y']
                        C = math.sqrt(dx * dx + dy * dy)
                        
                        # Calculate radius and segment area
                        R = (C * C) / (8.0 * M) + (M / 2.0) if M > 0 else 0
                        theta = 2.0 * math.asin(min(1.0, C / (2.0 * R))) if R > 0 else 0
                        seg_area = 0.5 * R * R * (theta - math.sin(theta)) if R > 0 else 0
                        
                        # F value (sagitta factor)
                        # F value (sagitta factor)
                        F = M
                        
                        sign_symbol = "(+)" if sign == 1 else "(-)"
                        
                        curve_line = f"FROM PARCEL  {from_id} --> {to_id} = {C:.2f}   R = {R:.2f}   F = {F:.3f}   {sign_symbol}   PARCEL AREA= {seg_area:.2f}"
                        c.drawString(40, y_position, curve_line)
                        y_position -= 12
                        
                        # Check for page break inside curves loop
                        if y_position < 100:
                            draw_page_number(c, page_count)
                            
                            c.showPage()
                            draw_bg_watermark(c)
                            page_count += 1
                            y_position = height - 40
                            
                            # Redraw curves header
                            c.setFont("Courier-Bold", 10)
                            c.drawString(40, y_position, "CURVES (continued):")
                            y_position -= 15
                            c.setFont("Courier", 9)
                
                y_position -= 10
            
            # Final AREA
            c.setFont("Courier", 11)
            c.drawString(40, y_position, f"AREA = {area:.3f}")
            y_position -= 30
        
        
        # Combine all error calculations to print
        # Prefer saved calculations, but include current if provided and list is empty, 
        # or just append current if it's not saved?
        # Let's simple combine them.
        all_calculations = []
        if saved_error_calculations:
            all_calculations.extend(saved_error_calculations)
        
        # Check if current error_results should be added (if not already in saved by ID logic? 
        # Current result usually doesn't have ID unless saved... logic is loose)
        # For now, if we have saved calculations, we assume the user manages what they want via "Save".
        # If saved list is empty, we fall back to showing the current one (legacy behavior).
        if not all_calculations and error_results:
            all_calculations.append(error_results)
            
        # If we have any calculations to show
        if all_calculations:
            
            # Start on a new page if we are near the bottom
            if y_position < 100:
                draw_page_number(c, page_count)
                c.showPage()
                draw_bg_watermark(c)
                page_count += 1
                y_position = height - 40
            else:
                 y_position -= 20
            
            # Main Header for Error Section
            c.setFont("Courier-Bold", 14)
            c.drawString(40, y_position, "ERROR CALCULATIONS REPORT")
            y_position -= 25
            
            for index, calc in enumerate(all_calculations):
                # Check for space for header
                if y_position < 150:
                    draw_page_number(c, page_count)
                    c.showPage()
                    draw_bg_watermark(c)
                    page_count += 1
                    y_position = height - 40
                
                # Calculation Header
                name = calc.get('name', f'Calculation #{index + 1}')
                timestamp = calc.get('timestamp', '')
                if timestamp:
                    try:
                        # Simple format cleanup if it's ISO
                        date_part = timestamp.split('T')[0]
                        time_part = timestamp.split('T')[1][:8]
                        timestamp = f"{date_part} {time_part}"
                    except:
                        pass
                
                c.setFont("Courier-Bold", 12)
                c.drawString(40, y_position, "=" * 60)
                y_position -= 15
                c.drawString(40, y_position, f"{name}  {timestamp}")
                y_position -= 15
                c.drawString(40, y_position, "=" * 60)
                y_position -= 25
                
                # Overall Summary
                c.setFont("Courier-Bold", 10)
                c.drawString(40, y_position, "SUMMARY:")
                y_position -= 20
                
                c.setFont("Courier", 9)
                c.drawString(40, y_position, f"Total Registered Area:    {calc['totalRegisteredArea']:.4f} m²")
                y_position -= 15
                c.drawString(40, y_position, f"Total Calculated Area:    {calc['totalCalculatedArea']:.4f} m²")
                y_position -= 15
                c.drawString(40, y_position, f"Absolute Difference:      {calc['absoluteDifference']:.4f} m²")
                y_position -= 15
                c.drawString(40, y_position, f"Permissible Error:        {calc['permissibleError']:.4f} m²")
                y_position -= 20
                
                # Formula
                c.setFont("Courier", 8)
                formula_text = f"Formula: Permissible Error = 0.8 * sqrt({calc['totalRegisteredArea']:.2f}) + 0.002 * {calc['totalRegisteredArea']:.2f}"
                c.drawString(40, y_position, formula_text)
                y_position -= 20
                
                # Status
                c.setFont("Courier-Bold", 10)
                if calc['exceedsLimit']:
                    c.drawString(40, y_position, "WARNING: ERROR EXCEEDS PERMISSIBLE LIMITS - Using original areas")
                else:
                    c.drawString(40, y_position, "OK: WITHIN PERMISSIBLE LIMITS - Areas adjusted proportionally")
                y_position -= 30
                
                # Parcel Results Table Header
                c.setFont("Courier-Bold", 10)
                c.drawString(40, y_position, "PARCEL BREAKDOWN:")
                y_position -= 20
                
                # Table header
                c.setFont("Courier", 8)
                header_line = f"{'Parcel #':<12} {'Original (m²)':>15} {'Adjusted (m²)':>15} {'Rounded (m²)':>15} {'Points':>8}"
                c.drawString(40, y_position, header_line)
                y_position -= 12
                
                sep_line = f"{'-'*12:<12} {'-'*15:>15} {'-'*15:>15} {'-'*15:>15} {'-'*8:>8}"
                c.drawString(40, y_position, sep_line)
                y_position -= 15
                
                # Parcel rows
                c.setFont("Courier", 8)
                for parcel_result in calc['parcelResults']:
                    if y_position < 60:
                        draw_page_number(c, page_count)
                        
                        c.showPage()
                        draw_bg_watermark(c)
                        page_count += 1
                        y_position = height - 40
                        c.setFont("Courier", 8)
                    
                    parcel_num = str(parcel_result['parcelNumber'])
                    original = parcel_result['calculatedArea']
                    adjusted = parcel_result['adjustedArea']
                    rounded = parcel_result['roundedArea']
                    points = parcel_result['pointCount']
                    
                    row_line = f"{parcel_num:<12} {original:>15.4f} {adjusted:>15.4f} {rounded:>15} {points:>8}"
                    c.drawString(40, y_position, row_line)
                    y_position -= 12
                
                # Total row
                if y_position < 60:
                    draw_page_number(c, page_count)
                    
                    c.showPage()
                    draw_bg_watermark(c)
                    page_count += 1
                    y_position = height - 40
                
                y_position -= 5
                c.setFont("Courier-Bold", 8)
                total_original = sum(p['calculatedArea'] for p in calc['parcelResults'])
                total_adjusted = sum(p['adjustedArea'] for p in calc['parcelResults'])
                total_rounded = sum(p['roundedArea'] for p in calc['parcelResults'])
                total_points = sum(p['pointCount'] for p in calc['parcelResults'])
                
                total_line = f"{'TOTAL:':<12} {total_original:>15.4f} {total_adjusted:>15.4f} {total_rounded:>15} {total_points:>8}"
                c.drawString(40, y_position, total_line)
                y_position -= 40 # Space between calculations
        
        # Add final page number
        draw_page_number(c, page_count)
        
        c.save()
        
        # Convert to base64 to send to frontend
        buffer.seek(0)
        pdf_data = base64.b64encode(buffer.read()).decode('utf-8')
        
        return jsonify({'pdfData': pdf_data, 'fileName': 'parcels_export.pdf'})
    
    except ImportError:
        return jsonify({'error': 'ReportLab not installed. Run: pip install reportlab'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/ask', methods=['POST'])
def ai_ask():
    """
    Assistant endpoint. If OPENAI_API_KEY is set, forwards to OpenAI.
    Otherwise, answers from local docs/FAQs with simple keyword ranking.
    Expected JSON: { "messages": [{role, content}, ...] }
    """
    try:
        data = request.get_json() or {}
        messages = data.get('messages', [])
        user_q = ''
        for m in reversed(messages):
            if m.get('role') == 'user':
                user_q = m.get('content', '').strip()
                break
        if not user_q:
            return jsonify({ 'answer': 'Please type a question about Parcel Tools.' })

        # If OpenAI key is present, try using it
        cfg = load_ai_config()
        openai_key = os.environ.get('OPENAI_API_KEY') or cfg.get('openai_api_key')
        model = cfg.get('model', 'gpt-4o-mini')
        if openai_key:
            try:
                import requests
                prompt = (
                    "You are the Parcel Tools in-app assistant. Answer briefly and concretely. "
                    "Focus on how to use features of the Electron+React app with Python backend: "
                    "points loading, area calculator with curves, project save/load, PDF export, auto-watch.\n\n"
                    f"User: {user_q}"
                )
                resp = requests.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers={
                        'Authorization': f'Bearer {openai_key}',
                        'Content-Type': 'application/json'
                    },
                    json={
                        'model': model,
                        'messages': [
                            { 'role': 'system', 'content': 'You are a helpful assistant for the Parcel Tools desktop app.' },
                            { 'role': 'user', 'content': prompt }
                        ],
                        'temperature': 0.2
                    }, timeout=12
                )
                if resp.ok:
                    data = resp.json()
                    answer = data['choices'][0]['message']['content']
                    return jsonify({ 'answer': answer })
            except Exception:
                pass  # Fall back to local docs

        # Local docs/FAQ fallback
        kb_paths = [
            os.path.join(os.path.dirname(__file__), '..', 'README.md'),
            os.path.join(os.path.dirname(__file__), '..', 'SETUP.md'),
            os.path.join(os.path.dirname(__file__), '..', 'BUILD_INSTRUCTIONS.md'),
            os.path.join(os.path.dirname(__file__), '..', 'src', 'pages', 'ParcelCalculator.jsx'),
            os.path.join(os.path.dirname(__file__), '..', 'src', 'pages', 'DataFiles.jsx'),
            os.path.join(os.path.dirname(__file__), '..', 'WHAT_WAS_CREATED.md'),
            os.path.join(os.path.dirname(__file__), '..', 'BACKUP_INSTRUCTIONS.md'),
        ]

        docs = []
        for p in kb_paths:
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
                    docs.append((os.path.basename(p), text))
            except Exception:
                continue

        # Very simple keyword score
        tokens = [t for t in re.split(r"[^\w]+", user_q.lower()) if t]
        scored = []
        for name, text in docs:
            tl = text.lower()
            score = sum(tl.count(tok) for tok in tokens)
            scored.append((score, name, text))
        scored.sort(reverse=True)

        if not scored or scored[0][0] == 0:
            return jsonify({ 'answer': 'I could not find this in the docs. Try asking about: loading points, entering IDs, curves (M value), auto-save, or PDF export.' })

        # Return top 3 snippets (first 700 chars each)
        snippets = []
        for i, (_, name, text) in enumerate(scored[:3]):
            snippets.append(f"From {name}:\n" + text[:700].strip())
        answer = ("Here is what I found:\n\n" + "\n\n---\n\n".join(snippets))
        return jsonify({ 'answer': answer })

    except Exception as e:
        return jsonify({ 'answer': f'Assistant error: {str(e)}' })


@app.route('/api/ai/config', methods=['GET', 'POST'])
def ai_config():
    try:
        # Get user ID from query params or headers
        user_id = request.args.get('userId') or request.headers.get('X-User-ID')
        
        if request.method == 'GET':
            if user_id:
                # Get from Firebase
                print(f'[AI Config] Getting from Firebase for user: {user_id}')
                cfg = firebase_service.get_ai_config(user_id)
            else:
                # Fallback to local
                cfg = load_ai_config()
            
            safe_cfg = {
                'hasKey': bool(cfg.get('openai_api_key') or os.environ.get('OPENAI_API_KEY')),
                'model': cfg.get('model', 'gpt-4o-mini')
            }
            return jsonify(safe_cfg)
        else:
            data = request.get_json() or {}
            
            if user_id:
                # Get from Firebase
                cfg = firebase_service.get_ai_config(user_id)
            else:
                # Get from local
                cfg = load_ai_config()
            
            if 'openai_api_key' in data and data['openai_api_key']:
                cfg['openai_api_key'] = data['openai_api_key']
            if 'model' in data and data['model']:
                cfg['model'] = data['model']
            
            if user_id:
                # Save to Firebase
                print(f'[AI Config] Saving to Firebase for user: {user_id}')
                result = firebase_service.save_ai_config(user_id, cfg)
                ok = result.get('success', False)
            else:
                # Save to local
                ok = save_ai_config(cfg)
            
            return jsonify({ 'success': ok })
    except Exception as e:
        print(f'[AI Config ERROR] {e}')
        return jsonify({ 'success': False, 'error': str(e) }), 500


@app.route('/api/recent-files', methods=['GET'])
def get_recent_files():
    """Get recent files history - with automatic cleanup of deleted files"""
    try:
        # Get user ID from query params or headers
        user_id = request.args.get('userId') or request.headers.get('X-User-ID')
        
        if user_id:
            # Try Firebase first
            print(f'[Recent Files] Getting from Firebase for user: {user_id}')
            recent = firebase_service.get_recent_files(user_id)
        else:
            # Fallback to local JSON
            print('[Recent Files] No user ID, using local storage')
            recent = load_recent_files()
        
        # Clean up deleted files from recent files
        cleaned_projects = []
        cleaned_points = []
        needs_save = False
        
        # Clean projects
        for file_entry in recent.get('projects', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_projects.append(file_entry)
            else:
                needs_save = True  # File was deleted, need to save cleaned list
        
        # Clean points
        for file_entry in recent.get('points', []):
            filepath = file_entry.get('path', '')
            if filepath and os.path.exists(filepath):
                cleaned_points.append(file_entry)
            else:
                needs_save = True  # File was deleted, need to save cleaned list
        
        # Save cleaned list if needed
        if needs_save:
            recent['projects'] = cleaned_projects
            recent['points'] = cleaned_points
            if user_id:
                firebase_service.save_recent_files(user_id, recent)
            else:
                save_recent_files(recent)
        
        return jsonify(recent)
    except Exception as e:
        print(f'[Recent Files ERROR] {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent-files', methods=['POST'])
def add_recent_file():
    """Add a file to recent files history"""
    try:
        data = request.get_json() or {}
        file_type = data.get('type')  # 'projects' or 'points'
        file_path = data.get('path', '')
        file_name = data.get('name', '')
        metadata = data.get('metadata', {})
        user_id = data.get('userId')  # Optional user ID
        
        if not file_type or not file_path or not file_name:
            return jsonify({'error': 'Missing required fields: type, path, name'}), 400
        
        if file_type not in ['projects', 'points']:
            return jsonify({'error': 'Type must be "projects" or "points"'}), 400
        
        if user_id:
            # Sync to Firebase
            print(f'[Recent Files] Syncing to Firebase for user: {user_id}')
            recent = firebase_service.get_recent_files(user_id)
            file_list = recent.get(file_type, [])
            
            # Remove if already exists
            file_list = [f for f in file_list if f.get('path') != file_path]
            
            # Add to beginning
            file_entry = {
                'path': file_path,
                'name': file_name,
                'lastAccessed': datetime.now().isoformat(),
                'metadata': metadata
            }
            file_list.insert(0, file_entry)
            file_list = file_list[:50]  # Keep last 50
            
            recent[file_type] = file_list
            firebase_service.save_recent_files(user_id, recent)
        else:
            # Use local storage
            add_to_recent_files(file_type, file_path, file_name, metadata)
        
        return jsonify({'success': True})
    except Exception as e:
        print(f'[Recent Files ERROR] {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/recent-files/clear', methods=['POST'])
def clear_recent_files():
    """Clear recent files history"""
    try:
        data = request.get_json() or {}
        file_type = data.get('type')  # 'projects', 'points', or None for all
        
        recent = load_recent_files()
        if file_type:
            if file_type in recent:
                recent[file_type] = []
        else:
            recent = {'projects': [], 'points': []}
        
        save_recent_files(recent)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# LICENSE MANAGEMENT ENDPOINTS
# ============================================================================

@app.route('/api/license/status', methods=['GET'])
def get_license_status():
    """Get current license status"""
    try:
        # Debug logging
        license_file = license_manager.license_file
        print(f'[API] ═══ LICENSE STATUS CHECK ═══')
        print(f'[API] License file path: {license_file}')
        print(f'[API] File exists: {os.path.exists(license_file)}')
        
        # 1. First, check if user session token is passed in header
        token = request.headers.get('X-Session-Token', '')
        email_to_check = None
        user_id_to_check = None
        
        if token:
            try:
                machine_hash = license_manager.get_machine_id_hash()
                uid, _ = license_manager.verify_session_token(token, machine_hash)
                user_id_to_check = uid
                print(f'[API] Verified X-Session-Token. UID: {uid}')
            except Exception as e:
                print(f'[API] Warning: Session token verification failed: {e}')
        
        # 2. Check if local license file exists to read email
        if os.path.exists(license_file):
            print(f'[API] File size: {os.path.getsize(license_file)} bytes')
            try:
                with open(license_file, 'r', encoding='utf-8') as f:
                    license_data = json.load(f)
                    email_to_check = license_data.get('email')
                    print(f'[API] Email from license file: {email_to_check}')
            except Exception as e:
                print(f'[API] Error reading license file: {e}')
        else:
            print(f'[API] ❌ License file NOT FOUND!')
            
        # 3. Check online active status in Firestore
        is_blocked = False
        user_data = None
        if user_id_to_check:
            user_data = firebase_service.get_user(user_id_to_check)
        elif email_to_check:
            user_data = firebase_service.get_user_by_email(email_to_check)
            
        if user_data:
            if user_data.get('is_active') is False:
                is_blocked = True
                print(f'[API] 🚨 USER ACCOUNT BLOCKED: {user_data.get("email")}')
            elif user_data.get('account_type') == 'demo':
                # License was deactivated online by admin
                if os.path.exists(license_file):
                    try:
                        os.remove(license_file)
                        print(f'[API] 🗑️ Local license file removed because account_type is demo (deactivated by admin)')
                    except Exception as e:
                        print(f'[API] Could not remove local license file: {e}')
                
        if is_blocked:
            blocked_status = {
                'status': 'blocked',
                'is_valid': False,
                'message': 'Your account has been disabled. Please contact support.'
            }
            print(f'[API] Blocked status returned: {blocked_status}')
            print(f'[API] ═══════════════════════════')
            return jsonify(blocked_status)
            
        mode = request.args.get('mode', 'premium')
        if user_data and user_data.get('account_type') == 'demo':
            status = license_manager._check_trial_status()
        elif user_data and user_data.get('account_type') == 'premium':
            status = license_manager.get_license_info()
            if not status.get('is_valid'):
                email_val = user_data.get('email', email_to_check or 'premium_user@parceltools.com')
                try:
                    lic_key = user_data.get('license_key')
                    if not lic_key:
                        lic_key = license_manager.generate_license_key(email_val)
                        if firebase_service._is_online() and user_id_to_check:
                            firebase_service.db.collection('users').document(user_id_to_check).set({'license_key': lic_key}, merge=True)
                        all_users = firebase_service._load_users_from_json()
                        if user_id_to_check and user_id_to_check in all_users:
                            all_users[user_id_to_check]['license_key'] = lic_key
                            firebase_service._save_users_to_json(all_users)
                    license_manager.activate_license(lic_key, email_val)
                    print(f'[API] Auto-created local license for online premium user: {email_val}')
                except Exception as e:
                    print(f'[API] Warning: auto-create license failed: {e}')
                
                status = {
                    'status': 'activated',
                    'is_valid': True,
                    'email': email_val,
                    'activated_date': user_data.get('upgraded_at', user_data.get('created_at', datetime.now().isoformat())),
                    'message': 'Licensed version (Premium Account)'
                }
        else:
            status = license_manager.get_license_info()
        print(f'[API] Status result (mode={mode}): {status}')
        print(f'[API] ═══════════════════════════')
        return jsonify(status)
    except Exception as e:
        print(f'[API] ERROR in get_license_status: {e}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'is_valid': False}), 500


# Trial mode removed - customers must purchase license


@app.route('/api/license/activate', methods=['POST'])
def activate_license():
    """Activate a paid license key"""
    try:
        data = request.json
        license_key = data.get('license_key', '').strip()
        email = data.get('email', '').strip()
        
        print(f'[API] ═══ LICENSE ACTIVATION ═══')
        print(f'[API] Email: {email}')
        print(f'[API] Key: {license_key}')
        
        if not license_key or not email:
            return jsonify({
                'success': False,
                'error': 'License key and email are required'
            }), 400
        
        result = license_manager.activate_license(license_key, email)
        print(f'[API] Activation result: {result}')
        
        # Verify file was created
        license_file = license_manager.license_file
        if os.path.exists(license_file):
            print(f'[API] ✅ License file created: {license_file}')
            print(f'[API] File size: {os.path.getsize(license_file)} bytes')
            # Test immediate readback
            test = license_manager.get_license_info()
            print(f'[API] Immediate readback: {test}')
        else:
            print(f'[API] ❌ WARNING: File NOT created at: {license_file}')
        print(f'[API] ═══════════════════════════')
        
        if result.get('success'):
            try:
                user_record = firebase_service.get_user_by_email(email)
                if user_record and user_record.get('uid'):
                    firebase_service.save_license(user_record['uid'], {
                        'key': license_key, 'email': email,
                        'activated_date': datetime.now().isoformat(), 'type': 'paid'
                    })
                    print(f'[API] Updated user {email} account_type to premium in Firestore')
            except Exception as db_err:
                print(f'[API] Note: Could not update user in Firestore: {db_err}')
            return jsonify(result)
        else:
            return jsonify(result), 400
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/license/deactivate', methods=['POST'])
def deactivate_license():
    """Deactivate current license"""
    try:
        result = license_manager.deactivate_license()
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/license/generate', methods=['POST'])
def generate_license_key():
    """
    Generate a license key for testing purposes
    NOTE: In production, remove this endpoint and generate keys on your payment server
    """
    try:
        data = request.json
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        key = license_manager.generate_license_key(email)
        return jsonify({'license_key': key, 'email': email})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# DXF / DWG FILE IMPORT
# ============================================================================

def _convert_dwg_to_dxf(dwg_path: str) -> str:
    """
    Convert a DWG file to DXF.
    Strategy:
      1. AutoCAD Core Console (accoreconsole.exe) - Headless, completely silent background converter.
      2. ODA File Converter (free CLI tool)
      3. AutoCAD COM automation (falls back to visible/running AutoCAD instance if Core Console fails)
      4. Raise helpful RuntimeError if neither available
    Returns the absolute path to the generated DXF file.
    """
    import tempfile, shutil, subprocess, glob

    def log_debug(msg):
        print(f"[dwg-convert] {msg}")

    log_debug(f"=== Starting _convert_dwg_to_dxf ===")
    log_debug(f"Input path: {dwg_path}")

    out_dir = tempfile.mkdtemp(prefix="parcel_tools_dwg_")
    log_debug(f"Temp output directory: {out_dir}")
    
    # Create a separate temporary input directory with an ASCII path
    # and copy the input DWG to "input.dwg" to bypass Unicode file path bugs in AutoCAD COM and ODA.
    temp_in_dir = os.path.join(out_dir, "input_files")
    os.makedirs(temp_in_dir, exist_ok=True)
    temp_dwg_path = os.path.join(temp_in_dir, "input.dwg")
    
    try:
        shutil.copy2(dwg_path, temp_dwg_path)
        use_temp_paths = True
        log_debug(f"Copied DWG successfully to: {temp_dwg_path}")
    except Exception as e:
        use_temp_paths = False
        log_debug(f"Failed to copy DWG to temp paths: {e}")

    dxf_out = os.path.join(out_dir, "input.dxf" if use_temp_paths else os.path.splitext(os.path.basename(dwg_path))[0] + ".dxf")
    active_dwg_path = temp_dwg_path if use_temp_paths else dwg_path

    # ── Method 1: AutoCAD Core Console (completely silent command-line converter) ──
    if sys.platform == "win32":
        try:
            accore_candidates = glob.glob(r"C:\Program Files\Autodesk\AutoCAD *\accoreconsole.exe")
            log_debug(f"AutoCAD accoreconsole candidates: {accore_candidates}")
            accore_exe = next((p for p in accore_candidates if os.path.isfile(p)), None)
            log_debug(f"Selected accore_exe: {accore_exe}")
            
            if accore_exe:
                script_path = os.path.join(out_dir, "export.scr")
                with open(script_path, "w", encoding="utf-8") as scr:
                    # _DXFOUT -> output path -> 16 (decimal accuracy) -> _QUIT -> N (do not save changes)
                    scr.write(f'_DXFOUT\n"{os.path.abspath(dxf_out)}"\n16\n_QUIT\nN\n')
                
                # Run accoreconsole silently
                log_debug(f"Running accoreconsole command: {[accore_exe, '/i', os.path.abspath(active_dwg_path), '/s', script_path]}")
                proc_res = subprocess.run(
                    [accore_exe, "/i", os.path.abspath(active_dwg_path), "/s", script_path],
                    check=True, capture_output=True, timeout=40
                )
                log_debug(f"accoreconsole stdout: {proc_res.stdout.decode(errors='replace')}")
                if os.path.isfile(dxf_out):
                    log_debug(f"Conversion successful via accoreconsole: {dxf_out}")
                    return dxf_out
                else:
                    log_debug(f"dxf_out file was not generated: {dxf_out}")
        except Exception as e:
            log_debug(f"AutoCAD Core Console conversion failed with exception: {e}")

    # ── Method 2: ODA File Converter ──────────────────────────────────────────
    oda_candidates = [
        r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
        r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
        shutil.which("ODAFileConverter"),
    ]
    oda_exe = next((p for p in oda_candidates if p and os.path.isfile(p)), None)

    if oda_exe:
        try:
            in_dir = temp_in_dir if use_temp_paths else os.path.dirname(dwg_path)
            fname = "input.dwg" if use_temp_paths else os.path.basename(dwg_path)
            subprocess.run(
                [oda_exe, in_dir, out_dir, "ACAD2018", "DXF", "0", "1", fname],
                check=True, capture_output=True, timeout=60
            )
            if os.path.isfile(dxf_out):
                print(f"[parse-cad] DWG→DXF via ODA: {dxf_out}")
                return dxf_out
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"ODA conversion failed: {e.stderr.decode(errors='replace')}")

    acad_error = None
    # ── Method 3: AutoCAD COM (fallback if Core Console/ODA not available) ──
    if sys.platform == "win32":
        try:
            import win32com.client
            import pythoncom
            pythoncom.CoInitialize()
            try:
                acad = win32com.client.GetActiveObject("AutoCAD.Application")
            except Exception:
                acad = win32com.client.Dispatch("AutoCAD.Application")
                acad.Visible = False

            # Open Read-Only to avoid locking issues if the user already has the file open
            doc = acad.Documents.Open(os.path.abspath(active_dwg_path), True)
            
            # Suppress all dialogs and warnings (EXPERT=5 suppresses the custom objects version conflict dialog)
            try:
                doc.SetVariable("FILEDIA", 0)
                doc.SetVariable("CMDDIA", 0)
                doc.SetVariable("EXPERT", 5)
                doc.SetVariable("PROXYGRAPHICS", 1)
                doc.SetVariable("PROXYNOTICE", 0)
            except Exception:
                pass

            # Try saving as DXF using newer to older formats
            # 65 = AC2018 DXF, 61 = AC2013 DXF, 49 = AC2010 DXF, 37 = AC2007 DXF, 13 = AC2000 DXF
            saved = False
            for fmt_code in [65, 61, 49, 37, 13]:
                try:
                    doc.SaveAs(os.path.abspath(dxf_out), fmt_code)
                    saved = True
                    break
                except Exception:
                    continue
            
            doc.Close(False)

            if saved and os.path.isfile(dxf_out):
                print(f"[parse-cad] DWG→DXF via AutoCAD COM: {dxf_out}")
                return dxf_out
            else:
                raise RuntimeError("AutoCAD rejected the save formats or the file was locked.")
        except Exception as e:
            acad_error = str(e)
            print(f"[parse-cad] AutoCAD COM unavailable: {e}")

    # ── No converter available ────────────────────────────────────────────────
    error_msg = "Could not convert DWG file. "
    if acad_error:
        error_msg += f"\nAutoCAD Error: {acad_error}"
    error_msg += "\n\nPlease either:\n• Keep AutoCAD OPEN on your computer while importing\n• OR Download the free ODA File Converter."
    
    raise RuntimeError(error_msg)



def _parse_dxf_file(dxf_path: str) -> dict:
    """Parse a DXF file and return entities + raw points."""
    try:
        # pyrefly: ignore [missing-import]
        import ezdxf
    except ImportError as e:
        import sys
        raise RuntimeError(f"ezdxf library not installed or import failed. sys.path: {sys.path}, Error: {str(e)}")

    try:
        doc = ezdxf.readfile(dxf_path)
    except Exception as e:
        raise RuntimeError(f"Could not read DXF file: {e}")

    entities = []
    raw_points = []
    point_counter = [1]

    def add_raw_point(x, y, z=0):
        pid = f"DXF_{point_counter[0]}"
        point_counter[0] += 1
        raw_points.append({"id": pid, "x": round(float(x), 4), "y": round(float(y), 4)})
        return pid

    def get_ent_color(entity, doc, override_layer=None):
        try:
            aci = entity.dxf.color
            # aci 256 is 'ByLayer', aci 0 is 'ByBlock'
            if aci == 256 or aci == 0:
                try:
                    layer_name = override_layer if override_layer else getattr(entity.dxf, 'layer', '0')
                    if layer_name in doc.layers:
                        aci = doc.layers.get(layer_name).color
                except:
                    pass
            
            if aci and 0 < aci < 256:
                r, g, b = ezdxf.colors.aci2rgb(aci)
                return f"#{r:02x}{g:02x}{b:02x}"
        except:
            pass
        return None

    # Determine which layer represents land parcels/boundaries.
    # In cadastral surveying (e.g., Palestine/Israel drawings), the primary parcel boundary layer is 'GIS'.
    all_doc_layers = set()
    try:
        if hasattr(doc, 'layers'):
            for l in doc.layers:
                all_doc_layers.add(str(l.dxf.name).strip().upper())
    except Exception:
        pass
    has_gis_layer = any(l == 'GIS' or 'GIS' in l for l in all_doc_layers)

    def is_parcel_boundary_layer(layer_name: str) -> bool:
        if not layer_name:
            return False
        lu = str(layer_name).strip().upper()
        if has_gis_layer:
            return (lu == 'GIS' or 'GIS' in lu)
        return any(k in lu for k in ['PARCEL', 'PLOT', 'TABU', 'QUSAI', 'QASIMA', 'BOUNDARY OF PARTITION'])

    def append_poly_or_explode(poly_type, closed, pts, segments_list, layer_name, color, filled=False):
        if not pts or len(pts) < 2:
            return
        # If filled SOLID or if it IS on the GIS/Parcel boundary layer, keep as polyline
        if filled or is_parcel_boundary_layer(layer_name):
            ent_dict = {
                "type": poly_type,
                "closed": closed,
                "points": pts,
                "layer": layer_name,
                "color": color
            }
            if segments_list:
                ent_dict["segments"] = segments_list
            if filled:
                ent_dict["filled"] = True
            entities.append(ent_dict)
        else:
            # Explode non-GIS polylines into individual unselectable line segments
            num_pts = len(pts)
            limit = num_pts if closed else num_pts - 1
            for i in range(limit):
                p1 = pts[i]
                p2 = pts[(i + 1) % num_pts]
                entities.append({
                    "type": "LINE",
                    "x1": p1["x"],
                    "y1": p1["y"],
                    "x2": p2["x"],
                    "y2": p2["y"],
                    "points": [p1, p2],
                    "layer": layer_name,
                    "color": color,
                    "closed": False
                })

    # Only read from Layouts. Block instances (INSERT) in layouts will be exploded.
    # We do NOT read doc.blocks directly because that gives unscaled/unplaced definitions at origin!
    all_entities = []
    try:
        for layout in doc.layouts:
            all_entities.extend(list(layout))
    except Exception as e:
        print(f"[parse-cad] Warning reading layouts: {e}")

    def process_entity(entity, parent_layer=None):
        try:
            etype = entity.dxftype()
        except:
            return

        try:
            ent_layer = getattr(entity.dxf, 'layer', '0')
            if parent_layer and (not ent_layer or ent_layer == '0' or ent_layer.lower() == 'defpoints'):
                entity.dxf.layer = parent_layer
        except Exception:
            pass

        if etype == "INSERT":
            try:
                ins_layer = getattr(entity.dxf, 'layer', '0')
                if parent_layer and (not ins_layer or ins_layer == '0' or ins_layer.lower() == 'defpoints'):
                    ins_layer = parent_layer
                for virt_ent in entity.virtual_entities():
                    process_entity(virt_ent, parent_layer=ins_layer)
                if hasattr(entity, 'attribs'):
                    for attrib in entity.attribs:
                        process_entity(attrib, parent_layer=ins_layer)
            except Exception:
                pass
            return

        if etype == "LWPOLYLINE":
            try:
                raw_pts = list(entity.get_points("xyb"))
                closed = bool(entity.closed)
                final_pts = []
                segments = []   # for pixel-perfect arc rendering on the canvas

                def _bulge_to_arc(px, py, nx, ny, bulge):
                    """Convert bulge + two endpoints into arc params for canvas arc().
                    Returns dict with cx, cy, r, startAngle, endAngle, ccw (all in radians).
                    """
                    theta = 4.0 * math.atan(abs(bulge))
                    d = math.hypot(nx - px, ny - py)
                    if d < 1e-9:
                        return None
                    r = d / (2.0 * math.sin(theta / 2.0))
                    mx_c, my_c = (px + nx) / 2.0, (py + ny) / 2.0
                    dx_c, dy_c = nx - px, ny - py
                    perp_len = math.hypot(-dy_c, dx_c)
                    if perp_len < 1e-9:
                        return None
                    pdx, pdy = -dy_c / perp_len, dx_c / perp_len
                    s = math.sqrt(max(0.0, r * r - (d / 2.0) ** 2))
                    sign = 1 if bulge > 0 else -1
                    cx_arc = mx_c + sign * s * pdx
                    cy_arc = my_c + sign * s * pdy
                    a_start = math.atan2(py - cy_arc, px - cx_arc)
                    a_end   = math.atan2(ny - cy_arc, nx - cx_arc)
                    ccw = bool(bulge > 0)
                    return {
                        "cx": round(float(cx_arc), 6),
                        "cy": round(float(cy_arc), 6),
                        "r":  round(float(r), 6),
                        "startAngle": round(float(a_start), 8),
                        "endAngle":   round(float(a_end), 8),
                        "ccw": ccw
                    }

                for idx, (px, py, bulge) in enumerate(raw_pts):
                    final_pts.append({"x": round(float(px), 4), "y": round(float(py), 4)})

                    if abs(bulge) > 1e-9:
                        next_idx = (idx + 1) % len(raw_pts)
                        nx, ny = raw_pts[next_idx][0], raw_pts[next_idx][1]
                        arc_params = _bulge_to_arc(px, py, nx, ny, bulge)
                        if arc_params:
                            # Add the start point as a line-to segment, then the arc
                            segments.append({"type": "line", "x": round(float(px), 4), "y": round(float(py), 4)})
                            segments.append({"type": "arc", **arc_params})
                            # Tessellate for point array (used in area calc + hit test)
                            theta = 4.0 * math.atan(abs(bulge))
                            a_start = arc_params["startAngle"]
                            a_end   = arc_params["endAngle"]
                            cx_arc  = arc_params["cx"]
                            cy_arc  = arc_params["cy"]
                            r       = arc_params["r"]
                            if bulge > 0:
                                if a_end <= a_start: a_end += 2 * math.pi
                            else:
                                if a_end >= a_start: a_end -= 2 * math.pi
                            steps = max(24, int(abs(theta) / math.radians(2)))
                            for si in range(1, steps):
                                t = si / steps
                                a = a_start + t * (a_end - a_start)
                                final_pts.append({"x": round(float(cx_arc + r * math.cos(a)), 4),
                                                  "y": round(float(cy_arc + r * math.sin(a)), 4)})
                        else:
                            segments.append({"type": "line", "x": round(float(px), 4), "y": round(float(py), 4)})
                    else:
                        segments.append({"type": "line", "x": round(float(px), 4), "y": round(float(py), 4)})

                append_poly_or_explode("LWPOLYLINE", closed, final_pts, segments, entity.dxf.layer, get_ent_color(entity, doc))
            except Exception as ex:
                print(f"[parse-cad] LWPOLYLINE failed: {ex}")

        elif etype == "POLYLINE":
            try:
                final_pts = []
                segments = []
                verts = list(entity.vertices)
                closed = bool(entity.is_closed)

                for idx, v in enumerate(verts):
                    px = float(v.dxf.location.x)
                    py = float(v.dxf.location.y)
                    final_pts.append({"x": round(px, 4), "y": round(py, 4)})
                    bulge = float(v.dxf.get('bulge', 0.0))

                    if abs(bulge) > 1e-9:
                        next_idx = (idx + 1) % len(verts)
                        nx = float(verts[next_idx].dxf.location.x)
                        ny = float(verts[next_idx].dxf.location.y)
                        arc_params = _bulge_to_arc(px, py, nx, ny, bulge)
                        if arc_params:
                            segments.append({"type": "line", "x": round(px, 4), "y": round(py, 4)})
                            segments.append({"type": "arc", **arc_params})
                            theta = 4.0 * math.atan(abs(bulge))
                            a_start = arc_params["startAngle"]
                            a_end   = arc_params["endAngle"]
                            cx2     = arc_params["cx"]
                            cy2     = arc_params["cy"]
                            r2      = arc_params["r"]
                            if bulge > 0:
                                if a_end <= a_start: a_end += 2 * math.pi
                            else:
                                if a_end >= a_start: a_end -= 2 * math.pi
                            steps2 = max(24, int(abs(theta) / math.radians(2)))
                            for si2 in range(1, steps2):
                                t2 = si2 / steps2
                                a2 = a_start + t2 * (a_end - a_start)
                                final_pts.append({"x": round(float(cx2 + r2 * math.cos(a2)), 4),
                                                  "y": round(float(cy2 + r2 * math.sin(a2)), 4)})
                        else:
                            segments.append({"type": "line", "x": round(px, 4), "y": round(py, 4)})
                    else:
                        segments.append({"type": "line", "x": round(px, 4), "y": round(py, 4)})

                append_poly_or_explode("POLYLINE", closed, final_pts, segments, entity.dxf.layer, get_ent_color(entity, doc))
            except Exception as ex:
                print(f"[parse-cad] POLYLINE failed: {ex}")

        elif etype == "LINE":
            try:
                s, e = entity.dxf.start, entity.dxf.end
                entities.append({
                    "type": "LINE",
                    "closed": False,
                    "points": [
                        {"x": round(float(s.x), 4), "y": round(float(s.y), 4)},
                        {"x": round(float(e.x), 4), "y": round(float(e.y), 4)},
                    ],
                    "layer": entity.dxf.layer,
                    "color": get_ent_color(entity, doc)
                })
            except Exception:
                pass
                
        elif etype == "ARC":
            try:
                center = entity.dxf.center
                radius = entity.dxf.radius
                start_angle = math.radians(entity.dxf.start_angle)
                end_angle = math.radians(entity.dxf.end_angle)
                
                if end_angle < start_angle:
                    end_angle += 2 * math.pi
                    
                points = []
                steps = 16
                for i in range(steps + 1):
                    angle = start_angle + (end_angle - start_angle) * (i / steps)
                    px = center.x + radius * math.cos(angle)
                    py = center.y + radius * math.sin(angle)
                    points.append({"x": round(float(px), 4), "y": round(float(py), 4)})
                
                entities.append({
                    "type": "ARC",
                    "closed": False,
                    "points": points,
                    "layer": entity.dxf.layer,
                    "color": get_ent_color(entity, doc)
                })
            except Exception:
                pass

        elif etype == "CIRCLE":
            try:
                center = entity.dxf.center
                radius = entity.dxf.radius
                points = []
                steps = 32
                for i in range(steps):
                    angle = 2 * math.pi * (i / steps)
                    px = center.x + radius * math.cos(angle)
                    py = center.y + radius * math.sin(angle)
                    points.append({"x": round(float(px), 4), "y": round(float(py), 4)})
                points.append(points[0]) # Close circle
                
                entities.append({
                    "type": "CIRCLE",
                    "closed": True,
                    "points": points,
                    "layer": entity.dxf.layer,
                    "color": get_ent_color(entity, doc)
                })
            except Exception:
                pass

        elif etype == "SPLINE":
            try:
                from ezdxf import path as ezdxf_path
                sp = ezdxf_path.make_path(entity)
                pts = []
                for vertex in sp.flattening(0.1):
                    pts.append({"x": round(float(vertex.x), 4), "y": round(float(vertex.y), 4)})
                if len(pts) >= 2:
                    append_poly_or_explode("LWPOLYLINE", bool(entity.closed), pts, None, entity.dxf.layer, get_ent_color(entity, doc))
            except Exception as ex:
                print(f"[parse-cad] SPLINE failed: {ex}")

        elif etype == "POINT":
            try:
                loc = entity.dxf.location
                add_raw_point(loc.x, loc.y)
                # Also add as a small drawable circle so it's visible on canvas
                steps = 8
                radius = 0.05 # Small point indicator
                pts = []
                for i in range(steps):
                    angle = 2 * math.pi * (i / steps)
                    px = loc.x + radius * math.cos(angle)
                    py = loc.y + radius * math.sin(angle)
                    pts.append({"x": round(float(px), 4), "y": round(float(py), 4)})
                pts.append(pts[0])
                entities.append({
                    "type": "CIRCLE",
                    "closed": True,
                    "points": pts,
                    "layer": entity.dxf.layer,
                    "color": get_ent_color(entity, doc)
                })
            except Exception:
                pass

        elif etype == "DIMENSION":
            try:
                # Path 1: try ezdxf explosion — works for most DXF dimension types
                virts = list(entity.virtual_entities())
                if virts:
                    for virt in virts:
                        process_entity(virt)
                else:
                    raise ValueError("virtual_entities() returned empty — using fallback")
            except Exception:
                # Path 2: manual fallback — extract geometry directly from DXF attributes
                try:
                    txt = ""
                    try:
                        txt = entity.plain_text()
                    except Exception:
                        txt = str(entity.dxf.get('text', ''))

                    def _safe_pt(attr_name):
                        """Return (x, y) from a DXF attribute regardless of Vec3 vs tuple."""
                        v = entity.dxf.get(attr_name, None)
                        if v is None:
                            return None
                        try:
                            return (float(v.x), float(v.y))
                        except AttributeError:
                            try:
                                return (float(v[0]), float(v[1]))
                            except Exception:
                                return None

                    col = get_ent_color(entity, doc)
                    lyr = entity.dxf.layer

                    # Draw measurement line between defpoint2 and defpoint3 if available
                    p1 = _safe_pt('defpoint2') or _safe_pt('defpoint')
                    p2 = _safe_pt('defpoint3') or _safe_pt('defpoint4') or _safe_pt('defpoint2')
                    if p1 and p2 and p1 != p2:
                        entities.append({
                            "type": "LINE", "closed": False,
                            "points": [
                                {"x": round(p1[0], 4), "y": round(p1[1], 4)},
                                {"x": round(p2[0], 4), "y": round(p2[1], 4)},
                            ],
                            "layer": lyr, "color": col
                        })

                    # Draw dimension text at text_midpoint
                    if txt:
                        tp = _safe_pt('text_midpoint') or p1
                        if tp:
                            txt_h = float(entity.dxf.get('text_height', 2.5))
                            entities.append({
                                "type": "TEXT_LABEL",
                                "text": txt,
                                "x": round(tp[0], 4), "y": round(tp[1], 4),
                                "halign": "center", "valign": "middle",
                                "points": [{"x": round(tp[0], 4), "y": round(tp[1], 4)}],
                                "layer": lyr, "color": col, "height": txt_h
                            })
                except Exception as fb_err:
                    print(f"[parse-cad] DIMENSION fallback failed: {fb_err}")



        elif etype == "LEADER":
            try:
                # Leaders are lines (often pointing to text)
                pts = []
                for p in entity.vertices:
                    pts.append({"x": round(float(p.x), 4), "y": round(float(p.y), 4)})
                if len(pts) >= 2:
                    entities.append({
                        "type": "LINE",
                        "closed": False,
                        "points": pts,
                        "layer": entity.dxf.layer,
                        "color": get_ent_color(entity, doc)
                    })
            except Exception:
                pass

        elif etype == "HATCH":
            try:
                from ezdxf import path
                hatch_paths = path.from_hatch(entity)
                for p in hatch_paths:
                    points = []
                    # Increase flattening distance to improve performance on large files
                    for vertex in p.flattening(0.5):
                        points.append({"x": round(float(vertex.x), 4), "y": round(float(vertex.y), 4)})
                    if len(points) >= 2:
                        append_poly_or_explode("POLYLINE", True, points, None, entity.dxf.layer, get_ent_color(entity, doc), filled=True)
            except Exception as e:
                print(f"[parse-cad] Hatch conversion failed: {e}")

        elif etype == "SOLID":
            # SOLID is a filled triangle/quadrilateral (3 or 4 vertices)
            try:
                pts = []
                for attr in ('vtx0', 'vtx1', 'vtx2', 'vtx3'):
                    try:
                        v = entity.dxf.get(attr)
                        if v is not None:
                            pts.append({"x": round(float(v.x), 4), "y": round(float(v.y), 4)})
                    except Exception:
                        pass
                if len(pts) >= 3:
                    # DXF SOLID vertex order is: vtx0, vtx1, vtx3, vtx2 (Z pattern → correct winding)
                    if len(pts) == 4:
                        pts = [pts[0], pts[1], pts[3], pts[2]]
                    append_poly_or_explode("LWPOLYLINE", True, pts, None, entity.dxf.layer, get_ent_color(entity, doc), filled=True)
            except Exception as e:
                print(f"[parse-cad] SOLID conversion failed: {e}")

        elif etype == "ELLIPSE":
            try:
                cx = float(entity.dxf.center.x)
                cy = float(entity.dxf.center.y)
                # major axis vector
                mx = float(entity.dxf.major_axis.x)
                my = float(entity.dxf.major_axis.y)
                major = math.hypot(mx, my)
                ratio = float(entity.dxf.ratio)  # minor/major
                minor = major * ratio
                rotation = math.atan2(my, mx)
                start_param = float(entity.dxf.get('start_param', 0))
                end_param = float(entity.dxf.get('end_param', math.pi * 2))
                steps = max(36, int(abs(end_param - start_param) * 18))
                pts = []
                for i in range(steps + 1):
                    t = start_param + (end_param - start_param) * i / steps
                    lx = math.cos(t) * major
                    ly = math.sin(t) * minor
                    rx = lx * math.cos(rotation) - ly * math.sin(rotation)
                    ry = lx * math.sin(rotation) + ly * math.cos(rotation)
                    pts.append({"x": round(cx + rx, 4), "y": round(cy + ry, 4)})
                closed = abs(end_param - start_param) >= math.pi * 2 - 0.01
                if len(pts) >= 2:
                    append_poly_or_explode("LWPOLYLINE", closed, pts, None, entity.dxf.layer, get_ent_color(entity, doc))
            except Exception as e:
                print(f"[parse-cad] Ellipse conversion failed: {e}")

        elif etype in ("TEXT", "MTEXT", "ATTRIB"):
            try:
                txt_content = entity.plain_text()
                # Use insert for TEXT/ATTRIB, and insert or attachment_point for MTEXT
                ins = entity.dxf.get('insert', (0,0,0))
                if etype == "ATTRIB":
                    # Attributes often use align_point if justified
                    if entity.dxf.get('halign', 0) != 0 or entity.dxf.get('valign', 0) != 0:
                        ins = entity.dxf.get('align_point', ins)
                
                halign_str = "left"
                valign_str = "alphabetic"
                if etype == "TEXT":
                    halign = entity.dxf.get('halign', 0)
                    valign = entity.dxf.get('valign', 0)
                    if halign in (1, 4): halign_str = "center"
                    elif halign == 2: halign_str = "right"
                    if valign == 2: valign_str = "middle"
                    elif valign == 3: valign_str = "top"
                    if halign != 0 or valign != 0:
                        ins = entity.dxf.get('align_point', ins)
                elif etype == "MTEXT":
                    attach = entity.dxf.get('attachment_point', 1)
                    if attach in (2, 5, 8): halign_str = "center"
                    elif attach in (3, 6, 9): halign_str = "right"
                    if attach in (1, 2, 3): valign_str = "top"
                    elif attach in (4, 5, 6): valign_str = "middle"
                pt_x = round(float(ins.x), 4)
                pt_y = round(float(ins.y), 4)
                rot = entity.dxf.get('rotation', 0.0)
                entities.append({
                    "type": "TEXT_LABEL",
                    "text": txt_content,
                    "x": pt_x,
                    "y": pt_y,
                    "halign": halign_str,
                    "valign": valign_str,
                    "rotation": round(float(rot), 2),
                    "points": [{"x": pt_x, "y": pt_y}],
                    "layer": entity.dxf.layer,
                    "color": get_ent_color(entity, doc),
                    "height": round(float(
                        # MTEXT uses char_height, TEXT/ATTRIB use height
                        entity.dxf.get('char_height', 2.0) if etype == 'MTEXT'
                        else entity.dxf.get('height', 2.0)
                    ), 4)
                })
            except Exception as e:
                print(f"[parse-cad] Text conversion failed: {e}")

    for entity in all_entities:
        process_entity(entity)

    # Extract layer information
    layers_data = []
    for layer in doc.layers:
        try:
            layers_data.append({
                "name": layer.dxf.name,
                "color": layer.color,
                "is_off": layer.is_off(),
                "is_frozen": layer.is_frozen(),
                "visible": not layer.is_off() and not layer.is_frozen()
            })
        except Exception:
            pass

    return {"entities": entities, "raw_points": raw_points, "layers": layers_data}


@app.route('/api/parse-cad', methods=['POST'])
def parse_cad():
    """
    Parse a DXF or DWG file and return drawable entities.
    Body: { "filePath": "C:\\path\\to\\file.dxf" }
    """
    try:
        data = request.get_json()
        file_path = data.get('filePath', '').strip()

        if not file_path:
            return jsonify({"error": "filePath is required"}), 400

        if not os.path.isfile(file_path):
            return jsonify({"error": f"File not found: {file_path}"}), 404

        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".dwg":
            try:
                dxf_path = _convert_dwg_to_dxf(file_path)
            except RuntimeError as e:
                import traceback
                print(f"[parse-cad ERROR] DWG conversion failed: {e}")
                traceback.print_exc()
                return jsonify({"error": str(e), "oda_required": True}), 422
        elif ext == ".dxf":
            dxf_path = file_path
        else:
            return jsonify({"error": "Only .dxf and .dwg files are supported"}), 400

        result = _parse_dxf_file(dxf_path)
        result["fileName"] = os.path.basename(file_path)
        result["fileType"] = ext.lstrip(".")

        return jsonify(result)

    except RuntimeError as e:
        import traceback
        print(f"[parse-cad ERROR] RuntimeError: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        print(f"[parse-cad ERROR] {e}")
        return jsonify({"error": f"Unexpected error: {e}"}), 500


if __name__ == '__main__':
    print("==> Starting Parcel Tools Backend API...")
    print("==> API running on http://127.0.0.1:5000")
    print("==> Ready to accept connections from Electron app")
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)


