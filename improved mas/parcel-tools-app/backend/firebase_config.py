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
        # Try to find service account key file
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        service_account_path = os.path.join(backend_dir, 'serviceAccountKey.json')
        
        if os.path.exists(service_account_path):
            print(f"[Firebase] Using service account key: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
            firebase_app = firebase_admin.initialize_app(cred)
        else:
            # Try environment variable
            service_account_env = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
            if service_account_env and os.path.exists(service_account_env):
                print(f"[Firebase] Using service account from env: {service_account_env}")
                cred = credentials.Certificate(service_account_env)
                firebase_app = firebase_admin.initialize_app(cred)
            else:
                # Try Application Default Credentials (for deployed environments)
                print("[Firebase] Attempting to use Application Default Credentials")
                firebase_app = firebase_admin.initialize_app()
        
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

    # 3. Fallback: try service account JSON (some projects store it there)
    sa_path = os.path.join(backend_dir, 'serviceAccountKey.json')
    if os.path.exists(sa_path):
        try:
            with open(sa_path, 'r') as f:
                sa = json.load(f)
            key = sa.get('api_key', '').strip()
            if key:
                return key
        except Exception:
            pass

    print('[Firebase] WARNING: Firebase API key not found — password verification will use fallback mode')
    return None


# Initialize on module import
initialize_firebase()
