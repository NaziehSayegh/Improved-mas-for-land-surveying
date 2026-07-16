"""
Firebase Service Layer
Provides high-level operations for Firestore with offline fallback to JSON files
"""

import json
import os
from datetime import datetime
from firebase_config import get_firestore_client, is_firebase_available
from google.cloud.firestore_v1.base_query import FieldFilter


class FirebaseService:
    """Service layer for Firebase operations with JSON fallback"""
    
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.db = get_firestore_client()
        
        # JSON fallback file paths
        self.projects_file = os.path.join(data_dir, 'projects.json')
        self.users_file = os.path.join(data_dir, 'users.json')
        self.recent_files_file = os.path.join(data_dir, 'recent_files.json')
        self.ai_config_file = os.path.join(data_dir, 'ai_config.json')
        
        # Ensure data directory exists
        os.makedirs(data_dir, exist_ok=True)
    
    def _is_online(self):
        """Check if Firebase is available"""
        return self.db is not None and is_firebase_available()
    
    # ==================== USER OPERATIONS ====================
    
    def create_user(self, email, password, license_key,
                    account_type='premium', machine_id_hash=None, trial_start=None):
        """
        Create a new user with Firebase Authentication.
        account_type: 'demo' (no license needed, 30-day trial) or 'premium' (license required)
        machine_id_hash: SHA-256 hash of the machine ID — account is locked to this machine
        trial_start: ISO datetime string when the trial began (from Registry)
        Returns: {'success': bool, 'user_id': str, 'error': str}
        """
        try:
            if self._is_online():
                from firebase_config import get_firebase_auth
                auth = get_firebase_auth()

                # Create user in Firebase Auth
                user = auth.create_user(email=email, password=password)

                # Create user document in Firestore
                user_data = {
                    'email': email,
                    'license_key': license_key or '',
                    'account_type': account_type,          # 'demo' | 'premium'
                    'machine_id_hash': machine_id_hash or '',
                    'trial_start': trial_start or datetime.now().isoformat(),
                    'is_active': True,                     # admin can set False to block
                    'is_admin': False,
                    'created_at': datetime.now().isoformat(),
                    'last_login': datetime.now().isoformat(),
                }

                self.db.collection('users').document(user.uid).set(user_data)
                self._save_user_to_json(user.uid, user_data)

                return {'success': True, 'user_id': user.uid, 'message': 'User created successfully'}
            else:
                # Offline mode — save to JSON only
                import uuid as _uuid
                user_id = str(_uuid.uuid4())
                user_data = {
                    'email': email,
                    'license_key': license_key or '',
                    'account_type': account_type,
                    'machine_id_hash': machine_id_hash or '',
                    'trial_start': trial_start or datetime.now().isoformat(),
                    'is_active': True,
                    'is_admin': False,
                    'created_at': datetime.now().isoformat(),
                    'last_login': datetime.now().isoformat(),
                }
                self._save_user_to_json(user_id, user_data)
                return {'success': True, 'user_id': user_id, 'message': 'User created in offline mode'}

        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def verify_user_credentials(self, email, password):
        """
        Verify user credentials
        Returns: {'success': bool, 'user_id': str, 'error': str}
        """
        try:
            if self._is_online():
                from firebase_config import get_firebase_auth
                auth = get_firebase_auth()
                
                # Firebase Auth doesn't have a direct verify method
                # We'll use the REST API or custom token approach
                # For now, return success if user exists
                user = auth.get_user_by_email(email)
                
                # Update last login
                self.db.collection('users').document(user.uid).update({
                    'last_login': datetime.now().isoformat()
                })
                
                return {
                    'success': True,
                    'user_id': user.uid,
                    'message': 'Login successful'
                }
            else:
                # Offline mode - check JSON
                users = self._load_users_from_json()
                for user_id, user_data in users.items():
                    if user_data.get('email') == email:
                        return {
                            'success': True,
                            'user_id': user_id,
                            'message': 'Login successful (offline mode)'
                        }
                
                return {
                    'success': False,
                    'error': 'User not found'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _normalize_user(self, data):
        if not data or not isinstance(data, dict):
            return data
        lic = data.get('license')
        lic_key = data.get('license_key')
        if (isinstance(lic, dict) and lic.get('key')) or (isinstance(lic_key, str) and lic_key.strip()):
            data['account_type'] = 'premium'
            if not data.get('license_key') and isinstance(lic, dict):
                data['license_key'] = lic.get('key', '')
        elif not data.get('account_type'):
            data['account_type'] = 'demo'
        return data

    def get_user(self, user_id):
        """Get user data"""
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    return self._normalize_user(doc.to_dict())
            
            # Fallback to JSON
            users = self._load_users_from_json()
            return self._normalize_user(users.get(user_id))
            
        except Exception as e:
            print(f"[Firebase Service] Error getting user: {e}")
            return None

    def get_user_by_email(self, email):
        """Get a user by email address from Firestore or local storage."""
        if not email:
            return None
        clean_email = email.strip().lower()
        try:
            if self._is_online():
                docs = self.db.collection('users').where('email', '==', clean_email).limit(1).stream()
                for doc in docs:
                    data = doc.to_dict()
                    data['uid'] = doc.id
                    return self._normalize_user(data)
            # Fallback/offline
            users = self._load_users_from_json()
            for uid, data in users.items():
                if data.get('email', '').strip().lower() == clean_email:
                    data['uid'] = uid
                    return self._normalize_user(data)
        except Exception as e:
            print(f"[Firebase Service] Error getting user by email {clean_email}: {e}")
        return None
    
    # ==================== PROJECT OPERATIONS ====================
    
    def save_project(self, user_id, project_id, project_data):
        """
        Save project to Firestore and JSON fallback
        Returns: {'success': bool, 'error': str}
        """
        try:
            project_doc = {
                'owner': user_id,
                'project_id': project_id,
                'projectName': project_data.get('projectName', 'Untitled'),
                'projectData': project_data,
                'updated_at': datetime.now().isoformat(),
                'created_at': project_data.get('created_at', datetime.now().isoformat())
            }
            
            if self._is_online():
                # Save to Firestore
                self.db.collection('projects').document(project_id).set(project_doc)
                print(f"[Firebase Service] ✅ Project saved to Firestore: {project_id}")
            
            # Always save to JSON as backup
            self._save_project_to_json(project_id, project_doc)
            
            return {'success': True}
            
        except Exception as e:
            print(f"[Firebase Service] Error saving project: {e}")
            # Try JSON fallback
            try:
                self._save_project_to_json(project_id, project_doc)
                return {'success': True, 'warning': 'Saved to local storage only'}
            except Exception as json_error:
                return {'success': False, 'error': str(json_error)}
    
    def load_project(self, project_id, user_id=None):
        """Load project from Firestore or JSON fallback"""
        try:
            if self._is_online():
                doc = self.db.collection('projects').document(project_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    # Verify ownership if user_id provided
                    if user_id and data.get('owner') != user_id:
                        return None
                    return data.get('projectData')
            
            # Fallback to JSON
            projects = self._load_projects_from_json()
            project = projects.get(project_id)
            if project:
                # Verify ownership if user_id provided
                if user_id and project.get('owner') != user_id:
                    return None
                return project.get('projectData')
            
            return None
            
        except Exception as e:
            print(f"[Firebase Service] Error loading project: {e}")
            return None
    
    def list_user_projects(self, user_id):
        """List all projects for a user"""
        try:
            projects = []
            
            if self._is_online():
                # Query Firestore
                docs = self.db.collection('projects').where(
                    filter=FieldFilter('owner', '==', user_id)
                ).stream()
                
                for doc in docs:
                    data = doc.to_dict()
                    projects.append({
                        'project_id': doc.id,
                        'projectName': data.get('projectName'),
                        'updated_at': data.get('updated_at'),
                        'created_at': data.get('created_at')
                    })
            else:
                # Load from JSON
                all_projects = self._load_projects_from_json()
                for project_id, project_data in all_projects.items():
                    if project_data.get('owner') == user_id:
                        projects.append({
                            'project_id': project_id,
                            'projectName': project_data.get('projectName'),
                            'updated_at': project_data.get('updated_at'),
                            'created_at': project_data.get('created_at')
                        })
            
            return projects
            
        except Exception as e:
            print(f"[Firebase Service] Error listing projects: {e}")
            return []
    
    def delete_project(self, project_id, user_id):
        """Delete a project"""
        try:
            if self._is_online():
                # Verify ownership before deleting
                doc = self.db.collection('projects').document(project_id).get()
                if doc.exists and doc.to_dict().get('owner') == user_id:
                    self.db.collection('projects').document(project_id).delete()
            
            # Delete from JSON
            self._delete_project_from_json(project_id)
            
            return {'success': True}
            
        except Exception as e:
            print(f"[Firebase Service] Error deleting project: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== LICENSE OPERATIONS ====================
    
    def save_license(self, user_id, license_data):
        """Save license information"""
        try:
            lic_key = license_data.get('key', '') if isinstance(license_data, dict) else ''
            if self._is_online():
                self.db.collection('users').document(user_id).set({
                    'license': license_data,
                    'license_updated_at': datetime.now().isoformat(),
                    'account_type': 'premium',
                    'license_key': lic_key
                }, merge=True)
            
            # Save to JSON
            users = self._load_users_from_json()
            if user_id in users:
                users[user_id]['license'] = license_data
                users[user_id]['account_type'] = 'premium'
                if lic_key:
                    users[user_id]['license_key'] = lic_key
                self._save_users_to_json(users)
            
            return {'success': True}
            
        except Exception as e:
            print(f"[Firebase Service] Error saving license: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_license(self, user_id):
        """Get license information for a user"""
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    return doc.to_dict().get('license')
            
            # Fallback to JSON
            users = self._load_users_from_json()
            user = users.get(user_id)
            if user:
                return user.get('license')
            
            return None
            
        except Exception as e:
            print(f"[Firebase Service] Error getting license: {e}")
            return None
    
    # ==================== DEVICE MANAGEMENT ====================
    
    def add_device(self, user_id, machine_id, device_name="Unknown Device", computer_name=None, os_user=None, os_platform=None):
        """
        Add a device to user's active devices
        Returns: {'success': bool, 'error': str, 'device_count': int}
        """
        try:
            if self._is_online():
                user_ref = self.db.collection('users').document(user_id)
                user_doc = user_ref.get()
                
                if not user_doc.exists:
                    return {'success': False, 'error': 'User not found'}
                
                user_data = user_doc.to_dict()
                devices = user_data.get('devices')
                if not isinstance(devices, dict):
                    devices = {}
                
                # Check if device already exists
                for device_id, device_info in devices.items():
                    if isinstance(device_info, dict) and device_info.get('machine_id') == machine_id:
                        # Update last_seen and other details
                        update_fields = {
                            f'devices.{device_id}.last_seen': datetime.now().isoformat()
                        }
                        if computer_name:
                            update_fields[f'devices.{device_id}.computer_name'] = computer_name
                        if os_user:
                            update_fields[f'devices.{device_id}.os_user'] = os_user
                        if os_platform:
                            update_fields[f'devices.{device_id}.os_platform'] = os_platform
                        if device_name != "Unknown Device":
                            update_fields[f'devices.{device_id}.device_name'] = device_name
                        user_ref.update(update_fields)
                        return {'success': True, 'device_count': len(devices), 'device_id': device_id}
                
                # Check device limit (max 2 devices)
                if len(devices) >= 2:
                    return {
                        'success': False,
                        'error': 'Device limit reached. Maximum 2 devices allowed. Please sign out from another device first.',
                        'device_count': len(devices)
                    }
                
                # Add new device
                import uuid
                device_id = str(uuid.uuid4())
                devices[device_id] = {
                    'machine_id': machine_id,
                    'device_name': device_name,
                    'computer_name': computer_name or '',
                    'os_user': os_user or '',
                    'os_platform': os_platform or '',
                    'activated_at': datetime.now().isoformat(),
                    'last_seen': datetime.now().isoformat()
                }
                
                user_ref.update({'devices': devices})
                
                return {'success': True, 'device_count': len(devices), 'device_id': device_id}
            else:
                # Offline mode - save to JSON
                users = self._load_users_from_json()
                if user_id not in users:
                    return {'success': False, 'error': 'User not found'}
                
                devices = users[user_id].get('devices')
                if not isinstance(devices, dict):
                    devices = {}
                
                # Check if device exists
                for device_id, device_info in devices.items():
                    if isinstance(device_info, dict) and device_info.get('machine_id') == machine_id:
                        devices[device_id]['last_seen'] = datetime.now().isoformat()
                        if computer_name:
                            devices[device_id]['computer_name'] = computer_name
                        if os_user:
                            devices[device_id]['os_user'] = os_user
                        if os_platform:
                            devices[device_id]['os_platform'] = os_platform
                        if device_name != "Unknown Device":
                            devices[device_id]['device_name'] = device_name
                        users[user_id]['devices'] = devices
                        self._save_users_to_json(users)
                        return {'success': True, 'device_count': len(devices), 'device_id': device_id}
                
                # Check device limit
                if len(devices) >= 2:
                    return {
                        'success': False,
                        'error': 'Device limit reached. Maximum 2 devices allowed.',
                        'device_count': len(devices)
                    }
                
                # Add new device
                import uuid
                device_id = str(uuid.uuid4())
                devices[device_id] = {
                    'machine_id': machine_id,
                    'device_name': device_name,
                    'computer_name': computer_name or '',
                    'os_user': os_user or '',
                    'os_platform': os_platform or '',
                    'activated_at': datetime.now().isoformat(),
                    'last_seen': datetime.now().isoformat()
                }
                
                users[user_id]['devices'] = devices
                self._save_users_to_json(users)
                
                return {'success': True, 'device_count': len(devices), 'device_id': device_id}
                
        except Exception as e:
            print(f"[Firebase Service] Error adding device: {e}")
            return {'success': False, 'error': str(e)}
    
    def remove_device(self, user_id, machine_id):
        """
        Remove a device from user's active devices
        Returns: {'success': bool, 'error': str}
        """
        try:
            if self._is_online():
                user_ref = self.db.collection('users').document(user_id)
                user_doc = user_ref.get()
                
                if not user_doc.exists:
                    return {'success': False, 'error': 'User not found'}
                
                user_data = user_doc.to_dict()
                devices = user_data.get('devices')
                if not isinstance(devices, dict):
                    devices = {}
                
                # Find and remove device
                device_to_remove = None
                for device_id, device_info in devices.items():
                    if isinstance(device_info, dict) and device_info.get('machine_id') == machine_id:
                        device_to_remove = device_id
                        break
                
                if device_to_remove:
                    del devices[device_to_remove]
                    user_ref.update({'devices': devices})
                    return {'success': True, 'message': 'Device removed successfully'}
                else:
                    return {'success': True, 'message': 'Device not found (already removed)'}
            else:
                # Offline mode
                users = self._load_users_from_json()
                if user_id not in users:
                    return {'success': False, 'error': 'User not found'}
                
                devices = users[user_id].get('devices')
                if not isinstance(devices, dict):
                    devices = {}
                device_to_remove = None
                
                for device_id, device_info in devices.items():
                    if isinstance(device_info, dict) and device_info.get('machine_id') == machine_id:
                        device_to_remove = device_id
                        break
                
                if device_to_remove:
                    del devices[device_to_remove]
                    users[user_id]['devices'] = devices
                    self._save_users_to_json(users)
                
                return {'success': True, 'message': 'Device removed successfully'}
                
        except Exception as e:
            print(f"[Firebase Service] Error removing device: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_device_count(self, user_id):
        """
        Get number of active devices for a user
        Returns: int
        """
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    devices = doc.to_dict().get('devices', {})
                    return len(devices)
            
            # Fallback to JSON
            users = self._load_users_from_json()
            user = users.get(user_id)
            if user:
                return len(user.get('devices', {}))
            
            return 0
            
        except Exception as e:
            print(f"[Firebase Service] Error getting device count: {e}")
            return 0
    
    # ==================== RECENT FILES OPERATIONS ====================
    
    def save_recent_files(self, user_id, recent_files):
        """Save recent files list"""
        try:
            if self._is_online():
                self.db.collection('users').document(user_id).update({
                    'recent_files': recent_files,
                    'recent_files_updated_at': datetime.now().isoformat()
                })
            
            # Save to JSON
            with open(self.recent_files_file, 'w', encoding='utf-8') as f:
                json.dump({user_id: recent_files}, f, indent=2, ensure_ascii=False)
            
            return {'success': True}
            
        except Exception as e:
            print(f"[Firebase Service] Error saving recent files: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_recent_files(self, user_id):
        """Get recent files list"""
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    return doc.to_dict().get('recent_files', {'projects': [], 'points': []})
            
            # Fallback to JSON
            if os.path.exists(self.recent_files_file):
                with open(self.recent_files_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get(user_id, {'projects': [], 'points': []})
            
            return {'projects': [], 'points': []}
            
        except Exception as e:
            print(f"[Firebase Service] Error getting recent files: {e}")
            return {'projects': [], 'points': []}
    
    # ==================== AI CONFIG OPERATIONS ====================
    
    def save_ai_config(self, user_id, config):
        """Save AI configuration"""
        try:
            if self._is_online():
                self.db.collection('users').document(user_id).update({
                    'ai_config': config,
                    'ai_config_updated_at': datetime.now().isoformat()
                })
            
            # Save to JSON
            with open(self.ai_config_file, 'w', encoding='utf-8') as f:
                json.dump({user_id: config}, f, indent=2)
            
            return {'success': True}
            
        except Exception as e:
            print(f"[Firebase Service] Error saving AI config: {e}")
            return {'success': False, 'error': str(e)}
    
    def get_ai_config(self, user_id):
        """Get AI configuration"""
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    return doc.to_dict().get('ai_config', {})
            
            # Fallback to JSON
            if os.path.exists(self.ai_config_file):
                with open(self.ai_config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get(user_id, {})
            
            return {}
            
        except Exception as e:
            print(f"[Firebase Service] Error getting AI config: {e}")
            return {}
    
    # ==================== ADMIN OPERATIONS ====================

    def get_all_users(self):
        """Admin: return list of all user records, merging Firestore and local JSON."""
        try:
            users_map = self._load_users_from_json()
            if self._is_online():
                try:
                    docs = self.db.collection('users').stream()
                    for doc in docs:
                        data = doc.to_dict() if doc else {}
                        users_map[doc.id] = data
                    # Sync merged data back to local JSON backup
                    self._save_users_to_json(users_map)
                except Exception as db_err:
                    print(f'[Firebase Admin] Firestore stream warning: {db_err}')
            
            result = []
            for uid, val in users_map.items():
                data = self._normalize_user(dict(val) if val else {})
                data['uid'] = uid
                mhash = data.get('machine_id_hash', '')
                data['machine_id_masked'] = f'...{mhash[-8:]}' if len(mhash) >= 8 else mhash
                result.append(data)
            return result
        except Exception as e:
            print(f'[Firebase Admin] get_all_users error: {e}')
            return []

    def set_user_active(self, uid, is_active: bool):
        """Admin: enable or disable a user account."""
        try:
            if self._is_online():
                self.db.collection('users').document(uid).set({'is_active': is_active}, merge=True)
            users = self._load_users_from_json()
            if uid not in users and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        users[uid] = doc.to_dict()
                except Exception:
                    pass
            if uid not in users:
                users[uid] = {'email': '', 'created_at': datetime.now().isoformat()}
            users[uid]['is_active'] = is_active
            self._save_users_to_json(users)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def extend_user_trial(self, uid, new_trial_start_iso: str):
        """Admin: reset trial_start to a new date (effectively extending the trial)."""
        try:
            if self._is_online():
                self.db.collection('users').document(uid).set({
                    'trial_start': new_trial_start_iso,
                    'trial_extended_at': datetime.now().isoformat()
                }, merge=True)
            users = self._load_users_from_json()
            if uid not in users and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        users[uid] = doc.to_dict()
                except Exception:
                    pass
            if uid not in users:
                users[uid] = {'email': '', 'created_at': datetime.now().isoformat()}
            users[uid]['trial_start'] = new_trial_start_iso
            self._save_users_to_json(users)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def reset_user_machine(self, uid):
        """Admin: clear machine binding so the user can log in from a new PC."""
        try:
            if self._is_online():
                self.db.collection('users').document(uid).set({
                    'machine_id_hash': '',
                    'devices': {},
                    'machine_reset_at': datetime.now().isoformat()
                }, merge=True)
            users = self._load_users_from_json()
            if uid not in users and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        users[uid] = doc.to_dict()
                except Exception:
                    pass
            if uid not in users:
                users[uid] = {'email': '', 'created_at': datetime.now().isoformat()}
            users[uid]['machine_id_hash'] = ''
            users[uid]['devices'] = {}
            self._save_users_to_json(users)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def upgrade_user_to_premium(self, uid):
        """Admin: upgrade a demo account to premium and generate license key."""
        try:
            users = self._load_users_from_json()
            if uid not in users and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        users[uid] = doc.to_dict()
                except Exception:
                    pass
            if uid not in users:
                users[uid] = {'email': '', 'created_at': datetime.now().isoformat()}
            
            email = users[uid].get('email', '')
            if not email and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        email = doc.to_dict().get('email', '')
                except Exception:
                    pass
            
            lic_key = users[uid].get('license_key', '')
            if not lic_key and email:
                try:
                    from license_manager import generate_key_for_email
                    lic_key = generate_key_for_email(email)
                except Exception as gen_err:
                    print(f'[Admin] Could not generate license key for {email}: {gen_err}')
            
            update_data = {
                'account_type': 'premium',
                'upgraded_at': datetime.now().isoformat()
            }
            if lic_key:
                update_data['license_key'] = lic_key
                
            if self._is_online():
                self.db.collection('users').document(uid).set(update_data, merge=True)
                
            users[uid]['account_type'] = 'premium'
            if lic_key:
                users[uid]['license_key'] = lic_key
            self._save_users_to_json(users)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deactivate_user_license(self, uid):
        """Admin: deactivate a user's license, reverting them to a demo account and clearing the license key."""
        try:
            if self._is_online():
                self.db.collection('users').document(uid).set({
                    'account_type': 'demo',
                    'license_key': '',
                    'license_deactivated_at': datetime.now().isoformat()
                }, merge=True)
            users = self._load_users_from_json()
            if uid not in users and self._is_online():
                try:
                    doc = self.db.collection('users').document(uid).get()
                    if doc.exists:
                        users[uid] = doc.to_dict()
                except Exception:
                    pass
            if uid not in users:
                users[uid] = {'email': '', 'created_at': datetime.now().isoformat()}
            target_email = users[uid].get('email', '')
            users[uid]['account_type'] = 'demo'
            users[uid]['license_key'] = ''
            self._save_users_to_json(users)

            # Also check if local license file belongs to this user/email and remove it
            try:
                lic_file = os.path.join(self.data_dir, 'license.json')
                if os.path.exists(lic_file):
                    with open(lic_file, 'r', encoding='utf-8') as f:
                        lic_data = json.load(f)
                    if target_email and lic_data.get('email', '').lower() == target_email.lower():
                        os.remove(lic_file)
                        print(f'[Admin] Removed local license file for deactivated user: {target_email}')
            except Exception as e:
                print(f'[Admin] Note on local license removal: {e}')

            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ==================== JSON FALLBACK METHODS ====================

    
    def _save_user_to_json(self, user_id, user_data):
        """Save user to JSON file"""
        users = self._load_users_from_json()
        users[user_id] = user_data
        self._save_users_to_json(users)
    
    def _load_users_from_json(self):
        """Load users from JSON file"""
        if os.path.exists(self.users_file):
            try:
                with open(self.users_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_users_to_json(self, users):
        """Save users to JSON file"""
        with open(self.users_file, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2, ensure_ascii=False)
    
    def _save_project_to_json(self, project_id, project_data):
        """Save project to JSON file"""
        projects = self._load_projects_from_json()
        projects[project_id] = project_data
        with open(self.projects_file, 'w', encoding='utf-8') as f:
            json.dump(projects, f, indent=2, ensure_ascii=False)
    
    def _load_projects_from_json(self):
        """Load projects from JSON file"""
        if os.path.exists(self.projects_file):
            try:
                with open(self.projects_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _delete_project_from_json(self, project_id):
        """Delete project from JSON file"""
        projects = self._load_projects_from_json()
        if project_id in projects:
            del projects[project_id]
            with open(self.projects_file, 'w', encoding='utf-8') as f:
                json.dump(projects, f, indent=2, ensure_ascii=False)
