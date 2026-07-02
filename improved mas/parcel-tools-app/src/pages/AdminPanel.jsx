import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, RefreshCw, ShieldCheck, ShieldX, Clock, Cpu,
  Crown, Zap, CheckCircle, XCircle, AlertTriangle, Search,
  RotateCcw, TrendingUp, LogOut, Shield, ShieldAlert,
  Lock, Unlock, Key, Calendar, Monitor, User, UserCheck,
  UserX, ChevronRight, X, Check, Activity, Laptop
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api';

// ── Badge Component ─────────────────────────────────────────────────────────
const Badge = ({ children, color }) => {
  const colors = {
    green:  'bg-green-950/50 text-green-400 border-green-700/40',
    red:    'bg-red-950/50 text-red-400 border-red-700/40',
    amber:  'bg-amber-950/50 text-amber-400 border-amber-700/40',
    blue:   'bg-blue-950/50 text-blue-400 border-blue-700/40',
    purple: 'bg-purple-950/50 text-purple-400 border-purple-700/40',
    gray:   'bg-dark-800 text-dark-400 border-dark-700/40',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
};

// ── Action Button Component ──────────────────────────────────────────────────
const ActionButton = ({ onClick, children, color = 'default', disabled, title }) => {
  const colors = {
    default: 'bg-dark-700 hover:bg-dark-600 text-dark-200 border-dark-600',
    green:   'bg-green-900/30 hover:bg-green-800/50 text-green-400 border-green-800/40',
    red:     'bg-red-900/30 hover:bg-red-800/50 text-red-400 border-red-800/40',
    amber:   'bg-amber-900/30 hover:bg-amber-800/50 text-amber-400 border-amber-800/40',
    purple:  'bg-purple-900/30 hover:bg-purple-800/50 text-purple-400 border-purple-800/40',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border
                  transition-all duration-200 shadow-sm
                  disabled:opacity-40 disabled:cursor-not-allowed ${colors[color] || colors.default}`}
    >
      {children}
    </button>
  );
};

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterType, setFilterType]     = useState('all');    // 'all' | 'demo' | 'premium'
  const [filterStatus, setFilterStatus] = useState('all');  // 'all' | 'active' | 'expired' | 'blocked'
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // null | 'block' | 'unblock' | 'deactivate' | 'reset-pc' | 'upgrade' | 'extend'
  const [toast, setToast]               = useState(null);
  const [busy, setBusy]                 = useState({});             // uid → true while action in flight

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        // Update selected user reference if open to display updated data
        if (selectedUser) {
          const updated = data.users.find(u => u.uid === selectedUser.uid);
          if (updated) setSelectedUser(updated);
        }
      }
      else showToast(data.error || 'Failed to load users', 'error');
    } catch {
      showToast('Connection error', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedUser]);

  useEffect(() => { fetchUsers(); }, []);

  const handleAction = async (uid, path, body, successMsg) => {
    setBusy(b => ({ ...b, [uid]: true }));
    setConfirmAction(null);
    try {
      const res  = await apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (data.success) {
        showToast(successMsg);
        await fetchUsers();
      } else {
        showToast(data.error || 'Action failed', 'error');
      }
    } catch {
      showToast('Connection error', 'error');
    } finally {
      setBusy(b => ({ ...b, [uid]: false }));
    }
  };

  // Filter and search logic
  const filteredUsers = users.filter(u => {
    // 1. Account Type filter
    if (filterType === 'demo' && u.account_type !== 'demo') return false;
    if (filterType === 'premium' && u.account_type !== 'premium') return false;

    // 2. Status filter
    const isBlocked = u.is_active === false;
    const daysLeft = u.trial_days_left;
    const isExpired = u.account_type === 'demo' && typeof daysLeft === 'number' && daysLeft <= 0;

    if (filterStatus === 'blocked' && !isBlocked) return false;
    if (filterStatus === 'expired' && (!isExpired || isBlocked)) return false;
    if (filterStatus === 'active' && (isBlocked || isExpired)) return false;

    // 3. Search filter (email, machine, license key)
    if (search) {
      const q = search.toLowerCase();
      const emailMatch = u.email?.toLowerCase().includes(q);
      const licenseMatch = u.license_key?.toLowerCase().includes(q);
      
      let machineMatch = false;
      if (u.devices) {
        machineMatch = Object.values(u.devices).some(dev => 
          (dev.computer_name || '').toLowerCase().includes(q) || 
          (dev.device_name || '').toLowerCase().includes(q) ||
          (dev.os_user || '').toLowerCase().includes(q)
        );
      }
      if (!emailMatch && !licenseMatch && !machineMatch) return false;
    }
    return true;
  });

  // Calculate statistics
  const stats = {
    total: users.length,
    premium: users.filter(u => u.account_type === 'premium').length,
    activeTrial: users.filter(u => u.account_type === 'demo' && (u.trial_days_left || 0) > 0 && u.is_active !== false).length,
    expiredTrial: users.filter(u => u.account_type === 'demo' && (u.trial_days_left || 0) <= 0 && u.is_active !== false).length,
    blocked: users.filter(u => u.is_active === false).length,
    devices: users.reduce((acc, u) => {
      if (u.devices && typeof u.devices === 'object') {
        return acc + Object.keys(u.devices).length;
      }
      return acc;
    }, 0)
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="page-container relative flex flex-col h-screen overflow-hidden bg-dark-950">
      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl flex items-center gap-3 border
              ${toast.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-700' : 'bg-green-950/90 text-green-200 border-green-700'}`}
          >
            {toast.type === 'error' ? <XCircle className="w-5 h-5 text-red-400" /> : <CheckCircle className="w-5 h-5 text-green-400" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden max-w-7xl mx-auto w-full p-6">
        
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-extrabold gradient-text flex items-center gap-2.5">
              <Shield className="w-8 h-8 text-primary shadow-glow" />
              CRM License Dashboard
            </h1>
            <p className="text-dark-400 text-sm mt-1.5 flex items-center gap-2">
              <span>Monitor users, manage licenses, and verify active hardware.</span>
              <span className="w-1.5 h-1.5 rounded-full bg-dark-600"></span>
              <span>Logged in as: <strong className="text-dark-200">{user?.email}</strong></span>
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchUsers} 
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-dark-700 bg-dark-800/40 hover:bg-dark-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button 
              onClick={() => navigate('/')} 
              className="btn-secondary flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-dark-700 bg-dark-800/40 hover:bg-dark-800"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* ── Statistics Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6 flex-shrink-0">
          {[
            { label: 'Total Accounts', value: stats.total, icon: <Users className="w-5 h-5" />, color: 'text-primary border-primary/20 bg-primary/5' },
            { label: 'Premium (Paid)', value: stats.premium, icon: <Crown className="w-5 h-5" />, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' },
            { label: 'Active Trials', value: stats.activeTrial, icon: <Zap className="w-5 h-5" />, color: 'text-green-400 border-green-500/20 bg-green-500/5' },
            { label: 'Expired Trials', value: stats.expiredTrial, icon: <Clock className="w-5 h-5" />, color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' },
            { label: 'Blocked Accounts', value: stats.blocked, icon: <ShieldX className="w-5 h-5" />, color: 'text-red-400 border-red-500/20 bg-red-500/5' },
            { label: 'Connected PCs', value: stats.devices, icon: <Laptop className="w-5 h-5" />, color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' },
          ].map(s => (
            <div key={s.label} className={`glass rounded-2xl p-4 flex flex-col justify-between border ${s.color} transition-all duration-300 hover:scale-[1.02]`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-dark-400">{s.label}</span>
                <span>{s.icon}</span>
              </div>
              <div className="text-2xl font-black tracking-tight text-dark-100">{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Filters & Search Panel ── */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 flex-shrink-0 items-center justify-between bg-dark-900/40 p-4 rounded-2xl border border-dark-800">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search email, key, PC hostname..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-10 text-sm w-full bg-dark-950/60 border-dark-800 focus:border-primary/60 rounded-xl py-2"
            />
          </div>
          
          <div className="flex flex-wrap gap-4 w-full md:w-auto justify-end">
            {/* Account Type Filter */}
            <div className="flex items-center gap-1.5 bg-dark-950/60 border border-dark-800 rounded-xl p-1">
              {['all', 'demo', 'premium'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all duration-200
                    ${filterType === f ? 'bg-primary text-white shadow-glow' : 'text-dark-400 hover:text-dark-200'}`}
                >
                  {f === 'all' ? 'All Plans' : f}
                </button>
              ))}
            </div>

            {/* Account Status Filter */}
            <div className="flex items-center gap-1.5 bg-dark-950/60 border border-dark-800 rounded-xl p-1">
              {['all', 'active', 'expired', 'blocked'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all duration-200
                    ${filterStatus === f ? 'bg-primary text-white shadow-glow' : 'text-dark-400 hover:text-dark-200'}`}
                >
                  {f === 'all' ? 'All Status' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Users Table ── */}
        <div className="flex-1 glass border border-dark-800 rounded-2xl overflow-hidden flex flex-col shadow-inner">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-400">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Fetching accounts database...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-500 py-16">
              <Users className="w-10 h-10 text-dark-600" />
              <span className="text-sm font-medium">No customer accounts match filters</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scroll-area">
              <table className="w-full text-left border-collapse">
                <thead className="bg-dark-900/80 border-b border-dark-800 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">User Account</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">Access Plan</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">Trial Progress</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">Connected Computer</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">Account Status</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400">Last Seen</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-dark-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/40">
                  {filteredUsers.map((u, i) => {
                    const isBusy = busy[u.uid];
                    const daysLeft = u.trial_days_left;
                    const isExpired = u.account_type === 'demo' && typeof daysLeft === 'number' && daysLeft <= 0;
                    const isBlocked = u.is_active === false;

                    // Get primary device name
                    let computerName = '—';
                    if (u.devices && Object.keys(u.devices).length > 0) {
                      const primaryDev = Object.values(u.devices)[0];
                      computerName = primaryDev.computer_name || primaryDev.device_name || 'Windows PC';
                    }

                    return (
                      <motion.tr
                        key={u.uid}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        onClick={() => setSelectedUser(u)}
                        className={`hover:bg-dark-800/20 transition-colors duration-150 cursor-pointer group
                          ${selectedUser?.uid === u.uid ? 'bg-dark-800/40' : ''}`}
                      >
                        {/* User email */}
                        <td className="px-6 py-4 font-semibold text-dark-100 max-w-[200px] truncate">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-dark-800 border border-dark-700/50 flex items-center justify-center font-bold text-xs text-primary group-hover:border-primary/40 transition-colors">
                              {u.email ? u.email.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="truncate group-hover:text-primary transition-colors">{u.email}</span>
                              {u.is_admin && (
                                <span className="text-[10px] text-purple-400 flex items-center gap-1 font-bold mt-0.5">
                                  <Shield className="w-2.5 h-2.5" /> Staff Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-6 py-4">
                          {u.account_type === 'premium' ? (
                            <Badge color="amber"><Crown className="w-3.5 h-3.5" /> Premium</Badge>
                          ) : (
                            <Badge color="blue"><Zap className="w-3.5 h-3.5" /> Demo</Badge>
                          )}
                        </td>

                        {/* Trial status */}
                        <td className="px-6 py-4 text-sm">
                          {u.account_type === 'premium' ? (
                            <span className="text-dark-500 text-xs">N/A (Paid)</span>
                          ) : isExpired ? (
                            <Badge color="red"><XCircle className="w-3 h-3" /> Expired</Badge>
                          ) : (
                            <div className="flex flex-col gap-1 w-28">
                              <div className="flex justify-between text-[11px] font-semibold text-dark-300">
                                <span>{daysLeft || 0}d left</span>
                                <span>{Math.round(((daysLeft || 0) / 30) * 100)}%</span>
                              </div>
                              <div className="w-full bg-dark-800 rounded-full h-1.5 overflow-hidden border border-dark-700/40">
                                <div 
                                  className={`h-full rounded-full ${(daysLeft || 0) <= 5 ? 'bg-amber-500' : 'bg-green-500'}`}
                                  style={{ width: `${(Math.min(30, daysLeft || 0) / 30) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Connected PC */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-dark-500 flex-shrink-0" />
                            <span className="text-xs text-dark-300 font-mono max-w-[150px] truncate" title={computerName}>
                              {computerName}
                            </span>
                            {u.devices && Object.keys(u.devices).length > 1 && (
                              <span className="text-[10px] font-bold bg-dark-700 border border-dark-600 px-1.5 py-0.2 rounded text-dark-300">
                                +{Object.keys(u.devices).length - 1}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Account Status */}
                        <td className="px-6 py-4">
                          {isBlocked ? (
                            <Badge color="red"><ShieldX className="w-3.5 h-3.5" /> Suspended</Badge>
                          ) : isExpired ? (
                            <Badge color="amber"><Clock className="w-3.5 h-3.5" /> Expired Trial</Badge>
                          ) : (
                            <Badge color="green"><CheckCircle className="w-3.5 h-3.5" /> Active</Badge>
                          )}
                        </td>

                        {/* Last Seen */}
                        <td className="px-6 py-4 text-xs text-dark-400 font-medium">
                          {u.last_login ? formatDate(u.last_login).split(',')[0] : 'Never'}
                        </td>

                        {/* Actions shortcuts */}
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="p-1.5 bg-dark-800 hover:bg-dark-700 text-dark-300 rounded-lg hover:text-primary transition-colors border border-dark-700/50"
                              title="Inspect Account Details"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-6 py-3 bg-dark-900/60 border-t border-dark-800 flex items-center justify-between text-xs text-dark-500 flex-shrink-0">
            <span>Showing {filteredUsers.length} of {users.length} registered accounts</span>
            <span>Parcel Tools CRM v2.0</span>
          </div>
        </div>
      </div>

      {/* ── Detailed Inspector Side Drawer ── */}
      <AnimatePresence>
        {selectedUser && (
          <>
            {/* Drawer Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedUser(null); setConfirmAction(null); }}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />
            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute top-0 right-0 h-full w-full max-w-md bg-dark-900 border-l border-dark-800 shadow-2xl z-50 flex flex-col text-dark-100"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-dark-800 bg-dark-950/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-dark-100 text-sm max-w-[240px] truncate" title={selectedUser.email}>
                      {selectedUser.email}
                    </h3>
                    <p className="text-xs text-dark-400 mt-0.5">UID: {selectedUser.uid.substring(0, 12)}...</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedUser(null); setConfirmAction(null); }}
                  className="p-1.5 hover:bg-dark-800 text-dark-400 hover:text-dark-200 rounded-lg transition-colors border border-transparent hover:border-dark-700/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-area">
                
                {/* ── Section: Account Status Summary ── */}
                <div className="bg-dark-950/30 border border-dark-800/80 rounded-2xl p-4 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-dark-400 font-semibold uppercase tracking-wider">Account Plan</span>
                    {selectedUser.account_type === 'premium' ? (
                      <Badge color="amber"><Crown className="w-3.5 h-3.5" /> Premium (Paid)</Badge>
                    ) : (
                      <Badge color="blue"><Zap className="w-3.5 h-3.5" /> Demo (Trial)</Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-dark-400 font-semibold uppercase tracking-wider">System Status</span>
                    {selectedUser.is_active === false ? (
                      <Badge color="red"><ShieldX className="w-3.5 h-3.5" /> Suspended</Badge>
                    ) : (
                      <Badge color="green"><CheckCircle className="w-3.5 h-3.5" /> Active Access</Badge>
                    )}
                  </div>
                  <div className="h-[1px] bg-dark-800/50 my-1"></div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-dark-500 font-medium">Registered</div>
                      <div className="text-dark-200 mt-1 font-semibold">{formatDate(selectedUser.created_at).split(',')[0]}</div>
                    </div>
                    <div>
                      <div className="text-dark-500 font-medium">Last Login</div>
                      <div className="text-dark-200 mt-1 font-semibold">{selectedUser.last_login ? formatDate(selectedUser.last_login) : 'Never'}</div>
                    </div>
                  </div>
                  <div className="h-[1px] bg-dark-800/50 my-1"></div>
                  <div className="text-xs">
                    <div className="text-dark-500 font-medium">Primary Bound PC Hash</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-dark-200 font-mono text-[11px] truncate select-all bg-dark-950/80 px-2 py-1 rounded border border-dark-800 flex-1">
                        {selectedUser.machine_id_hash || 'No binding yet'}
                      </span>
                      {selectedUser.machine_id_hash && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedUser.machine_id_hash);
                            showToast('Copied PC Bound Hash!');
                          }}
                          className="px-2 py-1 rounded bg-dark-800 hover:bg-dark-700 text-[10px] text-dark-300 border border-dark-700 font-semibold"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Section: Registered Hardware / Connected Computers ── */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-purple-400" />
                    Connected Computers ({selectedUser.devices ? Object.keys(selectedUser.devices).length : 0})
                  </h4>
                  
                  <div className="space-y-3">
                    {selectedUser.devices && Object.keys(selectedUser.devices).length > 0 ? (
                      Object.entries(selectedUser.devices).map(([devId, dev]) => (
                        <div key={devId} className="bg-dark-950/30 border border-dark-800 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-primary" />
                              <span className="font-mono text-xs font-bold text-dark-200">
                                {dev.computer_name || dev.device_name || 'Windows PC'}
                              </span>
                            </div>
                            <span className="text-[10px] bg-dark-800 px-2 py-0.5 rounded border border-dark-700/50 text-dark-400 font-semibold uppercase">
                              Active PC
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-dark-400 pt-1">
                            <div>
                              <span className="text-dark-500">OS User: </span>
                              <strong className="text-dark-300 font-mono">{dev.os_user || 'Unknown'}</strong>
                            </div>
                            <div>
                              <span className="text-dark-500">OS Build: </span>
                              <strong className="text-dark-300 font-mono">{dev.os_platform || 'Windows'}</strong>
                            </div>
                          </div>
                          
                          {dev.machine_id && (
                            <div className="text-[11px] text-dark-400 pt-1">
                              <span className="text-dark-500">Machine ID: </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-dark-300 text-[10px] select-all bg-dark-900 px-1.5 py-0.5 rounded border border-dark-800 flex-1 truncate">
                                  {dev.machine_id}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(dev.machine_id);
                                    showToast('Copied Machine ID!');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-dark-800 hover:bg-dark-700 text-[9px] text-dark-400 border border-dark-700/50 font-semibold"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <div className="text-[10px] text-dark-500 flex justify-between border-t border-dark-800/50 pt-2 mt-2">
                            <span>Bound: {formatDate(dev.activated_at).split(',')[0]}</span>
                            <span>Seen: {formatDate(dev.last_seen)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 border border-dashed border-dark-800 rounded-xl text-dark-500 text-xs">
                        No computers bound to this account.
                      </div>
                    )}
                    
                    {selectedUser.machine_id_hash && (
                      <div className="pt-1.5">
                        {confirmAction === 'reset-pc' ? (
                          <div className="bg-amber-950/40 border border-amber-900 rounded-xl p-3 space-y-3">
                            <p className="text-xs text-amber-300 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>Resetting PC binding allows user login from a new computer, but clears their active session logs. Continue?</span>
                            </p>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setConfirmAction(null)}
                                className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleAction(
                                  selectedUser.uid, 
                                  `/api/admin/users/${selectedUser.uid}/reset-machine`, 
                                  null, 
                                  `Machine reset for ${selectedUser.email}`
                                )}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs text-white"
                              >
                                Yes, Reset PC
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ActionButton
                            color="amber"
                            disabled={busy[selectedUser.uid]}
                            onClick={() => setConfirmAction('reset-pc')}
                            title="De-authorize current computer binding"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Computer Binding
                          </ActionButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Section: Subscriptions & Trials ── */}
                {selectedUser.account_type === 'demo' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Trial Status & Expiration
                    </h4>
                    
                    <div className="bg-dark-950/30 border border-dark-800 rounded-2xl p-4 space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dark-400 font-medium">Trial Start Date</span>
                        <span className="text-dark-200 font-semibold">{formatDate(selectedUser.trial_start).split(',')[0]}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dark-400 font-medium">Trial Expiration</span>
                        <span className="text-dark-200 font-semibold">{formatDate(selectedUser.trial_expires_at).split(',')[0]}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-dark-400">
                          <span>Progress Duration</span>
                          <span className="font-semibold text-dark-200">
                            {(selectedUser.trial_days_left || 0) <= 0 ? 'Trial Expired' : `${selectedUser.trial_days_left} Days Remaining`}
                          </span>
                        </div>
                        <div className="w-full bg-dark-950 border border-dark-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${(selectedUser.trial_days_left || 0) <= 5 ? 'bg-amber-500' : 'bg-primary'}`}
                            style={{ width: `${(Math.min(30, selectedUser.trial_days_left || 0) / 30) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5 pt-2">
                        {confirmAction === 'extend' ? (
                          <div className="w-full bg-green-950/40 border border-green-900 rounded-xl p-3 space-y-3 text-left">
                            <p className="text-xs text-green-300 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>Reset this user's trial start date to today? This adds +30 days.</span>
                            </p>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setConfirmAction(null)}
                                className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleAction(
                                  selectedUser.uid, 
                                  `/api/admin/users/${selectedUser.uid}/extend-trial`, 
                                  null, 
                                  `Trial extended for ${selectedUser.email}`
                                )}
                                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs text-white"
                              >
                                Reset (+30 Days)
                              </button>
                            </div>
                          </div>
                        ) : confirmAction === 'upgrade' ? (
                          <div className="w-full bg-purple-950/40 border border-purple-900 rounded-xl p-3 space-y-3 text-left">
                            <p className="text-xs text-purple-300 flex items-start gap-2">
                              <Crown className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                              <span>Upgrade this account to Premium? This grants immediate full access.</span>
                            </p>
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setConfirmAction(null)}
                                className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleAction(
                                  selectedUser.uid, 
                                  `/api/admin/users/${selectedUser.uid}/upgrade-premium`, 
                                  null, 
                                  `Upgraded ${selectedUser.email} to Premium`
                                )}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs text-white"
                              >
                                Upgrade Account
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ActionButton
                              color="green"
                              disabled={busy[selectedUser.uid]}
                              onClick={() => setConfirmAction('extend')}
                              title="Extend the demo trial by another 30 days"
                            >
                              <Clock className="w-3.5 h-3.5" /> Extend Trial (+30d)
                            </ActionButton>

                            <ActionButton
                              color="purple"
                              disabled={busy[selectedUser.uid]}
                              onClick={() => setConfirmAction('upgrade')}
                              title="Upgrade user directly to Premium version"
                            >
                              <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Upgrade to Premium
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Section: License Key details (Premium accounts) ── */}
                {selectedUser.account_type === 'premium' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-400" />
                      Premium License Manager
                    </h4>
                    
                    <div className="bg-dark-950/30 border border-dark-800 rounded-2xl p-4 space-y-4">
                      <div className="space-y-1">
                        <span className="text-xs text-dark-500">License Key</span>
                        <div className="bg-dark-950/80 border border-dark-800 p-2.5 rounded-xl font-mono text-xs text-dark-200 select-all flex items-center justify-between">
                          <span className="truncate pr-2">{selectedUser.license_key || 'Granted by Admin (No key)'}</span>
                          <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        </div>
                      </div>

                      {confirmAction === 'deactivate' ? (
                        <div className="bg-red-950/40 border border-red-900 rounded-xl p-3 space-y-3">
                          <p className="text-xs text-red-300 flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                            <span>Are you sure you want to deactivate this license? The user will be demoted back to a demo/trial account.</span>
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setConfirmAction(null)}
                              className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleAction(
                                selectedUser.uid, 
                                `/api/admin/users/${selectedUser.uid}/deactivate-license`, 
                                null, 
                                `Deactivated license for ${selectedUser.email}`
                              )}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white"
                            >
                              Yes, Deactivate License
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ActionButton
                          color="red"
                          disabled={busy[selectedUser.uid]}
                          onClick={() => setConfirmAction('deactivate')}
                          title="Revoke premium access key"
                        >
                          <ShieldX className="w-3.5 h-3.5" /> Deactivate Premium License
                        </ActionButton>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Section: Security & Access Blocks ── */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    Administrative Controls
                  </h4>
                  
                  <div className="bg-dark-950/30 border border-dark-800 rounded-2xl p-4">
                    {selectedUser.is_admin ? (
                      <p className="text-xs text-dark-500 italic">
                        Administrative accounts cannot be blocked from this interface.
                      </p>
                    ) : selectedUser.is_active !== false ? (
                      confirmAction === 'block' ? (
                        <div className="bg-red-950/40 border border-red-900 rounded-xl p-3 space-y-3">
                          <p className="text-xs text-red-300 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                            <span>Suspend user account? They will be blocked instantly from accessing the application services.</span>
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setConfirmAction(null)}
                              className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleAction(
                                selectedUser.uid, 
                                `/api/admin/users/${selectedUser.uid}/toggle-active`, 
                                { isActive: false }, 
                                `Suspended ${selectedUser.email}`
                              )}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white"
                            >
                              Confirm Block
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-dark-500 leading-normal mb-1">
                            Block this account to suspend API access. The user will be signed out and unable to process calculations.
                          </p>
                          <ActionButton
                            color="red"
                            disabled={busy[selectedUser.uid]}
                            onClick={() => setConfirmAction('block')}
                          >
                            <Lock className="w-3.5 h-3.5" /> Suspend User Access
                          </ActionButton>
                        </div>
                      )
                    ) : (
                      confirmAction === 'unblock' ? (
                        <div className="bg-green-950/40 border border-green-900 rounded-xl p-3 space-y-3">
                          <p className="text-xs text-green-300 flex items-start gap-2">
                            <UserCheck className="w-4 h-4 flex-shrink-0 text-green-400" />
                            <span>Restore account access? This will enable full functionality back.</span>
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setConfirmAction(null)}
                              className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleAction(
                                selectedUser.uid, 
                                `/api/admin/users/${selectedUser.uid}/toggle-active`, 
                                { isActive: true }, 
                                `Restored access for ${selectedUser.email}`
                              )}
                              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs text-white"
                            >
                              Yes, Restore Access
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-dark-500 leading-normal mb-1">
                            This account is currently blocked and suspended. Re-activate it to restore user access.
                          </p>
                          <ActionButton
                            color="green"
                            disabled={busy[selectedUser.uid]}
                            onClick={() => setConfirmAction('unblock')}
                          >
                            <Unlock className="w-3.5 h-3.5" /> Restore Account Access
                          </ActionButton>
                        </div>
                      )
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
