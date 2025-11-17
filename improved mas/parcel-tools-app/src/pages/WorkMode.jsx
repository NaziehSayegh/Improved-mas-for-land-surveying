import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Save, RotateCcw } from 'lucide-react';
import { getAiConfig, saveAiConfig } from '../utils/api';

const WorkMode = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    coordinateSystem: 'utm',
    units: 'metric',
    precision: 2,
    autoSave: true,
    showGrid: true,
    darkMode: true,
    notifications: true,
  });
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiKey, setAiKey] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);

  // ESC key to go back
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  React.useEffect(() => {
    (async () => {
      try {
        const cfg = await getAiConfig();
        setAiHasKey(!!cfg.hasKey);
        if (cfg.model) setAiModel(cfg.model);
      } catch {}
    })();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save settings
    alert('Settings saved successfully!');
  };

  const handleSaveAi = async () => {
    try {
      const res = await saveAiConfig({ openai_api_key: aiKey || undefined, model: aiModel });
      if (res.success) {
        setAiHasKey(!!aiKey || aiHasKey);
        alert('Assistant settings saved.');
        setAiKey('');
      } else {
        alert('Failed to save assistant settings.');
      }
    } catch (e) {
      alert('Error saving assistant settings.');
    }
  };

  const handleReset = () => {
    setSettings({
      coordinateSystem: 'utm',
      units: 'metric',
      precision: 2,
      autoSave: true,
      showGrid: true,
      darkMode: true,
      notifications: true,
    });
  };

  return (
    <div className="min-h-screen p-8 relative z-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/')}
            className="btn-secondary mb-6 flex items-center gap-2 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            ↩ MAIN MENU (Esc)
          </button>

          <div className="glass-effect rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <Settings className="w-10 h-10 text-primary" />
              <div>
                <h1 className="text-4xl font-bold gradient-text">Work Mode Settings</h1>
                <p className="text-dark-300 mt-2">Configure your survey and calculation preferences</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="space-y-8">
            {/* Assistant Settings */}
            <div>
              <h3 className="text-lg font-semibold text-dark-50 mb-3">Assistant (AI)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-300 mb-1">Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-dark-300 mb-1">OpenAI API Key</label>
                  <input
                    type="password"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder={aiHasKey ? 'Key already set (enter to replace)' : 'sk-...'}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button onClick={handleSaveAi} className="btn-secondary">Save Assistant</button>
                <span className={`text-sm ${aiHasKey ? 'text-success' : 'text-dark-400'}`}>
                  {aiHasKey ? 'Key stored' : 'No key stored (uses local docs only)'}
                </span>
              </div>
            </div>
            {/* Coordinate System */}
            <div>
              <label className="block text-lg font-semibold text-dark-50 mb-3">
                Coordinate System
              </label>
              <select
                value={settings.coordinateSystem}
                onChange={(e) => handleChange('coordinateSystem', e.target.value)}
                className="input-field w-full text-lg"
              >
                <option value="utm">UTM (Universal Transverse Mercator)</option>
                <option value="geographic">Geographic (Lat/Long)</option>
                <option value="local">Local Grid</option>
                <option value="state-plane">State Plane</option>
              </select>
            </div>

            {/* Units */}
            <div>
              <label className="block text-lg font-semibold text-dark-50 mb-3">
                Measurement Units
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleChange('units', 'metric')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.units === 'metric'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-dark-600 bg-dark-800 text-dark-300 hover:border-dark-500'
                  }`}
                >
                  <div className="text-2xl mb-2">📏</div>
                  <div className="font-semibold">Metric</div>
                  <div className="text-sm opacity-70">Meters, sq meters</div>
                </button>
                <button
                  onClick={() => handleChange('units', 'imperial')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.units === 'imperial'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-dark-600 bg-dark-800 text-dark-300 hover:border-dark-500'
                  }`}
                >
                  <div className="text-2xl mb-2">📐</div>
                  <div className="font-semibold">Imperial</div>
                  <div className="text-sm opacity-70">Feet, sq feet</div>
                </button>
              </div>
            </div>

            {/* Precision */}
            <div>
              <label className="block text-lg font-semibold text-dark-50 mb-3">
                Decimal Precision: {settings.precision} digits
              </label>
              <input
                type="range"
                min="0"
                max="8"
                value={settings.precision}
                onChange={(e) => handleChange('precision', parseInt(e.target.value))}
                className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-dark-400 text-sm mt-2">
                <span>0</span>
                <span>2</span>
                <span>4</span>
                <span>6</span>
                <span>8</span>
              </div>
            </div>

            {/* Toggle Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-dark-50 mb-4">Display Options</h3>
              
              {[
                { key: 'autoSave', label: 'Auto-save changes', icon: '💾' },
                { key: 'showGrid', label: 'Show grid lines', icon: '📊' },
                { key: 'darkMode', label: 'Dark mode', icon: '🌙' },
                { key: 'notifications', label: 'Enable notifications', icon: '🔔' },
              ].map((option) => (
                <div
                  key={option.key}
                  className="glass-effect rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{option.icon}</span>
                    <span className="text-dark-50 font-medium">{option.label}</span>
                  </div>
                  <button
                    onClick={() => handleChange(option.key, !settings[option.key])}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      settings[option.key] ? 'bg-primary' : 'bg-dark-600'
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
                      animate={{ left: settings[option.key] ? '32px' : '4px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-dark-600">
            <button
              onClick={handleSave}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Settings
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 glass-effect rounded-lg p-4"
        >
          <p className="text-dark-400 text-sm">
            💡 <span className="text-primary font-semibold">Tip:</span> These settings will apply to all calculations and affect how data is displayed and exported.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default WorkMode;


