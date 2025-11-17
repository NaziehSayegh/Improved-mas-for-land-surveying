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
  message = 'You have unsaved changes. What would you like to do?'
) => {
  
  // Handle browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, message]);

  // Function to check before navigating (call this instead of navigate directly)
  const navigateWithCheck = async (to, options = {}) => {
    if (hasUnsavedChanges) {
      const result = await showUnsavedChangesDialog(message);
      
      if (result === 'save') {
        if (onSave) {
          try {
            await onSave();
            navigate(to, options);
          } catch (error) {
            // User cancelled save or error occurred
            console.log('Save cancelled or failed:', error);
            // Don't navigate if save was cancelled
          }
        } else {
          // No save function, just navigate
          navigate(to, options);
        }
      } else if (result === 'discard') {
        if (onDiscard) {
          onDiscard();
        }
        navigate(to, options);
      }
      // If cancel, do nothing - stay on current page
    } else {
      navigate(to, options);
    }
  };

  // Handle ESC key (for going to main menu)
  const handleEscKey = async (targetPath = '/') => {
    if (hasUnsavedChanges) {
      const result = await showUnsavedChangesDialog(message);
      
      if (result === 'save') {
        if (onSave) {
          try {
            await onSave();
            navigate(targetPath); // Navigate to target (usually main menu)
          } catch (error) {
            console.log('Save cancelled');
          }
        } else {
          navigate(targetPath);
        }
      } else if (result === 'discard') {
        if (onDiscard) {
          onDiscard();
        }
        navigate(targetPath); // Navigate to target
      }
      // If cancel, do nothing - stay on current page
    } else {
      navigate(targetPath); // Navigate without asking
    }
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

