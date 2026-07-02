import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import LicenseBadge from '../components/LicenseBadge';
import StatusBar from '../components/StatusBar';
import {
  Settings, FolderOpen, BarChart3, Calculator, Map,
  HelpCircle, Save, LogOut, X, Key, FolderX, ChevronRight,
  Shield
} from 'lucide-react';

// ── Menu Options ──────────────────────────────────────────────────────────────
const MENU_OPTIONS = [
  {
    num: 1,
    icon: <Settings className="w-7 h-7" />,
    label: 'WORK MODE',
    description: 'Configure survey & calculation settings',
    path: '/work-mode',
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'hover:border-blue-500/60',
    iconColor: 'text-blue-400',
  },
  {
    num: 2,
    icon: <FolderOpen className="w-7 h-7" />,
    label: 'DATA FILES',
    description: 'Open, save, and manage projects & points',
    path: '/data-files',
    color: 'from-purple-500/20 to-purple-600/10',
    border: 'hover:border-purple-500/60',
    iconColor: 'text-purple-400',
  },
  {
    num: 3,
    icon: <BarChart3 className="w-7 h-7" />,
    label: 'PLOTTING',
    description: 'Visualize survey points in real coordinates',
    path: '/plotting',
    color: 'from-cyan-500/20 to-cyan-600/10',
    border: 'hover:border-cyan-500/60',
    iconColor: 'text-cyan-400',
  },
  {
    num: 4,
    icon: <Calculator className="w-7 h-7" />,
    label: 'AREA CALCULATOR',
    description: 'Calculate, save, and export parcel areas',
    path: '/parcel-calculator',
    color: 'from-primary/20 to-primary-dark/10',
    border: 'hover:border-primary/60',
    iconColor: 'text-primary',
  },
  {
    num: 5,
    icon: <Map className="w-7 h-7" />,
    label: 'CAD IMPORT',
    description: 'Import DXF / DWG drawings with layer control',
    path: '/dxf-import',
    color: 'from-orange-500/20 to-orange-600/10',
    border: 'hover:border-orange-500/60',
    iconColor: 'text-orange-400',
  },
];

// ── Card ─────────────────────────────────────────────────────────────────────
const MenuCard = ({ option, index, onClick }) => (
  <motion.button
    key={option.num}
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06 }}
    onClick={() => onClick(option.path, option.num)}
    className={`menu-card h-full min-h-[120px] group ${option.border}`}
  >
    {/* Number badge */}
    <span className="menu-card-number">{option.num}</span>

    {/* Icon */}
    <div className={`${option.iconColor} transition-transform duration-300 group-hover:scale-110`}>
      {option.icon}
    </div>

    {/* Text */}
    <div className="flex-1 text-left">
      <div className="font-bold text-dark-100 text-base tracking-wide group-hover:text-white transition-colors">
        {option.label}
      </div>
      <div className="text-dark-400 text-xs mt-0.5 leading-relaxed group-hover:text-dark-300 transition-colors">
        {option.description}
      </div>
    </div>

    {/* Arrow */}
    <ChevronRight className="w-4 h-4 text-dark-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />

    {/* Gradient overlay on hover */}
    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${option.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
  </motion.button>
);

// ── Main Component ────────────────────────────────────────────────────────────
const MainMenu = () => {
  const navigate = useNavigate();
  const { savedParcels, projectName, closeProject, pointsFileName } = useProject();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [showExitDialog, setShowExitDialog] = React.useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);
  const [licenseStatus, setLicenseStatus] = React.useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem('sessionToken');
    const headers = {};
    if (token) {
      headers['X-Session-Token'] = token;
    }
    fetch('http://127.0.0.1:5000/api/license/status', { headers })
      .then(r => r.json())
      .then(d => setLicenseStatus(d))
      .catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F1') { e.preventDefault(); navigate('/assistant'); return; }
      if (e.ctrlKey && e.key === 'x') { setShowExitDialog(true); return; }
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        const opt = MENU_OPTIONS.find(o => o.num === num);
        if (opt) handleSelect(opt.path, opt.num);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [licenseStatus]);

  const handleSelect = (path, num) => {
    if (licenseStatus?.status === 'expired') {
      toast.error('Your trial has expired. Please purchase a license.');
      navigate('/license');
      return;
    }
    if (path !== '#') navigate(path);
    else toast.info(`Option ${num} coming soon!`);
  };

  return (
    <div className="page-container">
      {/* ── Top Header Bar ──────────────────────────────────── */}
      <header className="flex-shrink-0 px-5 py-3 border-b border-dark-700/60
                         bg-dark-800/70 backdrop-blur-sm flex items-center gap-4">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-lg
                          flex items-center justify-center shadow-glow flex-shrink-0">
            <span className="text-lg">📐</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">PARCEL TOOLS</h1>
            <p className="text-[11px] text-dark-400 leading-none mt-0.5">Professional Surveying Software</p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 ml-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                           bg-primary/10 border border-primary/30 text-primary">
            v2.0 Premium
          </span>
          <LicenseBadge />
          {projectName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                             bg-dark-700 border border-dark-600 text-dark-200">
              📁 {projectName}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {user && (user.isAdmin || user.email === 'nsayegh2003@yahoo.com') && (
            <button
              onClick={() => navigate('/admin')}
              className="btn-secondary text-sm py-1.5 px-3 border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-1.5"
              title="Admin Panel"
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
          <button
            onClick={() => navigate('/assistant')}
            className="btn-ghost text-sm py-1.5 px-3"
            title="Help / Assistant (F1)"
          >
            <HelpCircle className="w-4 h-4" />
            Help
            <kbd className="kbd ml-1">F1</kbd>
          </button>
          <button
            onClick={async () => {
              const { handleQuickSaveAs } = await import('../utils/quickSave');
              await handleQuickSaveAs();
            }}
            className="btn-primary text-sm py-1.5 px-3"
            title="Save Project As"
          >
            <Save className="w-4 h-4" />
            Save As
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 p-4 overflow-hidden">

        {/* ── LEFT: Menu cards (2×3 responsive grid) ─── */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3 h-full overflow-y-auto scroll-area pr-1">
          {MENU_OPTIONS.map((option, i) => (
            <MenuCard key={option.num} option={option} index={i} onClick={handleSelect} />
          ))}
          {/* Empty sixth cell on sm breakpoint for visual balance */}
          <div className="hidden sm:block lg:hidden" />
        </div>

        {/* ── RIGHT: Sidebar ──────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 h-full overflow-y-auto no-scrollbar">

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="sidebar-section"
          >
            <div className="sidebar-title">
              <BarChart3 className="w-3.5 h-3.5" />
              Quick Stats
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-dark-400">Saved Parcels</span>
                <span className="text-2xl font-bold text-success">{savedParcels?.length || 0}</span>
              </div>
              <div className="h-px bg-dark-700" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-dark-400">Active Project</span>
                <span className="text-primary font-semibold text-xs truncate max-w-[120px]">
                  {projectName || 'None'}
                </span>
              </div>

            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.32 }}
            className="sidebar-section flex-1"
          >
            <div className="sidebar-title">
              <Settings className="w-3.5 h-3.5" />
              Quick Actions
            </div>
            <div className="space-y-1">
              <button onClick={() => handleSelect('/parcel-calculator', 4)} className="quick-action">
                <Calculator className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-dark-200 group-hover:text-white">New Parcel</span>
              </button>
              <button onClick={() => handleSelect('/data-files', 2)} className="quick-action">
                <FolderOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span className="text-sm text-dark-200 group-hover:text-white">Open Project</span>
              </button>
              <button onClick={() => navigate('/assistant')} className="quick-action">
                <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-sm text-dark-200 group-hover:text-white">Help / Assistant</span>
              </button>
              <button onClick={() => navigate('/license')} className="quick-action">
                <Key className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-sm text-dark-200 group-hover:text-white">License</span>
              </button>

              {(pointsFileName || projectName) && (
                <button
                  onClick={() => { closeProject(); toast.success('Project closed.'); }}
                  className="quick-action group"
                >
                  <FolderX className="w-4 h-4 text-danger flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-dark-200 group-hover:text-danger">Close Project</div>
                    {pointsFileName && (
                      <div className="text-xs text-dark-500 truncate">{pointsFileName}</div>
                    )}
                  </div>
                </button>
              )}

              {user && (
                <button onClick={() => setShowLogoutDialog(true)} className="quick-action">
                  <LogOut className="w-4 h-4 text-danger flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-dark-200 group-hover:text-danger">Sign Out</div>
                    <div className="text-xs text-dark-500 truncate">{user.email}</div>
                  </div>
                </button>
              )}
            </div>
          </motion.div>

          {/* Keyboard Shortcuts */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="sidebar-section"
          >
            <div className="sidebar-title text-xs">
              <span>⌨</span> Keyboard Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {[
                ['1 – 5', 'Menu items'],
                ['F1', 'Assistant'],
                ['Esc', 'Go back'],
                ['Ctrl+X', 'Exit app'],
              ].map(([key, desc]) => (
                <React.Fragment key={key}>
                  <kbd className="kbd justify-center">{key}</kbd>
                  <span className="text-dark-400 self-center">{desc}</span>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Status Bar ──────────────────────────────────────── */}
      <StatusBar projectName={projectName} />

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showExitDialog}
        onClose={() => setShowExitDialog(false)}
        onConfirm={() => window.close()}
        title="Exit Parcel Tools?"
        message="Are you sure you want to exit the application?"
        type="warning"
        confirmText="Exit"
        cancelText="Cancel"
      />
      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={async () => { await logout(); navigate('/login'); }}
        title="Sign Out"
        message={`Sign out from ${user?.email}?`}
        type="warning"
        confirmText="Sign Out"
        cancelText="Cancel"
      />
    </div>
  );
};

export default MainMenu;
