"""Shared test setup. pytest loads this file before any test file, so it runs before the backend is imported.

1. Tests never talk to Firebase: the backend runs on its local JSON files unless a test injects fake servers.
2. Tests never touch real data: the backend keeps its files (users, recent projects, settings) in a
   throwaway folder instead of backend/data or the user's profile.
"""
import os
import tempfile

os.environ.setdefault('PARCEL_TOOLS_OFFLINE', '1')

_sandbox = tempfile.mkdtemp(prefix='parceltools-tests-')
os.environ['HOME'] = _sandbox
os.environ['LOCALAPPDATA'] = _sandbox
os.environ['PORTABLE_EXECUTABLE_DIR'] = '1'  # makes the backend use the folders above, as the packaged app does
