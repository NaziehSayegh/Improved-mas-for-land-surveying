
import sys
import os

print(f"Python executable: {sys.executable}")
print(f"sys.path: {sys.path}")

try:
    import flask
    print("Flag: flask imported")
except ImportError as e:
    print(f"Error: flask not found: {e}")

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    print("Flag: firebase_admin imported")
except ImportError as e:
    print(f"Error: firebase_admin not found: {e}")
except Exception as e:
    print(f"Error: firebase_admin init failed: {e}")

print("Test complete")
