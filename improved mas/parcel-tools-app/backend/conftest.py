"""Tests never talk to Firebase: the backend runs on its local JSON files unless a test injects fake servers."""
import os
os.environ.setdefault('PARCEL_TOOLS_OFFLINE', '1')
