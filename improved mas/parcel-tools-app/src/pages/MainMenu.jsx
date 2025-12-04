import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProject } from '../context/ProjectContext';

const MainMenu = () => {
  const navigate = useNavigate();
  const { savedParcels, projectName } = useProject();

  // Menu options - renumbered to 1-4 for better layout
  const menuOptionsLeft = [
    { num: 1, icon: '⚙️', label: 'WORK MODE', path: '/work-mode', description: 'Configure survey settings' },
    { num: 3, icon: '📊', label: 'PLOTTING', path: '/plotting', description: 'Visualize points in real coordinates' },
  ];

  const menuOptionsRight = [
    { num: 2, icon: '📁', label: 'DATA FILES', path: '/data-files', description: 'Manage projects and points' },
    { num: 4, icon: '📐', label: 'AREA CALCULATOR', path: '/parcel-calculator', description: 'Calculate parcel areas' },
  ];

  const handleSelect = (path, num) => {
    if (path !== '#') {
      navigate(path);
    } else {
      alert(`Feature ${num} coming soon!`);
    }
  };

  const [licenseStatus, setLicenseStatus] = React.useState(null);

  useEffect(() => {
    // Check license status
    fetch('http://127.0.0.1:5000/api/license/status')
      .then(res => res.json())
      .then(data => setLicenseStatus(data))
      .catch(err => console.error('License check failed:', err));
  }, []);

  // Keyboard shortcuts 0-9 and Ctrl+X
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('/assistant');
        return;
      }
      // Ctrl+X to exit
      if (e.ctrlKey && e.key === 'x') {
        if (window.confirm('Exit Parcel Tools?')) {
          window.close();
        }
        return;
      }

      // Number keys 0-9
      const key = e.key;
      if (key >= '0' && key <= '9') {
        const num = parseInt(key);
        const allOptions = [...menuOptionsLeft, ...menuOptionsRight];
        const option = allOptions.find(opt => opt.num === num);
        if (option) {
          handleSelect(option.path, option.num);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 p-4 sm:p-6 md:p-8">
      {/* Header - Responsive */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4 sm:mb-6 md:mb-8"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3">
          <span className="text-primary">📐 PARCEL TOOLS</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-dark-300">Professional Surveying & Mapping Software</p>
        <p className="text-sm text-dark-400 mt-1">Developed by <span className="text-primary font-semibold">Nazieh Sayegh</span></p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <span className="px-2 sm:px-3 py-1 bg-success-dark/20 border border-success rounded-full text-success text-xs sm:text-sm font-semibold">
            v2.0 Premium
          </span>

          {/* License Status Badge */}
          {licenseStatus && (
            <>
              {licenseStatus.status === 'activated' ? (
                <span className="px-2 sm:px-3 py-1 bg-green-500/20 border border-green-500 rounded-full text-green-400 text-xs sm:text-sm font-semibold flex items-center gap-1">
                  ✅ Licensed
                </span>
              ) : licenseStatus.status === 'trial' ? (
                <span className="px-2 sm:px-3 py-1 bg-yellow-500/20 border border-yellow-500 rounded-full text-yellow-400 text-xs sm:text-sm font-semibold flex items-center gap-1">
                  ⏳ Trial: {licenseStatus.days_left} Days Left
                </span>
              ) : (
                <span className="px-2 sm:px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-red-400 text-xs sm:text-sm font-semibold flex items-center gap-1 cursor-pointer hover:bg-red-500/30" onClick={() => navigate('/license')}>
                  ⚠️ Unlicensed
                </span>
              )}
            </>
          )}

          {projectName && (
            <span className="px-2 sm:px-3 py-1 bg-primary/20 border border-primary rounded-full text-primary text-xs sm:text-sm font-semibold">
              📁 {projectName}
            </span>
          )}
        </div>
        <div className="mt-3 sm:mt-4 flex justify-center gap-3">
          <button
            onClick={() => navigate('/assistant')}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-primary rounded-lg text-dark-100 text-sm sm:text-base transition-all"
            title="Open Assistant (F1)"
          >
            ❓ Help / Assistant (F1)
          </button>
          <button
            onClick={async () => {
              const { handleQuickSaveAs } = await import('../utils/quickSave');
              await handleQuickSaveAs();
            }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary-dark border border-primary rounded-lg text-white text-sm sm:text-base transition-all font-semibold"
            title="Save Project As"
          >
            💾 Save Project As
          </button>
        </div>
      </motion.div>

      {/* Main Content Grid - Fully Responsive */}
      <div className="flex-1 w-full max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 md:gap-6">
        {/* Main Menu - Responsive */}
        <div className="col-span-1 lg:col-span-8 xl:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 h-full">
            {/* All menu items in one grid */}
            {[...menuOptionsLeft, ...menuOptionsRight]
              .sort((a, b) => a.num - b.num)
              .map((option, index) => (
                <motion.button
                  key={option.num}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  onClick={() => handleSelect(option.path, option.num)}
                  className="w-full bg-dark-800 hover:bg-dark-700 border-2 border-dark-600 hover:border-primary 
                           text-dark-50 font-semibold text-base sm:text-lg md:text-xl py-6 sm:py-7 md:py-8 px-4 sm:px-5 md:px-6 rounded-xl
                           transition-all duration-300 transform hover:scale-[1.02] hover:shadow-glow
                           active:scale-98 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 group 
                           min-h-[120px] sm:min-h-[140px] md:min-h-[160px]"
                >
                  <span className="text-4xl sm:text-5xl md:text-6xl group-hover:scale-110 transition-transform flex-shrink-0">{option.icon}</span>
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-primary font-bold text-xl sm:text-2xl md:text-3xl">{option.num}</span>
                      <span className="text-lg sm:text-xl md:text-2xl">{option.label}</span>
                    </div>
                    <p className="text-dark-400 text-xs sm:text-sm md:text-base mt-1 sm:mt-2">{option.description}</p>
                  </div>
                </motion.button>
              ))}
          </div>
        </div>

        {/* Right Sidebar - Responsive */}
        <div className="col-span-1 lg:col-span-4 xl:col-span-4 space-y-4 sm:space-y-5 md:space-y-6">
          {/* Quick Stats - Responsive */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-800 border-2 border-dark-600 rounded-xl p-4 sm:p-5 md:p-6"
          >
            <h2 className="text-lg sm:text-xl font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
              📊 Quick Stats
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm sm:text-base">Saved Parcels:</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-bold text-success">{savedParcels?.length || 0}</span>
              </div>
              <div className="h-px bg-dark-600"></div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300 text-sm sm:text-base">Active Project:</span>
                <span className="text-primary font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{projectName || 'None'}</span>
              </div>
              {savedParcels && savedParcels.length > 0 && (
                <>
                  <div className="h-px bg-dark-600"></div>
                  <div className="pt-2">
                    <p className="text-dark-400 text-xs sm:text-sm mb-1 sm:mb-2">Total Area:</p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
                      {savedParcels.reduce((sum, p) => sum + (p.area || 0), 0).toFixed(2)} m²
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Quick Actions - Responsive */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-dark-800 border-2 border-dark-600 rounded-xl p-4 sm:p-5 md:p-6"
          >
            <h2 className="text-lg sm:text-xl font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
              ⚡ Quick Actions
            </h2>
            <div className="space-y-2 sm:space-y-3">
              <button
                onClick={() => navigate('/parcel-calculator')}
                className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg p-2.5 sm:p-3 text-left transition-all group"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl md:text-2xl">📐</span>
                  <span className="text-dark-100 font-semibold text-sm sm:text-base group-hover:text-primary">New Parcel</span>
                </div>
              </button>
              <button
                onClick={() => navigate('/data-files')}
                className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg p-2.5 sm:p-3 text-left transition-all group"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl md:text-2xl">📁</span>
                  <span className="text-dark-100 font-semibold text-sm sm:text-base group-hover:text-primary">Open Project</span>
                </div>
              </button>
              <button
                onClick={() => navigate('/assistant')}
                className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg p-2.5 sm:p-3 text-left transition-all group"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl md:text-2xl">❓</span>
                  <span className="text-dark-100 font-semibold text-sm sm:text-base group-hover:text-primary">Get Help</span>
                </div>
              </button>
              <button
                onClick={() => navigate('/license')}
                className="w-full bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/50 rounded-lg p-2.5 sm:p-3 text-left transition-all group"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl md:text-2xl">🔑</span>
                  <span className="text-dark-100 font-semibold text-sm sm:text-base group-hover:text-yellow-400">License</span>
                </div>
              </button>
            </div>
          </motion.div>

          {/* Keyboard Shortcuts - Responsive */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-dark-800 border-2 border-dark-600 rounded-xl p-4 sm:p-5 md:p-6"
          >
            <h2 className="text-lg sm:text-xl font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
              ⌨️ Shortcuts
            </h2>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-300">1-4</span>
                <span className="text-dark-100">Menu Items</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300">F1</span>
                <span className="text-dark-100">Assistant</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300">F11</span>
                <span className="text-dark-100">Fullscreen</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-300">Ctrl+X</span>
                <span className="text-dark-100">Exit</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer - Responsive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 sm:mt-6 md:mt-8 text-center text-dark-400 text-xs sm:text-sm space-y-1 sm:space-y-2 px-2"
      >
        <p className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          Press{' '}
          <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary text-xs sm:text-sm">1</kbd>,
          <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary text-xs sm:text-sm">2</kbd>,
          <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary text-xs sm:text-sm">3</kbd>, or
          <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary text-xs sm:text-sm">4</kbd> for quick access
        </p>
        <p className="text-dark-500 text-xs sm:text-sm">
          Professional Surveying Tools • Powered by React & Python
        </p>
        <p className="text-dark-600 text-xs mt-1">
          © 2024 Nazieh Sayegh • All Rights Reserved
        </p>
      </motion.div>
    </div>
  );
};

export default MainMenu;

