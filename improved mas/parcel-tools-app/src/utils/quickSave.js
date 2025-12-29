/**
 * Quick Save As utility - can be called from anywhere in the app
 */

// Helper function to show toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.innerHTML = message;

  const colors = {
    success: 'linear-gradient(135deg, #22c55e, #16a34a)',
    error: 'linear-gradient(135deg, #ef4444, #dc2626)',
    warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
    info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
  };

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export async function handleQuickSaveAs() {
  try {
    // Check if Electron API is available
    if (!window.electronAPI || typeof window.electronAPI.showSaveDialog !== 'function') {
      showToast('⚠️ Save dialog not available. Please use the Parcel Calculator page to save projects.', 'warning');
      return false;
    }

    // Get current project state from context
    const projectContext = window.__PROJECT_CONTEXT__;
    if (!projectContext) {
      showToast('⚠️ No project data available. Please create a project first in the Parcel Calculator.', 'warning');
      return false;
    }

    const {
      projectName,
      savedParcels,
      loadedPoints,
      pointsFileName,
      pointsFilePath,
      fileHeading
    } = projectContext;

    // Generate default filename
    let defaultName = projectName || 'New_Project';
    if (defaultName === 'Untitled Project' || !defaultName) {
      const timestamp = new Date().toISOString().slice(0, 10);
      defaultName = `Project_${timestamp}`;
    }

    // Show save dialog
    const dialogResult = await window.electronAPI.showSaveDialog({
      title: 'Save Project As',
      defaultPath: `${defaultName}.prcl`,
      filters: [
        { name: 'Project Files', extensions: ['prcl'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (dialogResult.canceled) {
      return false;
    }

    if (dialogResult.error) {
      showToast('❌ Error opening save dialog: ' + dialogResult.error, 'error');
      return false;
    }

    let savePath = dialogResult.filePath;
    if (!savePath.toLowerCase().endsWith('.prcl')) {
      savePath += '.prcl';
    }

    // Extract project name from path
    const pathParts = savePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1];
    const newProjectName = fileName.replace('.prcl', '');

    // Build project data
    const projectData = {
      projectName: newProjectName,
      savedParcels: savedParcels || [],
      loadedPoints: loadedPoints || {},
      pointsFileName: pointsFileName || '',
      pointsFilePath: pointsFilePath || '',
      fileHeading: fileHeading || {
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      },
      lastModified: new Date().toISOString(),
      version: '2.0.0'
    };

    // Save via backend
    const response = await fetch('http://localhost:5000/api/project/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: newProjectName,
        projectData: projectData,
        filePath: savePath
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Save failed');
    }

    const result = await response.json();

    // Show success notification
    const toast = document.createElement('div');
    toast.innerHTML = `✅ Project saved successfully!<br><small>${result.filePath || savePath}</small>`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);

    return true;
  } catch (error) {
    console.error('Quick save error:', error);
    showToast(`❌ Error saving project: ${error.message}`, 'error');
    return false;
  }
}

