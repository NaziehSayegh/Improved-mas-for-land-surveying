import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Save, RotateCcw, Bot, Globe, Ruler, Check } from 'lucide-react';
import { getAiConfig, saveAiConfig } from '../utils/api';
import { useToast } from '../context/ToastContext';
import PageLayout from '../components/PageLayout';

const SETTINGS_KEY = 'parceltools_work_settings';

const loadSettings = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { coordinateSystem: 'utm', units: 'metric', precision: 2 };
};

const TABS = [
  { id: 'survey', label: 'Survey', icon: <Globe className="w-4 h-4" /> },
  { id: 'display', label: 'Display', icon: <Ruler className="w-4 h-4" /> },
  { id: 'assistant', label: 'Assistant', icon: <Bot className="w-4 h-4" /> },
];

const WorkMode = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('survey');
  const [settings, setSettings] = useState(loadSettings);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiKey, setAiKey] = useState('');
  const [aiHasKey, setAiHasKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // ESC to go back
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') navigate('/'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getAiConfig();
        setAiHasKey(!!cfg.hasKey);
        if (cfg.model) setAiModel(cfg.model);
      } catch {}
    })();
  }, []);

  const handleChange = (key, value) => {
    setSaved(false);
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    toast.success('Settings saved!');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    const defaults = { coordinateSystem: 'utm', units: 'metric', precision: 2 };
    setSettings(defaults);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults));
    toast.info('Settings reset to defaults.');
  };

  const handleSaveAi = async () => {
    try {
      const res = await saveAiConfig({ openai_api_key: aiKey || undefined, model: aiModel });
      if (res.success) {
        setAiHasKey(!!aiKey || aiHasKey);
        toast.success('Assistant settings saved.');
        setAiKey('');
      } else {
        toast.error('Failed to save assistant settings.');
      }
    } catch {
      toast.error('Error saving assistant settings.');
    }
  };

  return (
    <PageLayout title="Work Mode Settings" backPath="/" backLabel="Main Menu">
      <div className="h-full flex gap-4 p-4 overflow-hidden">

        {/* ── Left: Settings Panel ─────────────────────────── */}
        <div className="flex-1 flex flex-col glass rounded-xl overflow-hidden min-w-0">
          {/* Tab Bar */}
          <div className="flex border-b border-dark-700/60 px-4 pt-3 gap-1 flex-shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium
                            transition-all duration-150 -mb-px border-b-2
                            ${activeTab === tab.id
                              ? 'border-primary text-primary bg-primary/5'
                              : 'border-transparent text-dark-400 hover:text-dark-200 hover:bg-dark-700/40'
                            }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-5">

            {/* ── Survey Settings ─────────────────────── */}
            {activeTab === 'survey' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-lg"
              >
                <div>
                  <label className="block text-sm font-semibold text-dark-200 mb-2">
                    Coordinate System
                  </label>
                  <p className="text-xs text-dark-500 mb-3">
                    Choose the spatial reference system for your survey data.
                  </p>
                  <select
                    value={settings.coordinateSystem}
                    onChange={(e) => handleChange('coordinateSystem', e.target.value)}
                    className="input-field"
                  >
                    <option value="utm">UTM — Universal Transverse Mercator</option>
                    <option value="geographic">Geographic — Latitude / Longitude</option>
                    <option value="local">Local Grid</option>
                    <option value="state-plane">State Plane</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-200 mb-2">
                    Measurement Units
                  </label>
                  <p className="text-xs text-dark-500 mb-3">
                    Applies to distances and area calculations.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'metric', label: 'Metric', sub: 'Meters, m²', icon: '📏' },
                      { value: 'imperial', label: 'Imperial', sub: 'Feet, ft²', icon: '📐' },
                    ].map(u => (
                      <button
                        key={u.value}
                        onClick={() => handleChange('units', u.value)}
                        className={`p-4 rounded-xl border-2 transition-all text-left
                          ${settings.units === u.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-dark-600 bg-dark-700/50 text-dark-300 hover:border-dark-500'
                          }`}
                      >
                        <div className="text-2xl mb-1.5">{u.icon}</div>
                        <div className="font-semibold text-sm">{u.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{u.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Display Settings ────────────────────── */}
            {activeTab === 'display' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 max-w-lg"
              >
                <div>
                  <label className="block text-sm font-semibold text-dark-200 mb-1">
                    Decimal Precision
                    <span className="ml-2 text-primary font-bold">{settings.precision} digits</span>
                  </label>
                  <p className="text-xs text-dark-500 mb-3">
                    Number of decimal places in calculated values and exports.
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={settings.precision}
                    onChange={(e) => handleChange('precision', parseInt(e.target.value))}
                    className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-dark-500 text-xs mt-2 px-0.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <span key={n} className={settings.precision === n ? 'text-primary font-bold' : ''}>{n}</span>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-dark-700/40 rounded-lg text-xs text-dark-400">
                    Example: <span className="font-mono text-dark-200">
                      {(1234.56789).toFixed(settings.precision)}
                    </span> m
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Assistant Settings ───────────────────── */}
            {activeTab === 'assistant' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5 max-w-lg"
              >
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-xs text-dark-300">
                  <p>
                    The AI assistant uses your OpenAI API key to answer surveying questions.
                    Without a key, it uses built-in local documentation only.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-200 mb-2">AI Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="input-field"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (Fast, cheap)</option>
                    <option value="gpt-4o">gpt-4o (Best quality)</option>
                    <option value="o1-mini">o1-mini (Reasoning)</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-200 mb-2">
                    OpenAI API Key
                    {aiHasKey && (
                      <span className="ml-2 text-xs text-green-400 font-normal flex items-center gap-1 inline-flex">
                        <Check className="w-3 h-3" /> Key stored
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    placeholder={aiHasKey ? '••••••••• (key stored — enter to replace)' : 'sk-...'}
                    className="input-field font-mono text-sm"
                  />
                </div>

                <button onClick={handleSaveAi} className="btn-secondary text-sm">
                  <Save className="w-4 h-4" /> Save Assistant Settings
                </button>
              </motion.div>
            )}
          </div>

          {/* Action bar at bottom of card */}
          <div className="border-t border-dark-700/60 px-5 py-3 flex items-center gap-3 flex-shrink-0 bg-dark-800/40">
            <button onClick={handleSave} className="btn-primary text-sm">
              {saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Settings</>
              )}
            </button>
            <button onClick={handleReset} className="btn-secondary text-sm">
              <RotateCcw className="w-4 h-4" /> Reset Defaults
            </button>
          </div>
        </div>

        {/* ── Right: Info Panel ────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-4 overflow-y-auto no-scrollbar">
          <div className="glass rounded-xl p-5 flex-1">
            <div className="sidebar-title">
              <Settings className="w-3.5 h-3.5" />
              About Settings
            </div>
            <ul className="space-y-3 text-xs text-dark-400">
              <li className="flex gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">①</span>
                <span>Settings are saved to this device and persist between sessions.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">②</span>
                <span>The <strong className="text-dark-200">coordinate system</strong> affects how DXF/DWG files are parsed.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">③</span>
                <span>Changing <strong className="text-dark-200">precision</strong> affects display and exported PDFs.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary mt-0.5 flex-shrink-0">④</span>
                <span>The <strong className="text-dark-200">AI assistant</strong> key is stored securely on this device only.</span>
              </li>
            </ul>
          </div>

          <div className="glass rounded-xl p-4">
            <p className="text-xs text-dark-400 flex items-start gap-2">
              <span className="text-yellow-400 flex-shrink-0">💡</span>
              Press <kbd className="kbd mx-1">Esc</kbd> to return to the main menu without saving.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default WorkMode;
