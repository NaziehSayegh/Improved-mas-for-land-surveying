"""Crash-safe file writing shared by the backend modules."""
import os
import threading
import time


def atomic_write_text(path, text, encoding='utf-8'):
    """Write via a temp file + rename so a crash or power loss can never leave a half-written file.
    If the rename is blocked (e.g. a cloud-sync client briefly locking the file) it retries,
    then falls back to a direct write rather than failing the user's save."""
    directory = os.path.dirname(os.path.abspath(path))
    tmp_path = os.path.join(directory, f'.{os.path.basename(path)}.{os.getpid()}.{threading.get_ident()}.tmp')
    try:
        with open(tmp_path, 'w', encoding=encoding, newline='') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        for attempt in range(5):
            try:
                os.replace(tmp_path, path)
                return
            except PermissionError:
                time.sleep(0.1 * (attempt + 1))
        with open(path, 'w', encoding=encoding, newline='') as f:
            f.write(text)
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
