import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Shield, CheckCircle, AlertTriangle, FolderOpen } from 'lucide-react';

/**
 * StatusBar — fixed bottom 1-line status bar.
 * Shows: version · license status · active project · backend connection.
 */
const StatusBar = ({ projectName }) => {
  const [backendOnline, setBackendOnline] = useState(null);
  const [licenseStatus, setLicenseStatus] = useState(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const token = sessionStorage.getItem('sessionToken');
        const headers = {};
        if (token) {
          headers['X-Session-Token'] = token;
        }
        const res = await fetch('http://127.0.0.1:5000/api/license/status', { 
          cache: 'no-store',
          headers
        });
        const data = await res.json();
        setBackendOnline(true);
        setLicenseStatus(data);
      } catch {
        setBackendOnline(false);
        setLicenseStatus(null);
      }
    };

    checkBackend();
    const id = setInterval(checkBackend, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  return (
    <div className="status-bar">
      {/* Version */}
      <span className="text-dark-500 font-mono">v2.0.6</span>

      <span className="text-dark-700">·</span>

      {/* License status */}
      {licenseStatus === null ? (
        <span className="flex items-center gap-1 text-dark-500">
          <Shield className="w-3 h-3" /> Checking…
        </span>
      ) : licenseStatus.status === 'activated' ? (
        <span className="flex items-center gap-1 text-green-500">
          <CheckCircle className="w-3 h-3" /> Licensed
        </span>
      ) : licenseStatus.status === 'trial' ? (
        <span className="flex items-center gap-1 text-yellow-500">
          <Shield className="w-3 h-3" /> Trial · {licenseStatus.days_left} days left
        </span>
      ) : (
        <span className="flex items-center gap-1 text-red-500">
          <AlertTriangle className="w-3 h-3" /> Unlicensed
        </span>
      )}

      <span className="text-dark-700">·</span>

      {/* Active project */}
      {projectName ? (
        <span className="flex items-center gap-1 text-primary/70">
          <FolderOpen className="w-3 h-3" /> {projectName}
        </span>
      ) : (
        <span className="text-dark-600">No project open</span>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Backend connection */}
      {backendOnline === null ? (
        <span className="text-dark-500 flex items-center gap-1">
          <span className="status-dot bg-dark-500 animate-pulse" /> Connecting…
        </span>
      ) : backendOnline ? (
        <span className="text-green-600 flex items-center gap-1">
          <span className="status-dot bg-green-500" /> Engine Online
        </span>
      ) : (
        <span className="text-red-500 flex items-center gap-1">
          <span className="status-dot bg-red-500" /> Engine Offline
        </span>
      )}

      <span className="text-dark-700">·</span>
      <span className="text-dark-600">© Nazieh Sayegh</span>
    </div>
  );
};

export default StatusBar;
