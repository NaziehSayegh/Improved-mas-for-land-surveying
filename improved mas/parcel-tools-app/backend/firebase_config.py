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


# Initialize on module import
initialize_firebase()
