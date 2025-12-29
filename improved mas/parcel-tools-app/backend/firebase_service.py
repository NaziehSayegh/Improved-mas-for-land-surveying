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
    
    def create_user(self, email, password, license_key):
        """
        Create a new user with Firebase Authentication
        Returns: {'success': bool, 'user_id': str, 'error': str}
        """
        try:
            if self._is_online():
                from firebase_config import get_firebase_auth
                auth = get_firebase_auth()
                
                # Create user in Firebase Auth
                user = auth.create_user(
                    email=email,
                    password=password
                )
                
                # Create user document in Firestore
                user_data = {
                    'email': email,
                    'license_key': license_key,
                    'created_at': datetime.now().isoformat(),
                    'last_login': datetime.now().isoformat()
                }
                
                self.db.collection('users').document(user.uid).set(user_data)
                
                # Save to JSON fallback
                self._save_user_to_json(user.uid, user_data)
                
                return {
                    'success': True,
                    'user_id': user.uid,
                    'message': 'User created successfully'
                }
            else:
                # Offline mode - save to JSON only
                import uuid
                user_id = str(uuid.uuid4())
                user_data = {
                    'email': email,
                    'license_key': license_key,
                    'created_at': datetime.now().isoformat(),
                    'last_login': datetime.now().isoformat()
                }
                self._save_user_to_json(user_id, user_data)
                
                return {
                    'success': True,
                    'user_id': user_id,
                    'message': 'User created in offline mode'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
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
    
    def get_user(self, user_id):
        """Get user data"""
        try:
            if self._is_online():
                doc = self.db.collection('users').document(user_id).get()
                if doc.exists:
                    return doc.to_dict()
            
            # Fallback to JSON
            users = self._load_users_from_json()
            return users.get(user_id)
            
        except Exception as e:
            print(f"[Firebase Service] Error getting user: {e}")
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
            if self._is_online():
                self.db.collection('users').document(user_id).update({
                    'license': license_data,
                    'license_updated_at': datetime.now().isoformat()
                })
            
            # Save to JSON
            users = self._load_users_from_json()
            if user_id in users:
                users[user_id]['license'] = license_data
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
    
    def add_device(self, user_id, machine_id, device_name="Unknown Device"):
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
                devices = user_data.get('devices', {})
                
                # Check if device already exists
                for device_id, device_info in devices.items():
                    if device_info.get('machine_id') == machine_id:
                        # Update last_seen
                        user_ref.update({
                            f'devices.{device_id}.last_seen': datetime.now().isoformat()
                        })
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
                
                devices = users[user_id].get('devices', {})
                
                # Check if device exists
                for device_id, device_info in devices.items():
                    if device_info.get('machine_id') == machine_id:
                        devices[device_id]['last_seen'] = datetime.now().isoformat()
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
                devices = user_data.get('devices', {})
                
                # Find and remove device
                device_to_remove = None
                for device_id, device_info in devices.items():
                    if device_info.get('machine_id') == machine_id:
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
                
                devices = users[user_id].get('devices', {})
                device_to_remove = None
                
                for device_id, device_info in devices.items():
                    if device_info.get('machine_id') == machine_id:
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
