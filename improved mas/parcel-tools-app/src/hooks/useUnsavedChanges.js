import { useEffect } from 'react';

/**
 * Hook to prevent navigation when there are unsaved changes
 * Shows a dialog asking the user to save, discard, or cancel
 * 
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {Function} onSave - Function to call to save (should return a Promise)
 * @param {Function} navigate - React Router navigate function
 * @param {Function} onDiscard - Optional callback when user discards changes
 * @param {string} message - Custom message to show
 */
export const useUnsavedChanges = (
  hasUnsavedChanges, 
  onSave, 
  navigate, 
  onDiscard = null,
  message = ''
) => {
  
  // Handle browser close/refresh — auto-save in background
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges && onSave) {
        try {
          onSave();
        } catch (err) {
          console.warn('Auto-save on beforeunload:', err);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, onSave]);

  // Seamless navigation: auto-save immediately in background without blocking popups
  const navigateWithCheck = async (to, options = {}) => {
    if (hasUnsavedChanges && onSave) {
      try {
        await onSave();
      } catch (error) {
        console.warn('Background auto-save before navigation:', error);
      }
    }
    navigate(to, options);
  };

  // Handle ESC key: auto-save and navigate smoothly to target
  const handleEscKey = async (targetPath = '/') => {
    if (hasUnsavedChanges && onSave) {
      try {
        await onSave();
      } catch (error) {
        console.warn('Background auto-save before ESC navigation:', error);
      }
    }
    navigate(targetPath);
  };

  return { navigateWithCheck, handleEscKey };
};

/**
 * Show a custom unsaved changes dialog
 * Returns 'save', 'discard', or 'cancel'
 */
const showUnsavedChangesDialog = (message) => {
  return new Promise((resolve) => {
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create dialog box
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    dialog.innerHTML = `
      <h2 style="color: #c9d1d9; font-size: 20px; font-weight: bold; margin-bottom: 12px;">
        ⚠️ Unsaved Changes
      </h2>
      <p style="color: #8b949e; margin-bottom: 24px; line-height: 1.5;">
        ${message}
      </p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="unsaved-cancel" style="
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        ">Cancel</button>
        <button id="unsaved-discard" style="
          background: #da3633;
          border: 1px solid #da3633;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        ">Discard</button>
        <button id="unsaved-save" style="
          background: #238636;
          border: 1px solid #238636;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        ">Save</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Button handlers
    const handleResult = (result) => {
      document.body.removeChild(overlay);
      resolve(result);
    };

    document.getElementById('unsaved-save').onclick = () => handleResult('save');
    document.getElementById('unsaved-discard').onclick = () => handleResult('discard');
    document.getElementById('unsaved-cancel').onclick = () => handleResult('cancel');

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        handleResult('cancel');
      }
    };

    // Close on Escape key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleResult('cancel');
        window.removeEventListener('keydown', handleEsc);
      }
    };
    window.addEventListener('keydown', handleEsc);
  });
};

