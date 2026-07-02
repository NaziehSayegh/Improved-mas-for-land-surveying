import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * LicenseBadge — shows the current license status as a compact, animated badge.
 * Polls /api/license/status on mount and every `refreshInterval` ms.
 */
const LicenseBadge = ({ refreshInterval = 0, onClick, className = '' }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);

  const fetchStatus = async () => {
    try {
      const token = sessionStorage.getItem('sessionToken');
      const headers = {};
      if (token) {
        headers['X-Session-Token'] = token;
      }
      const res = await fetch('http://127.0.0.1:5000/api/license/status', { headers });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    if (refreshInterval > 0) {
      const id = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(id);
    }
  }, [refreshInterval]);

  const handleClick = () => {
    if (onClick) onClick(status);
    else navigate('/license');
  };

  if (checking) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
        bg-dark-700 border border-dark-600 text-dark-400 ${className}`}>
        <RefreshCw className="w-3 h-3 animate-spin" />
        Checking…
      </span>
    );
  }

  // ── Activated ────────────────────────────────────────────────
  if (status?.status === 'activated') {
    return (
      <span
        onClick={handleClick}
        title={`Licensed to: ${status.email || 'N/A'}`}
        className={`badge-licensed animate-badge-pulse cursor-pointer select-none ${className}`}
      >
        <CheckCircle className="w-3 h-3" />
        Licensed
      </span>
    );
  }

  // ── Trial ─────────────────────────────────────────────────────
  if (status?.status === 'trial') {
    return (
      <span
        onClick={handleClick}
        title={`${status.days_left} days remaining`}
        className={`badge-trial animate-warn-pulse cursor-pointer select-none ${className}`}
      >
        <Clock className="w-3 h-3" />
        Trial · {status.days_left}d
      </span>
    );
  }

  // ── No license / expired / error ──────────────────────────────
  return (
    <span
      onClick={handleClick}
      title="Click to activate"
      className={`badge-unlicensed animate-danger-pulse cursor-pointer select-none ${className}`}
    >
      <AlertTriangle className="w-3 h-3" />
      {status?.status === 'expired' ? 'Expired' : 'Unlicensed'}
    </span>
  );
};

export default LicenseBadge;
