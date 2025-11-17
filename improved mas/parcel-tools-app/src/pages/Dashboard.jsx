import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calculator,
  FolderOpen,
  Settings,
  FileText,
  Map,
  BarChart3,
  Database,
  Zap,
  ArrowLeft
} from 'lucide-react';
import RecentFiles from '../components/RecentFiles';

const Dashboard = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      id: 1,
      title: "Parcel Calculator",
      description: "Calculate parcel areas and measurements",
      icon: <Calculator className="w-10 h-10" />,
      color: "from-blue-500 to-blue-600",
      path: "/parcel-calculator"
    },
    {
      id: 2,
      title: "Data Files",
      description: "Manage projects and point data",
      icon: <FolderOpen className="w-10 h-10" />,
      color: "from-purple-500 to-purple-600",
      path: "/data-files"
    },
    {
      id: 3,
      title: "Work Mode",
      description: "Configure survey settings",
      icon: <Settings className="w-10 h-10" />,
      color: "from-green-500 to-green-600",
      path: "/work-mode"
    },
    {
      id: 4,
      title: "Reports",
      description: "Generate professional reports",
      icon: <FileText className="w-10 h-10" />,
      color: "from-orange-500 to-orange-600",
      path: "#"
    },
    {
      id: 5,
      title: "Map View",
      description: "Visualize parcels on map",
      icon: <Map className="w-10 h-10" />,
      color: "from-cyan-500 to-cyan-600",
      path: "#"
    },
    {
      id: 6,
      title: "Analytics",
      description: "View statistics and insights",
      icon: <BarChart3 className="w-10 h-10" />,
      color: "from-pink-500 to-pink-600",
      path: "#"
    },
    {
      id: 7,
      title: "Database",
      description: "Manage database connections",
      icon: <Database className="w-10 h-10" />,
      color: "from-yellow-500 to-yellow-600",
      path: "#"
    },
    {
      id: 8,
      title: "Quick Actions",
      description: "Fast access to common tasks",
      icon: <Zap className="w-10 h-10" />,
      color: "from-red-500 to-red-600",
      path: "#"
    }
  ];

  return (
    <div className="min-h-screen p-8 relative z-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-12"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary flex items-center gap-2 group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
            <div>
              <h1 className="text-5xl font-bold gradient-text mb-2">Main Menu</h1>
              <p className="text-dark-300 text-lg">Choose a tool to get started</p>
            </div>
          </div>
          
          <div className="glass-effect px-6 py-3 rounded-lg">
            <p className="text-dark-300 text-sm mb-1">Quick Access</p>
            <p className="text-primary font-semibold">Press 1-8 for shortcuts</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Projects", value: "12", icon: "📁" },
            { label: "Total Points", value: "1,247", icon: "📍" },
            { label: "Calculations", value: "89", icon: "📊" },
            { label: "Reports", value: "34", icon: "📄" }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="glass-effect rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-400 text-sm mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-dark-50">{stat.value}</p>
                </div>
                <span className="text-3xl">{stat.icon}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Files Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <RecentFiles />
        </motion.div>
      </motion.div>

      {/* Menu Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {menuItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => item.path !== '#' && navigate(item.path)}
            className="card cursor-pointer group relative overflow-hidden"
          >
            {/* Gradient Background on Hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            {/* Shortcut Number */}
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-dark-400 font-bold text-sm group-hover:bg-primary group-hover:text-white transition-all">
              {item.id}
            </div>

            <div className="relative z-10">
              <div className={`text-primary mb-4 animated-icon bg-gradient-to-br ${item.color} bg-clip-text text-transparent`}>
                {item.icon}
              </div>
              <h3 className="text-xl font-bold mb-2 text-dark-50 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-dark-300 text-sm mb-4">
                {item.description}
              </p>
              <div className="flex items-center text-primary text-sm font-semibold group-hover:gap-2 transition-all">
                Open
                <motion.span
                  className="ml-1 inline-block"
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Footer Help */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="max-w-7xl mx-auto mt-12 text-center"
      >
        <p className="text-dark-400 text-sm">
          Press <kbd className="px-2 py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary">F11</kbd> for fullscreen
          {' • '}
          <kbd className="px-2 py-1 bg-dark-800 rounded border border-dark-600 font-mono text-primary">Esc</kbd> to go back
        </p>
      </motion.div>
    </div>
  );
};

export default Dashboard;


