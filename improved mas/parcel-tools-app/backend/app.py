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
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.route('/api/auth/signup', methods=['POST'])
def auth_signup():
    """
    Create a new user account with email, password, and license key
    Expected JSON: { "email": "user@example.com", "password": "password123", "licenseKey": "XXXX-XXXX-XXXX-XXXX" }
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        license_key = data.get('licenseKey', '').strip()
        
        print(f'[Auth] Signup attempt for: {email}')
        
        # Validate inputs
        if not email or not password or not license_key:
            return jsonify({'error': 'Email, password, and license key are required'}), 400
        
        # Validate license key first
        if not license_manager.validate_license_key(license_key, email):
            # Try Gumroad validation
            gumroad_result = license_manager.verify_gumroad_key(license_key)
            if not gumroad_result.get('valid'):
                return jsonify({'error': 'Invalid license key'}), 400
        
        # Create user in Firebase
        result = firebase_service.create_user(email, password, license_key)
        
        if result['success']:
            # Save license information
            license_data = {
                'key': license_key,
                'email': email,
                'activated_date': datetime.now().isoformat(),
                'type': 'paid'
            }
            firebase_service.save_license(result['user_id'], license_data)
            
            print(f'[Auth] User created successfully: {email}')
            return jsonify({
                'success': True,
                'message': 'Account created successfully',
                'userId': result['user_id']
            })
        else:
            return jsonify({'error': result.get('error', 'Failed to create account')}), 400
            
    except Exception as e:
        print(f'[Auth ERROR] Signup failed: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """
    Login with email and password
    Expected JSON: { "email": "user@example.com", "password": "password123" }
    """
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        print(f'[Auth] Login attempt for: {email}')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Verify credentials
        result = firebase_service.verify_user_credentials(email, password)
        
        if result['success']:
            # Get user data
            user_data = firebase_service.get_user(result['user_id'])
            
            # Track device activation
            machine_id = license_manager.get_machine_id()
            device_result = firebase_service.add_device(
                result['user_id'], 
                machine_id, 
                "Windows PC"  # Could be made dynamic
            )
            
            if not device_result.get('success'):
                # Device limit reached
                return jsonify({
                    'error': device_result.get('error', 'Device limit reached'),
                    'device_count': device_result.get('device_count', 0)
                }), 403
            
            print(f'[Auth] Login successful: {email} (Device {device_result.get("device_count", 0)}/2)')
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'userId': result['user_id'],
                'email': email,
                'licenseKey': user_data.get('license_key') if user_data else None,
                'deviceCount': device_result.get('device_count', 0)
            })
        else:
            return jsonify({'error': result.get('error', 'Invalid credentials')}), 401
            
    except Exception as e:
        print(f'[Auth ERROR] Login failed: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify', methods=['POST'])
def auth_verify():
    """
    Verify user session
    Expected JSON: { "userId": "user_id_here" }
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'valid': False, 'error': 'User ID required'}), 400
        
        # Get user data
        user_data = firebase_service.get_user(user_id)
        
        if user_data:
            return jsonify({
                'valid': True,
                'email': user_data.get('email'),
                'licenseKey': user_data.get('license_key')
            })
        else:
            return jsonify({'valid': False, 'error': 'User not found'}), 404
            
    except Exception as e:
        print(f'[Auth ERROR] Verification failed: {e}')
        return jsonify({'valid': False, 'error': str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """
    Logout and deactivate device
    Expected JSON: { "userId": "user_id_here" }
    """
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        print(f'[Auth] Logout request for user: {user_id}')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        # Get machine ID and remove device
        machine_id = license_manager.get_machine_id()
        result = firebase_service.remove_device(user_id, machine_id)
        
        if result.get('success'):
            print(f'[Auth] Device deactivated for user: {user_id}')
            return jsonify({
                'success': True,
                'message': 'Logged out successfully'
            })
        else:
            return jsonify({'error': result.get('error', 'Logout failed')}), 500
            
    except Exception as e:
        print(f'[Auth ERROR] Logout failed: {e}')
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
                            'F': seg_area / (C * C) if C > 0 else 0,
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
        error_results = data.get('errorResults', None)  # Error calculation results
        
        # Create PDF in memory
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Track if heading was added (only once) and page count
        heading_added = False
        page_count = 1
        
        for parcel_idx, parcel in enumerate(parcels):
            # Only add new page if we run out of space, not for each parcel
            if parcel_idx == 0:
                y_position = height - 40
            else:
                # Check if we need a new page (add spacing between parcels)
                if y_position < 100:
                    # Add page number before showing new page
                    c.setFont("Courier-Bold", 10)
                    page_text = f"Page {page_count}"
                    text_width = c.stringWidth(page_text, "Courier-Bold", 10)
                    c.drawString((width - text_width) / 2, 50, page_text)
                    
                    c.showPage()
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
                        # Add page number before showing new page
                        c.setFont("Courier-Bold", 10)
                        page_text = f"Page {page_count}"
                        text_width = c.stringWidth(page_text, "Courier-Bold", 10)
                        c.drawString((width - text_width) / 2, 50, page_text)
                        
                        c.showPage()
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
                        F = seg_area / (C * C) if C > 0 else 0
                        
                        sign_symbol = "(+)" if sign == 1 else "(-)"
                        
                        curve_line = f"FROM PARCEL  {from_id} --> {to_id} = {C:.2f}   R = {R:.2f}   F = {F:.3f}   {sign_symbol}   PARCEL AREA= {seg_area:.2f}"
                        c.drawString(40, y_position, curve_line)
                        y_position -= 12
                        
                        # Check for page break inside curves loop
                        if y_position < 100:
                            # Add page number before showing new page
                            c.setFont("Courier-Bold", 10)
                            page_text = f"Page {page_count}"
                            text_width = c.stringWidth(page_text, "Courier-Bold", 10)
                            c.drawString((width - text_width) / 2, 50, page_text)
                            
                            c.showPage()
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
        
        # Add Error Calculations section if available
        if error_results and error_results.get('parcelResults'):
            # Check if we need a new page
            if y_position < 200:
                # Add page number before new page
                c.setFont("Courier-Bold", 10)
                page_text = f"Page {page_count}"
                text_width = c.stringWidth(page_text, "Courier-Bold", 10)
                c.drawString((width - text_width) / 2, 50, page_text)
                
                c.showPage()
                page_count += 1
                y_position = height - 40
            
            y_position -= 20
            
            # Error Calculations Header
            c.setFont("Courier-Bold", 12)
            c.drawString(40, y_position, "=" * 60)
            y_position -= 20
            c.drawString(40, y_position, "ERROR CALCULATIONS")
            y_position -= 15
            c.drawString(40, y_position, "=" * 60)
            y_position -= 25
            
            # Overall Summary
            c.setFont("Courier-Bold", 10)
            c.drawString(40, y_position, "OVERALL CALCULATION SUMMARY:")
            y_position -= 20
            
            c.setFont("Courier", 9)
            c.drawString(40, y_position, f"Total Registered Area:    {error_results['totalRegisteredArea']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Total Calculated Area:    {error_results['totalCalculatedArea']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Absolute Difference:      {error_results['absoluteDifference']:.4f} m²")
            y_position -= 15
            c.drawString(40, y_position, f"Permissible Error:        {error_results['permissibleError']:.4f} m²")
            y_position -= 20
            
            # Formula
            c.setFont("Courier", 8)
            formula_text = f"Formula: Permissible Error = 0.8 × √({error_results['totalRegisteredArea']:.2f}) + 0.002 × {error_results['totalRegisteredArea']:.2f}"
            c.drawString(40, y_position, formula_text)
            y_position -= 20
            
            # Status
            c.setFont("Courier-Bold", 10)
            if error_results['exceedsLimit']:
                c.drawString(40, y_position, "WARNING: ERROR EXCEEDS PERMISSIBLE LIMITS - Using original calculated areas")
            else:
                c.drawString(40, y_position, "OK: WITHIN PERMISSIBLE LIMITS - Areas adjusted proportionally")
            y_position -= 30
            
            # Parcel Results Table Header
            c.setFont("Courier-Bold", 10)
            c.drawString(40, y_position, "PARCEL RESULTS:")
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
            for parcel_result in error_results['parcelResults']:
                if y_position < 60:
                    c.showPage()
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
                c.showPage()
                y_position = height - 40
            
            y_position -= 5
            c.setFont("Courier-Bold", 8)
            total_original = sum(p['calculatedArea'] for p in error_results['parcelResults'])
            total_adjusted = sum(p['adjustedArea'] for p in error_results['parcelResults'])
            total_rounded = sum(p['roundedArea'] for p in error_results['parcelResults'])
            total_points = sum(p['pointCount'] for p in error_results['parcelResults'])
            
            total_line = f"{'TOTAL:':<12} {total_original:>15.4f} {total_adjusted:>15.4f} {total_rounded:>15} {total_points:>8}"
            c.drawString(40, y_position, total_line)
            y_position -= 20
        
        # Add final page number
        c.setFont("Courier-Bold", 10)
        page_text = f"Page {page_count}"
        text_width = c.stringWidth(page_text, "Courier-Bold", 10)
        c.drawString((width - text_width) / 2, 50, page_text)
        
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
        if os.path.exists(license_file):
            print(f'[API] File size: {os.path.getsize(license_file)} bytes')
            try:
                with open(license_file, 'r') as f:
                    content = f.read()
                    print(f'[API] File content (first 200 chars): {content[:200]}')
            except Exception as e:
                print(f'[API] Error reading file: {e}')
        else:
            print(f'[API] ❌ License file NOT FOUND!')
        
        status = license_manager.get_license_info()
        print(f'[API] Status result: {status}')
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


if __name__ == '__main__':
    print("==> Starting Parcel Tools Backend API...")
    print("==> API running on http://localhost:5000")
    print("==> Ready to accept connections from Electron app")
    app.run(host='localhost', port=5000, debug=True)


