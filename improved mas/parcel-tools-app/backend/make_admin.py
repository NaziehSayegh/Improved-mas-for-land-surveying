import os
import sys
import json

# Add current dir to path
sys.path.append(os.path.dirname(__file__))

from firebase_config import get_firestore_client, get_firebase_auth
from firebase_service import FirebaseService

TARGET_EMAIL = "nsayegh2003@yahoo.com"

def main():
    print(f"Attempting to make user '{TARGET_EMAIL}' an admin...")
    
    # 1. Initialize Firebase
    db = get_firestore_client()
    auth = get_firebase_auth()
    
    if db is None or auth is None:
        print("Error: Failed to initialize Firebase connection.")
        sys.exit(1)
        
    try:
        # 2. Get user from Firebase Auth
        try:
            user = auth.get_user_by_email(TARGET_EMAIL)
            print(f"Found user in Firebase Auth: UID = {user.uid}")
        except Exception as e:
            print(f"Error finding user '{TARGET_EMAIL}' in Firebase Auth: {e}")
            sys.exit(1)
            
        # 3. Update in Firestore
        user_ref = db.collection('users').document(user.uid)
        doc = user_ref.get()
        if doc.exists:
            user_ref.update({'is_admin': True})
            print(f"Successfully updated Firestore document to set is_admin=True.")
        else:
            print(f"Firestore document for UID '{user.uid}' did not exist. Creating one...")
            user_data = {
                'email': TARGET_EMAIL,
                'license_key': '',
                'account_type': 'premium',
                'is_active': True,
                'is_admin': True,
                'created_at': doc.create_time.isoformat() if hasattr(doc, 'create_time') else '',
                'last_login': '',
            }
            user_ref.set(user_data)
            print("Successfully created document with is_admin=True.")
            
        # 4. Update in local development users.json cache
        dev_data_dir = os.path.join(os.path.dirname(__file__), 'data')
        dev_users_json = os.path.join(dev_data_dir, 'users.json')
        update_local_json(dev_users_json, user.uid)
        
        # 5. Update in local AppData users.json cache
        local_app_data = os.environ.get('LOCALAPPDATA')
        if local_app_data:
            appdata_users_json = os.path.join(local_app_data, 'ParcelTools', 'data', 'users.json')
            update_local_json(appdata_users_json, user.uid)
            
        # 6. Update in user profile folder users.json cache (fallback location)
        home_users_json = os.path.join(os.path.expanduser('~'), '.parceltools', 'data', 'users.json')
        update_local_json(home_users_json, user.uid)
        
        print("\nPromotion complete! The user is now an admin.")

    except Exception as e:
        print(f"Error during administration update: {e}")
        sys.exit(1)

def update_local_json(filepath, uid):
    if not os.path.exists(filepath):
        return
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if uid in data:
            data[uid]['is_admin'] = True
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Updated local cache at: {filepath}")
        else:
            # Email might exist under a different UID or we should search
            found = False
            for k, v in data.items():
                if v.get('email') == TARGET_EMAIL:
                    data[k]['is_admin'] = True
                    found = True
            if found:
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Updated local cache by email at: {filepath}")
    except Exception as e:
        print(f"Failed to update local cache at {filepath}: {e}")

if __name__ == "__main__":
    main()
