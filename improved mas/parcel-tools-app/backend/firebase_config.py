"""
Firebase Configuration Module
Initializes Firebase Admin SDK with offline support and fallback mechanisms
"""

import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
import json

# Global Firebase instances
db = None
firebase_app = None

def user_data_root():
    """Folder holding the app's per-user data (the same place the backend keeps its data folder)."""
    import sys
    if sys.platform == 'win32':
        return os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'ParcelTools')
    return os.path.join(os.path.expanduser('~'), '.parceltools')


def find_service_account_key():
    """Path of the Firebase admin key if this PC is an admin PC, else None.
    Order: environment variables, the user-data folder, then (development only) the backend folder."""
    candidates = [os.environ.get('PARCEL_TOOLS_SERVICE_ACCOUNT', ''), os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', ''),
                  os.path.join(user_data_root(), 'serviceAccountKey.json'),
                  os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')]
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    return None


def get_firebase_project_id():
    """Public project id (also in the web config that ships with the app)."""
    env = os.environ.get('FIREBASE_PROJECT_ID', '').strip()
    if env:
        return env
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firebase_web_config.json'), 'r', encoding='utf-8') as f:
            return (json.load(f).get('projectId') or '').strip() or None
    except Exception:
        return None


def initialize_firebase():
    """
    Initialize Firebase Admin SDK
    Supports multiple credential sources:
    1. Service account key file (serviceAccountKey.json)
    2. Environment variables
    3. Application Default Credentials (for production)
    """
    global db, firebase_app
    
    # Check if already initialized
    if firebase_app is not None:
        print("[Firebase] Already initialized")
        return db
    
    try:
        # The admin key must NOT live inside the installed app (every customer would get it). It is looked for in
        # the environment and in the admin's own user-data folder; the old in-folder location is kept for development.
        service_account_path = find_service_account_key()

        if service_account_path:
            print(f"[Firebase] Using service account key: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
            firebase_app = firebase_admin.initialize_app(cred)
        else:
            # No admin key: ordinary customer install. Firestore is then reached as the signed-in user over REST
            # (see rest_firestore.py / firebase_service.py) and Firestore security rules decide what is allowed.
            print("[Firebase] No admin key found - customer mode (signed-in user access only)")
            return None

        # Initialize Firestore
        db = firestore.client()
        print("[Firebase] Firebase initialized successfully!")
        return db
        
    except Exception as e:
        print(f"[Firebase] Failed to initialize Firebase: {e}")
        print("[Firebase] App will run in offline mode with JSON fallback")
        return None


def get_firestore_client():
    """Get Firestore client instance"""
    global db
    if db is None:
        db = initialize_firebase()
    return db


def is_firebase_available():
    """Check if Firebase is available and connected"""
    try:
        if db is None:
            return False
        # Try a simple operation to verify connection
        db.collection('_health_check').limit(1).get()
        return True
    except Exception as e:
        print(f"[Firebase] Connection check failed: {e}")
        return False


def get_firebase_auth():
    """Get Firebase Auth instance"""
    try:
        return auth
    except Exception as e:
        print(f"[Firebase] Auth not available: {e}")
        return None


def get_firebase_api_key():
    """
    Return the Firebase Web API key (used for REST password verification).
    Reads from:
      1. FIREBASE_API_KEY environment variable
      2. The 'api_key' field inside serviceAccountKey.json (if present)
      3. A separate firebase_web_config.json with a 'apiKey' field
    """
    # 1. Env var (highest priority)
    key = os.environ.get('FIREBASE_API_KEY', '').strip()
    if key:
        return key

    # 2. Try reading from a web config file alongside the service account
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    web_config_path = os.path.join(backend_dir, 'firebase_web_config.json')
    if os.path.exists(web_config_path):
        try:
            with open(web_config_path, 'r') as f:
                cfg = json.load(f)
            key = cfg.get('apiKey', '').strip()
            if key:
                return key
        except Exception:
            pass

    print('[Firebase] WARNING: Firebase API key not found — password verification will use fallback mode')
    return None


# Initialize on module import
initialize_firebase()
