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

