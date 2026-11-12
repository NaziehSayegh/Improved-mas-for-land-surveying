"""Manual check that the backend's Python packages are installed. Run directly: python test_env.py"""
import sys


def main():
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


if __name__ == "__main__":
    main()
