import os
import sys

# Add current dir to path
sys.path.append(os.path.dirname(__file__))

try:
    from firebase_admin import auth
    from firebase_config import get_firestore_client
    
    # Init firebase
    get_firestore_client()
    
    users = auth.list_users()
    print("Firebase Users:")
    for user in users.users:
        print(f"UID: {user.uid}, Email: {user.email}")
except Exception as e:
    print(f"Error: {e}")
