import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, RefreshCw, ShieldCheck, ShieldX, Clock, Cpu,
  Crown, Zap, CheckCircle, XCircle, AlertTriangle, Search,
  RotateCcw, TrendingUp, LogOut, Shield, ShieldAlert,
  Lock, Unlock, Key, Calendar, Monitor, User, UserCheck,
  UserX, ChevronRight, ChevronLeft, X, Check, Activity, Laptop, ArrowUpDown, Mail, Download
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
    blue:    'bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 border-blue-800/40',
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

// ── Small helpers ───────────────────────────────────────────────────────────
const versionParts = (v) => String(v || '').replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
const compareVersions = (a, b) => {
  const x = versionParts(a), y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
};
const timeAgo = (iso) => {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} y ago`;
};

// ── Clickable summary tile (also acts as a filter) ──────────────────────────
const StatTile = ({ label, value, icon, tone, active, onClick, hint }) => {
  const tones = {
    primary: 'text-primary border-primary/25 bg-primary/5',
    amber: 'text-amber-400 border-amber-500/25 bg-amber-500/5',
    green: 'text-green-400 border-green-500/25 bg-green-500/5',
    blue: 'text-blue-400 border-blue-500/25 bg-blue-500/5',
    red: 'text-red-400 border-red-500/25 bg-red-500/5',
    orange: 'text-orange-400 border-orange-500/25 bg-orange-500/5',
    purple: 'text-purple-400 border-purple-500/25 bg-purple-500/5',
  };
  return (
    <button onClick={onClick} title={hint} disabled={!onClick}
      className={`text-left rounded-xl border px-3.5 py-2 transition-all duration-150 ${onClick ? 'hover:-translate-y-0.5 hover:bg-dark-800/50' : 'cursor-default'}
        ${tones[tone]} ${active ? 'ring-2 ring-primary/70 bg-dark-800/60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-black text-dark-100 leading-none">{value}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-dark-400 mt-1 truncate">{label}</div>
        </div>
        <span className="opacity-80 flex-shrink-0">{icon}</span>
      </div>
    </button>
  );
};

const TabButton = ({ active, onClick, icon, label, badge, badgeTone }) => (
  <button onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
      ${active ? 'border-primary text-primary' : 'border-transparent text-dark-400 hover:text-dark-200'}`}>
    {icon}{label}
    {badge !== undefined && badge !== null && badge !== '' && (
      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${badgeTone === 'red' ? 'bg-red-500/20 text-red-300' : badgeTone === 'amber' ? 'bg-amber-500/20 text-amber-300' : 'bg-dark-700 text-dark-300'}`}>{badge}</span>
    )}
  </button>
);

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
  const [tab, setTab]                 = useState('users');        // users | updates | email
  const [sortBy, setSortBy]             = useState('newest');       // newest | seen | email | trial
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(25);
  const [selected, setSelected]         = useState(() => new Set()); // uids ticked for bulk actions
  const [bulkConfirm, setBulkConfirm]   = useState(null);          // null | 'delete'
  const [bulkTyped, setBulkTyped]       = useState('');
  const [bulkBusy, setBulkBusy]         = useState(false);

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
  // Newest app version any user has reported: older or unknown copies count as "outdated"
  const latestVersion = users.reduce((best, u) => (u.app_version && (!best || compareVersions(u.app_version, best) > 0) ? u.app_version : best), '');

  const filteredUsers = users.filter(u => {
    // 1. Account Type filter
    if (filterType === 'demo' && u.account_type !== 'demo') return false;
    if (filterType === 'premium' && u.account_type !== 'premium') return false;

    // 2. Status filter
    const isBlocked = u.is_active === false;
    const daysLeft = u.trial_days_left;
    const isExpired = u.account_type === 'demo' && typeof daysLeft === 'number' && daysLeft <= 0;

    if (filterStatus === 'unverified' && !(u.email_verified === false || u.disposable_email)) return false;
    if (filterStatus === 'attention' && !(u.email_verified === false || u.disposable_email || u.is_active === false)) return false;
    if (filterStatus === 'outdated' && !(latestVersion && (!u.app_version || compareVersions(u.app_version, latestVersion) < 0))) return false;
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
  stats.attention = users.filter(u => u.email_verified === false || u.disposable_email || u.is_active === false).length;
  stats.unverified = users.filter(u => u.email_verified === false || u.disposable_email).length;
  stats.outdated = users.filter(u => latestVersion && (!u.app_version || compareVersions(u.app_version, latestVersion) < 0)).length;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    switch (sortBy) {
      case 'seen':  return String(b.last_login || '').localeCompare(String(a.last_login || ''));
      case 'email': return String(a.email || '').localeCompare(String(b.email || ''));
      case 'trial': {
        const t = (u) => (u.account_type === 'premium' ? 9999 : (typeof u.trial_days_left === 'number' ? u.trial_days_left : 9998));
        return t(a) - t(b);
      }
      default:      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    }
  });
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Start again from page 1 and an empty selection whenever the list changes
  useEffect(() => { setPage(1); }, [search, filterType, filterStatus, sortBy, pageSize]);
  useEffect(() => { setSelected(new Set()); setBulkConfirm(null); setBulkTyped(''); }, [search, filterType, filterStatus, tab]);

  const selectableOnPage = pageUsers.filter(u => !u.is_admin && u.uid !== user?.userId);
  const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every(u => selected.has(u.uid));
  const toggleSelected = (uid) => setSelected(prev => { const n = new Set(prev); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });
  const toggleAllOnPage = () => setSelected(prev => {
    const n = new Set(prev);
    selectableOnPage.forEach(u => (allOnPageSelected ? n.delete(u.uid) : n.add(u.uid)));
    return n;
  });

  const runBulk = async (kind) => {
    const uids = [...selected];
    if (!uids.length) return;
    setBulkBusy(true);
    try {
      if (kind === 'delete') {
        const res = await apiFetch('/api/admin/users/bulk-delete', { method: 'POST', body: JSON.stringify({ uids }) });
        const d = await res.json();
        if (d.success) showToast(`Deleted ${d.deleted.length} account(s)${d.skipped.length ? `, skipped ${d.skipped.length}` : ''}`);
        else showToast(d.error || 'Bulk delete failed', 'error');
      } else {
        let ok = 0;
        for (const uid of uids) {
          const res = await apiFetch(`/api/admin/users/${uid}/toggle-active`, { method: 'POST', body: JSON.stringify({ isActive: kind === 'restore' }) });
          const d = await res.json().catch(() => ({}));
          if (d.success) ok += 1;
        }
        showToast(`${kind === 'restore' ? 'Restored' : 'Suspended'} ${ok} of ${uids.length} account(s)`);
      }
      setSelected(new Set()); setBulkConfirm(null); setBulkTyped('');
      await fetchUsers();
    } catch { showToast('Connection error', 'error'); }
    finally { setBulkBusy(false); }
  };

  // Version distribution for the "App updates" tab
  const versionCounts = users.reduce((acc, u) => { const k = u.app_version ? `v${u.app_version}` : 'Unknown (old build)'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  const resetFilters = () => { setSearch(''); setFilterType('all'); setFilterStatus('all'); };
  const openFilter = (type, status) => { setTab('users'); setFilterType(type); setFilterStatus(status); setSearch(''); };

  const exportCsv = () => {
    const rows = [['email', 'plan', 'status', 'email_verified', 'app_version', 'pcs', 'created_at', 'last_login']];
    sortedUsers.forEach(u => rows.push([u.email, u.account_type, u.is_active === false ? 'suspended' : 'active', u.email_verified === null || u.email_verified === undefined ? '' : u.email_verified,
      u.app_version || '', u.devices ? Object.keys(u.devices).length : 0, u.created_at || '', u.last_login || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `parcel-tools-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1500px] mx-auto w-full px-6 pt-5 pb-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 mb-3 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-dark-50 flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-primary" />
              Admin Console
            </h1>
            <p className="text-dark-400 text-xs mt-1 truncate">
              Signed in as <strong className="text-dark-200">{user?.email}</strong> · this copy v{__APP_VERSION__}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={fetchUsers} disabled={loading} title="Reload the user list"
              className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border border-dark-700 bg-dark-800/40 hover:bg-dark-800">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border border-dark-700 bg-dark-800/40 hover:bg-dark-800">
              <ChevronLeft className="w-4 h-4" /> Back to app
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-dark-800 mb-4 flex-shrink-0 overflow-x-auto">
          <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={<Users className="w-4 h-4" />} label="Users" badge={users.length} />
          <TabButton active={tab === 'updates'} onClick={() => setTab('updates')} icon={<Download className="w-4 h-4" />} label="App updates"
            badge={stats.outdated > 0 ? `${stats.outdated} outdated` : ''} badgeTone="amber" />
          <TabButton active={tab === 'email'} onClick={() => setTab('email')} icon={<Mail className="w-4 h-4" />} label="Email rules"
            badge={stats.unverified > 0 ? `${stats.unverified} flagged` : ''} badgeTone="red" />
        </div>

        {tab === 'users' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {/* ── Summary tiles (click to filter) ── */}
            <div className="grid grid-cols-3 xl:grid-cols-6 gap-2.5 flex-shrink-0">
              <StatTile label="All accounts" value={stats.total} tone="primary" icon={<Users className="w-4 h-4" />}
                active={filterType === 'all' && filterStatus === 'all'} onClick={() => openFilter('all', 'all')} hint="Show everyone" />
              <StatTile label="Premium" value={stats.premium} tone="amber" icon={<Crown className="w-4 h-4" />}
                active={filterType === 'premium' && filterStatus === 'all'} onClick={() => openFilter('premium', 'all')} hint="Paying customers" />
              <StatTile label="Active trials" value={stats.activeTrial} tone="green" icon={<Zap className="w-4 h-4" />}
                active={filterType === 'demo' && filterStatus === 'active'} onClick={() => openFilter('demo', 'active')} hint="Demo accounts still inside their 30 days" />
              <StatTile label="Expired trials" value={stats.expiredTrial} tone="blue" icon={<Clock className="w-4 h-4" />}
                active={filterStatus === 'expired'} onClick={() => openFilter('all', 'expired')} hint="Good people to follow up with" />
              <StatTile label="Needs attention" value={stats.attention} tone="orange" icon={<AlertTriangle className="w-4 h-4" />}
                active={filterStatus === 'attention'} onClick={() => openFilter('all', 'attention')} hint="Unverified or disposable email, or suspended" />
              <StatTile label="Connected PCs" value={stats.devices} tone="purple" icon={<Laptop className="w-4 h-4" />}
                hint="Total computers registered across all accounts" />
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-shrink-0">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input type="text" placeholder="Search email, license key or computer name…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl bg-dark-900/70 border border-dark-800 focus:border-primary/60 outline-none text-dark-100" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-200"><X className="w-4 h-4" /></button>}
              </div>
              <div className="flex items-center gap-1 bg-dark-900/70 border border-dark-800 rounded-xl p-1">
                {[['all', 'All plans'], ['demo', 'Demo'], ['premium', 'Premium']].map(([f, label]) => (
                  <button key={f} onClick={() => setFilterType(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filterType === f ? 'bg-primary text-white' : 'text-dark-400 hover:text-dark-200'}`}>{label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-dark-500 flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" />
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-dark-900/70 border border-dark-800 rounded-lg px-2 py-2 text-xs text-dark-200">
                    <option value="newest">Newest first</option>
                    <option value="seen">Last seen</option>
                    <option value="email">Email A–Z</option>
                    <option value="trial">Trial ending soonest</option>
                  </select>
                </label>
                <button onClick={exportCsv} title="Download the filtered list as a spreadsheet (CSV)"
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-dark-800 bg-dark-900/70 hover:bg-dark-800 text-dark-300">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {/* ── Status chips with counts ── */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {[['all', 'All', stats.total], ['active', 'Active', users.filter(u => u.is_active !== false && !(u.account_type === 'demo' && typeof u.trial_days_left === 'number' && u.trial_days_left <= 0)).length],
                ['expired', 'Expired', stats.expiredTrial], ['blocked', 'Suspended', stats.blocked],
                ['unverified', 'Unverified / disposable', stats.unverified], ['outdated', latestVersion ? `Older than v${latestVersion}` : 'Outdated', stats.outdated]].map(([f, label, n]) => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors
                    ${filterStatus === f ? 'bg-primary/15 border-primary/60 text-primary' : 'border-dark-800 text-dark-400 hover:text-dark-200 hover:border-dark-600'}`}>
                  {label}<span className="text-[10px] px-1.5 rounded-full bg-dark-800 text-dark-300">{n}</span>
                </button>
              ))}
              {(search || filterType !== 'all' || filterStatus !== 'all') && (
                <button onClick={resetFilters} className="text-xs text-dark-500 hover:text-dark-200 underline underline-offset-2 ml-1">Clear filters</button>
              )}
            </div>

            {/* ── Bulk action bar ── */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/10 flex-shrink-0">
                <span className="text-sm font-semibold text-dark-100">{selected.size} selected</span>
                {bulkConfirm === 'delete' ? (
                  <>
                    <span className="text-xs text-red-300">Permanently delete {selected.size} account(s)? Type DELETE:</span>
                    <input value={bulkTyped} onChange={e => setBulkTyped(e.target.value)} className="px-2 py-1 rounded-lg bg-dark-900 border border-dark-700 text-xs w-28 text-dark-100" />
                    <button disabled={bulkBusy || bulkTyped !== 'DELETE'} onClick={() => runBulk('delete')} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs text-white">{bulkBusy ? 'Deleting…' : 'Delete'}</button>
                    <button onClick={() => { setBulkConfirm(null); setBulkTyped(''); }} className="px-3 py-1.5 rounded-lg bg-dark-800 text-xs text-dark-300 border border-dark-700">Cancel</button>
                  </>
                ) : (
                  <>
                    <button disabled={bulkBusy} onClick={() => runBulk('suspend')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-800/40 text-xs text-amber-300 border border-amber-800/50"><Lock className="w-3.5 h-3.5" /> Suspend</button>
                    <button disabled={bulkBusy} onClick={() => runBulk('restore')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 hover:bg-green-800/40 text-xs text-green-300 border border-green-800/50"><Unlock className="w-3.5 h-3.5" /> Restore</button>
                    <button disabled={bulkBusy} onClick={() => setBulkConfirm('delete')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-800/40 text-xs text-red-300 border border-red-800/50"><UserX className="w-3.5 h-3.5" /> Delete…</button>
                    <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-dark-400 hover:text-dark-200 underline underline-offset-2">Clear selection</button>
                  </>
                )}
              </div>
            )}

            {/* ── Users table ── */}
            <div className="flex-1 min-h-0 border border-dark-800 rounded-2xl overflow-hidden flex flex-col bg-dark-900/30">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-medium">Loading accounts…</span>
                </div>
              ) : sortedUsers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-dark-500 py-16">
                  <Users className="w-10 h-10 text-dark-600" />
                  <span className="text-sm font-medium">No accounts match these filters</span>
                  <button onClick={resetFilters} className="text-xs px-3 py-1.5 rounded-lg border border-dark-700 text-dark-300 hover:bg-dark-800">Clear filters</button>
                </div>
              ) : (
                <div className="flex-1 overflow-auto scroll-area">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="bg-dark-900 border-b border-dark-800 sticky top-0 z-10">
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">
                        <th className="pl-4 pr-2 py-3 w-9"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} title="Select everyone on this page" /></th>
                        <th className="px-3 py-3">Account</th>
                        <th className="px-3 py-3">Plan</th>
                        <th className="px-3 py-3">Trial</th>
                        <th className="px-3 py-3 text-center">PCs</th>
                        <th className="px-3 py-3">App</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Last seen</th>
                        <th className="px-3 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800/50">
                      {pageUsers.map((u) => {
                        const daysLeft = u.trial_days_left;
                        const isExpired = u.account_type === 'demo' && typeof daysLeft === 'number' && daysLeft <= 0;
                        const isBlocked = u.is_active === false;
                        const pcs = u.devices ? Object.keys(u.devices).length : 0;
                        const pcLimit = Number(u.max_devices) > 0 ? Number(u.max_devices) : 2;
                        const isOld = latestVersion && (!u.app_version || compareVersions(u.app_version, latestVersion) < 0);
                        const selectable = !u.is_admin && u.uid !== user?.userId;
                        return (
                          <tr key={u.uid} onClick={() => setSelectedUser(u)}
                            className={`cursor-pointer transition-colors hover:bg-dark-800/40 ${selectedUser?.uid === u.uid ? 'bg-dark-800/60' : ''} ${selected.has(u.uid) ? 'bg-primary/5' : ''}`}>
                            <td className="pl-4 pr-2 py-2.5" onClick={e => e.stopPropagation()}>
                              {selectable ? <input type="checkbox" checked={selected.has(u.uid)} onChange={() => toggleSelected(u.uid)} /> : <span className="block w-[13px]" />}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-dark-800 border border-dark-700/60 flex items-center justify-center font-bold text-xs text-primary flex-shrink-0">
                                  {u.email ? u.email.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-dark-100 truncate max-w-[340px]" title={u.email}>{u.email}</div>
                                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-dark-500">
                                    <span>Joined {timeAgo(u.created_at)}</span>
                                    {u.is_admin && <span className="text-purple-400 font-bold flex items-center gap-1"><Shield className="w-3 h-3" />Admin</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              {u.account_type === 'premium'
                                ? <Badge color="amber"><Crown className="w-3 h-3" /> Premium</Badge>
                                : <Badge color="blue"><Zap className="w-3 h-3" /> Demo</Badge>}
                            </td>
                            <td className="px-3 py-2.5 text-xs">
                              {u.account_type === 'premium' ? <span className="text-dark-600">—</span>
                                : isExpired ? <span className="text-red-400 font-semibold">Expired</span>
                                : <div className="w-24">
                                    <div className={`font-semibold ${(daysLeft || 0) <= 5 ? 'text-amber-400' : 'text-dark-300'}`}>{daysLeft ?? 0} days left</div>
                                    <div className="h-1 mt-1 rounded-full bg-dark-800 overflow-hidden"><div className={`h-full ${(daysLeft || 0) <= 5 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(30, daysLeft || 0) / 30 * 100}%` }} /></div>
                                  </div>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-xs font-mono font-semibold ${pcs >= pcLimit ? 'text-amber-400' : 'text-dark-300'}`} title={`${pcs} of ${pcLimit} allowed PCs`}>{pcs}/{pcLimit}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${isOld ? 'text-amber-300 border-amber-700/50 bg-amber-950/30' : 'text-dark-300 border-dark-700/60 bg-dark-800/50'}`}
                                title={u.app_version ? `Last seen on v${u.app_version}` : 'No version recorded: an old build'}>
                                {u.app_version ? `v${u.app_version}` : 'old'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1">
                                {isBlocked ? <Badge color="red"><ShieldX className="w-3 h-3" /> Suspended</Badge>
                                  : isExpired ? <Badge color="amber"><Clock className="w-3 h-3" /> Expired</Badge>
                                  : <Badge color="green"><CheckCircle className="w-3 h-3" /> Active</Badge>}
                                {u.disposable_email && <Badge color="red"><AlertTriangle className="w-3 h-3" /> {u.email_rule_code === 'EMAIL_DOMAIN_NOT_APPROVED' ? 'Domain' : 'Disposable'}</Badge>}
                                {!u.disposable_email && u.email_verified === false && !u.is_admin && <Badge color="amber"><Mail className="w-3 h-3" /> Unverified</Badge>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-dark-400 whitespace-nowrap" title={u.last_login ? formatDate(u.last_login) : ''}>{timeAgo(u.last_login)}</td>
                            <td className="px-3 py-2.5"><ChevronRight className="w-4 h-4 text-dark-600" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-4 py-2.5 bg-dark-900/80 border-t border-dark-800 flex flex-wrap items-center justify-between gap-2 text-xs text-dark-500 flex-shrink-0">
                <span>Showing {sortedUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedUsers.length)} of {sortedUsers.length}{sortedUsers.length !== users.length ? ` (filtered from ${users.length})` : ''}</span>
                <div className="flex items-center gap-2">
                  <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="bg-dark-900 border border-dark-800 rounded-md px-1.5 py-1 text-xs text-dark-300">
                    {[25, 50, 100].map(n => <option key={n} value={n}>{n} per page</option>)}
                  </select>
                  <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="p-1.5 rounded-md border border-dark-800 disabled:opacity-30 hover:bg-dark-800"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="text-dark-300">Page {currentPage} / {pageCount}</span>
                  <button disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} className="p-1.5 rounded-md border border-dark-800 disabled:opacity-30 hover:bg-dark-800"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'updates' && (
          <div className="flex-1 overflow-y-auto scroll-area space-y-4 pb-4 max-w-4xl">
            <div className="glass border border-dark-800 rounded-2xl p-5">
              <h2 className="text-sm font-bold text-dark-100 mb-1">Which version are your users on?</h2>
              <p className="text-xs text-dark-400 mb-4">Based on the version each account last signed in with. Accounts that never reported a version run an old build that cannot be forced to update.</p>
              <div className="space-y-2">
                {Object.entries(versionCounts).sort((a, b) => compareVersions(b[0], a[0])).map(([v, n]) => (
                  <div key={v} className="flex items-center gap-3 text-xs">
                    <span className="w-40 font-mono text-dark-300 truncate">{v}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-dark-800 overflow-hidden">
                      <div className={`h-full ${v === `v${latestVersion}` ? 'bg-green-500' : v.startsWith('Unknown') ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${(n / Math.max(1, users.length)) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right text-dark-300">{n} user{n === 1 ? '' : 's'} · {Math.round((n / Math.max(1, users.length)) * 100)}%</span>
                  </div>
                ))}
                {users.length === 0 && <p className="text-xs text-dark-500">No data yet.</p>}
              </div>
              {stats.outdated > 0 && (
                <button onClick={() => openFilter('all', 'outdated')} className="mt-4 text-xs px-3 py-1.5 rounded-lg border border-dark-700 text-dark-200 hover:bg-dark-800">
                  Show the {stats.outdated} account(s) on older versions →
                </button>
              )}
            </div>
            <AppVersionControl onDone={(m) => showToast(m)} onError={(m) => showToast(m, 'error')} />
            <OutdatedBlock defaultVersion={latestVersion} onDone={async (m) => { showToast(m); await fetchUsers(); }} onError={(m) => showToast(m, 'error')} />
          </div>
        )}

        {tab === 'email' && (
          <div className="flex-1 overflow-y-auto scroll-area space-y-4 pb-4 max-w-4xl">
            <div className="glass border border-dark-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-dark-100">Accounts that break your email rules</h2>
                <p className="text-xs text-dark-400 mt-1">{stats.unverified} account(s) use a disposable address or have not verified their email.</p>
              </div>
              <button onClick={() => openFilter('all', 'unverified')} className="text-xs px-3.5 py-2 rounded-lg bg-primary text-white hover:bg-primary/90">Review &amp; clean up →</button>
            </div>
            <EmailRulesControl onDone={(m) => showToast(m)} onError={(m) => showToast(m, 'error')} />
          </div>
        )}
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

                {/* ── Section: Allowed PCs ── */}
                <DeviceLimitControl
                  key={selectedUser.uid}
                  user={selectedUser}
                  disabled={busy[selectedUser.uid]}
                  onSave={(n) => handleAction(
                    selectedUser.uid,
                    `/api/admin/users/${selectedUser.uid}/set-device-limit`,
                    { maxDevices: n },
                    `${selectedUser.email} can now use ${n} PC${n === 1 ? '' : 's'}`
                  )}
                />

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

                {/* ── Section: Delete account permanently ── */}
                {!selectedUser.is_admin && (
                  <DeleteAccountControl
                    key={'del-' + selectedUser.uid}
                    user={selectedUser}
                    disabled={busy[selectedUser.uid]}
                    onDelete={async () => {
                      await handleAction(
                        selectedUser.uid,
                        `/api/admin/users/${selectedUser.uid}/delete`,
                        null,
                        `Deleted ${selectedUser.email}`
                      );
                      setSelectedUser(null);
                    }}
                  />
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeviceLimitControl({ user, disabled, onSave }) {
  const current = Number(user.max_devices) > 0 ? Number(user.max_devices) : 2;
  const [value, setValue] = useState(current);
  const used = user.devices && typeof user.devices === 'object' ? Object.keys(user.devices).length : 0;
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
        <Monitor className="w-4 h-4 text-blue-400" />
        Allowed PCs
      </h4>
      <div className="bg-dark-950/30 border border-dark-800 rounded-2xl p-4 space-y-3">
        <p className="text-[11px] text-dark-500 leading-normal">
          This user is using {used} of {current} allowed PC{current === 1 ? '' : 's'}. Raise the limit to let them sign in from more computers.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min="1" max="50" value={value}
            onChange={e => setValue(e.target.value)}
            className="w-20 px-2 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-sm text-dark-100"
          />
          <ActionButton
            color="blue"
            disabled={disabled || !(Number(value) >= 1 && Number(value) <= 50) || Number(value) === current}
            onClick={() => onSave(Number(value))}
          >
            <Check className="w-3.5 h-3.5" /> Save PC Limit
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountControl({ user, disabled, onDelete }) {
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
        <UserX className="w-4 h-4" />
        Danger Zone
      </h4>
      <div className="bg-red-950/20 border border-red-900/60 rounded-2xl p-4 space-y-3">
        {open ? (
          <>
            <p className="text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
              <span>This permanently deletes the login and record for {user.email}. It cannot be undone. Type the email to confirm.</span>
            </p>
            <input
              value={typed} onChange={e => setTyped(e.target.value)} placeholder={user.email}
              className="w-full px-2 py-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-dark-100"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setOpen(false); setTyped(''); }}
                className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700"
              >
                Cancel
              </button>
              <button
                disabled={disabled || typed.trim().toLowerCase() !== (user.email || '').toLowerCase()}
                onClick={onDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs text-white"
              >
                Delete Permanently
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-dark-500 leading-normal">
              Suspending only blocks access. Deleting removes the account completely so the email can register again.
            </p>
            <ActionButton color="red" disabled={disabled} onClick={() => setOpen(true)}>
              <UserX className="w-3.5 h-3.5" /> Delete Account Permanently
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, hint, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-dark-400">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-dark-500">{hint}</span>}
  </label>
);
const inputCls = 'px-3 py-2 rounded-lg bg-dark-900 border border-dark-700 focus:border-primary/60 outline-none text-sm text-dark-100';

function AppVersionControl({ onDone, onError }) {
  const [info, setInfo] = useState(null);
  const [minVersion, setMinVersion] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/app-version');
      const d = await res.json();
      if (d.success) { setInfo(d); setMinVersion(d.minimumVersion || ''); setUrl(d.downloadUrl || ''); setMessage(d.message || ''); }
    } catch { /* shown as unavailable */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = info && (minVersion !== (info.minimumVersion || '') || url !== (info.downloadUrl || '') || message !== (info.message || ''));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/app-version', { method: 'POST', body: JSON.stringify({ minVersion, downloadUrl: url, message }) });
      const d = await res.json();
      if (d.success) { setInfo(d); setConfirm(false); onDone(minVersion ? `Minimum version set to ${minVersion}` : 'Forced update turned off'); }
      else onError(d.error || 'Could not save');
    } catch { onError('Connection error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass border border-dark-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Forced update</h2>
          <p className="text-xs text-dark-400 mt-1 max-w-xl">Copies of the app older than the minimum version stop working and show an "Update required" screen with a download button. Works for v2.0.22 and newer; older builds do not contain this check.</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${info?.minimumVersion ? 'text-amber-300 border-amber-700/50 bg-amber-950/30' : 'text-green-300 border-green-800/50 bg-green-950/30'}`}>
          {info ? (info.minimumVersion ? `Required: v${info.minimumVersion}+` : 'Off: every version may run') : 'Loading…'}
        </span>
      </div>
      <div className="grid sm:grid-cols-[160px_1fr] gap-3">
        <Field label="Minimum version" hint={info ? `This copy is v${info.currentVersion}` : ''}>
          <input value={minVersion} onChange={e => setMinVersion(e.target.value)} placeholder="e.g. 2.0.23" className={inputCls} />
        </Field>
        <Field label="Download page" hint="Opened by the “Open the download page” button">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className={inputCls} />
        </Field>
      </div>
      <Field label="Message shown to users (optional)">
        <input value={message} onChange={e => setMessage(e.target.value)} className={inputCls} />
      </Field>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40">
          <span className="text-xs text-amber-200 flex-1 min-w-[220px]">{minVersion ? `Everyone below v${minVersion} will be blocked until they update. Publish the v${minVersion} release first!` : 'Turn the forced update off?'}</span>
          <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs text-white">{saving ? 'Saving…' : 'Yes, apply'}</button>
          <button onClick={() => setConfirm(false)} className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700">Cancel</button>
        </div>
      ) : (
        <div><button disabled={!dirty} onClick={() => setConfirm(true)} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-xs font-semibold text-white">Save changes…</button></div>
      )}
    </div>
  );
}

function EmailRulesControl({ onDone, onError }) {
  const [strict, setStrict] = useState(false);
  const [blocked, setBlocked] = useState('');
  const [allowed, setAllowed] = useState('');
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const lines = (t) => t.split(/[\n,;\s]+/).map(x => x.trim()).filter(Boolean);

  const load = useCallback(async () => {
    try {
      const d = await (await apiFetch('/api/admin/email-policy')).json();
      if (d.success) {
        setStrict(!!d.strict); setBlocked((d.blockedDomains || []).join('\n')); setAllowed((d.allowedDomains || []).join('\n'));
        setSaved({ strict: !!d.strict, blocked: (d.blockedDomains || []).join('\n'), allowed: (d.allowedDomains || []).join('\n') });
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = saved && (strict !== saved.strict || blocked !== saved.blocked || allowed !== saved.allowed);

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/email-policy', { method: 'POST', body: JSON.stringify({ strict, blockedDomains: lines(blocked), allowedDomains: lines(allowed) }) });
      const d = await res.json();
      if (d.success) { onDone(strict ? 'Strict email mode is ON' : 'Email rules saved'); await load(); } else onError(d.error || 'Could not save');
    } catch { onError('Connection error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass border border-dark-800 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-primary" /> Email rules</h2>
          <p className="text-xs text-dark-400 mt-1 max-w-xl">Temp-mail domains (about 98,000 of them, refreshed weekly) are always refused at sign-up and sign-in. You can add more below.</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${strict ? 'text-amber-300 border-amber-700/50 bg-amber-950/30' : 'text-green-300 border-green-800/50 bg-green-950/30'}`}>
          {strict ? 'Strict mode ON' : 'Standard'}
        </span>
      </div>

      <button type="button" onClick={() => setStrict(v => !v)}
        className={`flex items-start gap-3 text-left p-3 rounded-xl border transition-colors ${strict ? 'border-amber-700/50 bg-amber-950/20' : 'border-dark-800 hover:border-dark-600'}`}>
        <span className={`mt-0.5 w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${strict ? 'bg-primary' : 'bg-dark-700'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${strict ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        <span>
          <span className="block text-sm font-semibold text-dark-100">Strict mode</span>
          <span className="block text-xs text-dark-400 mt-0.5">Only Gmail, Outlook, Yahoo, iCloud, Proton and similar providers, plus the approved domains below, may sign up or sign in. This is the only setting that stops brand-new temp-mail domains. A company address needs its domain approved first.</span>
        </span>
      </button>

      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Extra blocked domains" hint="One per line">
          <textarea value={blocked} onChange={e => setBlocked(e.target.value)} rows={5} placeholder="fakemail.example" className={`${inputCls} font-mono text-xs`} />
        </Field>
        <Field label="Approved domains (strict mode)" hint="One per line, e.g. a customer's company domain">
          <textarea value={allowed} onChange={e => setAllowed(e.target.value)} rows={5} placeholder="mycompany.com" className={`${inputCls} font-mono text-xs`} />
        </Field>
      </div>
      <div><button disabled={saving || !dirty} onClick={save} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-xs font-semibold text-white">{saving ? 'Saving…' : 'Save email rules'}</button></div>
    </div>
  );
}

function OutdatedBlock({ defaultVersion, onDone, onError }) {
  const [minVersion, setMinVersion] = useState(defaultVersion || '');
  const [preview, setPreview] = useState(null);
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  useEffect(() => { if (!minVersion && defaultVersion) setMinVersion(defaultVersion); }, [defaultVersion]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadPreview = async () => {
    setWorking(true);
    try {
      const res = await apiFetch(`/api/admin/outdated-users?minVersion=${encodeURIComponent(minVersion)}`);
      const d = await res.json();
      if (d.success) setPreview(d); else onError(d.error || 'Could not load the list');
    } catch { onError('Connection error'); }
    finally { setWorking(false); }
  };
  const restore = async () => {
    setWorking(true);
    try {
      const res = await apiFetch('/api/admin/restore-updated', { method: 'POST' });
      const d = await res.json();
      if (d.success) onDone(`Restored ${d.restored} account(s) that have updated`); else onError(d.error || 'Could not restore');
    } catch { onError('Connection error'); }
    finally { setWorking(false); }
  };
  const apply = async () => {
    setWorking(true);
    try {
      const res = await apiFetch('/api/admin/block-outdated', { method: 'POST', body: JSON.stringify({ minVersion }) });
      const d = await res.json();
      if (d.success) { setPreview(null); setTyped(''); onDone(`Blocked ${d.blocked} account(s) on old versions`); }
      else onError(d.error || 'Could not block');
    } catch { onError('Connection error'); }
    finally { setWorking(false); }
  };

  return (
    <div className="glass border border-dark-800 rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-400" /> Block old versions that can't be forced</h2>
        <p className="text-xs text-dark-400 mt-1 max-w-xl">v2.0.21 and older have no update check, but they all obey the account's on/off switch. This switches off every account that has not been seen on the version below. Those apps then say "account disabled". When the user installs the new version and signs in, they are let in again.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Block accounts not seen on">
          <input value={minVersion} onChange={e => { setMinVersion(e.target.value); setPreview(null); }} placeholder="e.g. 2.0.23" className={`${inputCls} w-36`} />
        </Field>
        <button disabled={working || !minVersion} onClick={loadPreview} className="px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 disabled:opacity-40 text-xs text-dark-200 border border-dark-700">{working ? 'Loading…' : 'Preview who would be blocked'}</button>
        <button disabled={working} onClick={restore} title="Users who were blocked and have since updated are already let in by the app; this tidies their stored status"
          className="px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 disabled:opacity-40 text-xs text-dark-200 border border-dark-700">Restore users who have updated</button>
      </div>
      {preview && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-amber-300">{preview.count} account(s) would be blocked. Paying customers are included, so give people time to update first and tell them beforehand.</div>
          <div className="max-h-44 overflow-y-auto text-[11px] text-dark-400 bg-dark-950/50 rounded-lg p-2 border border-dark-800">
            {preview.users.map(u => <div key={u.uid}>{u.email} <span className="text-dark-600">— {u.appVersion ? `v${u.appVersion}` : 'unknown/old'}{u.accountType === 'premium' ? ' · premium' : ''}</span></div>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type BLOCK to confirm" className={`${inputCls} py-1.5 text-xs`} />
            <button disabled={working || typed !== 'BLOCK' || preview.count === 0} onClick={apply} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs text-white">Block {preview.count} account(s)</button>
            <button onClick={() => { setPreview(null); setTyped(''); }} className="px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-xs text-dark-300 border border-dark-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
