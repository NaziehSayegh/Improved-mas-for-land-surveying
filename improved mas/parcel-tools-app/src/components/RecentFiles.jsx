import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, MapPin, Clock, X, FolderOpen, Trash2 } from 'lucide-react';
import { getRecentFiles, clearRecentFiles } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';

const RecentFiles = () => {
  const navigate = useNavigate();
  const {
    setProjectName,
    setPointsFileName,
    setPointsFilePath,
    setLoadedPoints,
    setSavedParcels,
    setFileHeading,
    setHasUnsavedChanges
  } = useProject();
  const [recentFiles, setRecentFiles] = useState({ projects: [], points: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' or 'points'

  useEffect(() => {
    loadRecentFiles();
  }, []);

  const loadRecentFiles = async () => {
    try {
      setLoading(true);
      const data = await getRecentFiles();
      
      // Filter out files that no longer exist
      const filteredProjects = (data.projects || []).filter(file => {
        // For recent files, we can't directly check file existence in browser,
        // but the backend should have cleaned them up. We'll show all that come from API.
        // The backend cleanup will handle removing non-existent files.
        return true; // Trust backend has cleaned up
      });
      
      const filteredPoints = (data.points || []).filter(file => {
        return true; // Trust backend has cleaned up
      });
      
      setRecentFiles({
        projects: filteredProjects,
        points: filteredPoints
      });
    } catch (error) {
      console.error('Error loading recent files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async (file) => {
    try {
      // Load the project file
      const response = await fetch('http://localhost:5000/api/project/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.path }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404 || errorData.error?.includes('not found')) {
          // File was deleted - refresh recent files to remove it
          loadRecentFiles();
          alert('❌ Project file not found. It may have been deleted. Refreshing list...');
          return;
        }
        throw new Error('Failed to load project');
      }

      const result = await response.json();
      const projectData = result.projectData;

      // IMPORTANT: Clear ALL current state FIRST to ensure complete isolation
      setProjectName('');
      setPointsFileName('');
      setPointsFilePath('');
      setLoadedPoints({});
      setSavedParcels([]);
      setFileHeading({
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      });
      setHasUnsavedChanges(false);

      // Now load the NEW project's data - completely replace everything
      setProjectName(projectData.projectName || '');
      setPointsFileName(projectData.pointsFileName || '');
      setPointsFilePath(projectData.pointsFilePath || '');
      setLoadedPoints(projectData.loadedPoints || {});
      setSavedParcels(projectData.savedParcels || []);
      setFileHeading(projectData.fileHeading || {
        block: '', quarter: '', parcels: '', place: '', additionalInfo: ''
      });
      setHasUnsavedChanges(false);

      // Navigate to calculator
      navigate('/parcel-calculator');
      
      // Refresh recent files list
      loadRecentFiles();
    } catch (error) {
      console.error('Error opening project:', error);
      alert('Error opening project: ' + error.message);
    }
  };

  const handleOpenPoints = async (file) => {
    try {
      // Reload points from file
      const response = await fetch('http://localhost:5000/api/reload-points-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.path }),
      });

      if (!response.ok) {
        throw new Error('Failed to load points file');
      }

      const result = await response.json();
      
      // Convert points array to object format for context
      const pointsObj = {};
      result.points.forEach(p => {
        pointsObj[p.id] = { x: p.x, y: p.y };
      });
      
      // Update context
      setPointsFilePath(file.path);
      setPointsFileName(file.name);
      setLoadedPoints(pointsObj);
      
      alert(`Loaded ${result.count} points from ${file.name}`);
      
      // Navigate to data files
      navigate('/data-files');
      
      // Refresh recent files list
      loadRecentFiles();
    } catch (error) {
      console.error('Error opening points file:', error);
      alert('Error opening points file: ' + error.message);
    }
  };

  const handleClear = async (type = null) => {
    if (!confirm(`Clear all recent ${type || 'files'}?`)) return;

    try {
      await clearRecentFiles(type);
      loadRecentFiles();
    } catch (error) {
      console.error('Error clearing recent files:', error);
      alert('Error clearing recent files');
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const files = activeTab === 'projects' ? recentFiles.projects : recentFiles.points;
  const maxDisplay = 10;

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-dark-50">Recent Files</h2>
        </div>
        {files.length > 0 && (
          <button
            onClick={() => handleClear(activeTab)}
            className="px-3 py-1 text-sm text-dark-400 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Clear {activeTab}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'projects'
              ? 'text-primary border-b-2 border-primary'
              : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Projects ({recentFiles.projects.length})
        </button>
        <button
          onClick={() => setActiveTab('points')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'points'
              ? 'text-primary border-b-2 border-primary'
              : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          Points ({recentFiles.points.length})
        </button>
      </div>

      {/* File List */}
      {loading ? (
        <div className="text-center py-8 text-dark-400">Loading...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-dark-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No recent {activeTab} files</p>
          <p className="text-sm mt-1">Files you open will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.slice(0, maxDisplay).map((file, index) => (
            <motion.div
              key={file.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-dark-700/60 border border-dark-600 rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => activeTab === 'projects' ? handleOpenProject(file) : handleOpenPoints(file)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {activeTab === 'projects' ? (
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-dark-50 truncate">{file.name}</span>
                  </div>
                  
                  {/* Metadata */}
                  {file.metadata && (
                    <div className="text-xs text-dark-400 ml-6 space-y-0.5">
                      {activeTab === 'projects' && file.metadata.projectName && (
                        <div>Project: {file.metadata.projectName}</div>
                      )}
                      {file.metadata.parcelCount !== undefined && (
                        <div>Parcels: {file.metadata.parcelCount}</div>
                      )}
                      {(file.metadata.pointsCount !== undefined) && (
                        <div>Points: {file.metadata.pointsCount}</div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-2 ml-6">
                    <div className="flex items-center gap-1 text-xs text-dark-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(file.lastAccessed)}
                    </div>
                    <div className="text-xs text-dark-600 truncate">{file.path}</div>
                  </div>
                </div>
                
                <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </div>
              </div>
            </motion.div>
          ))}
          
          {files.length > maxDisplay && (
            <div className="text-center text-sm text-dark-500 pt-2">
              ... and {files.length - maxDisplay} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentFiles;

