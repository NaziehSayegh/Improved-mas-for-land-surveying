import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, MapPin, Ruler, Satellite } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Compass className="w-12 h-12" />,
      title: "Precise Measurements",
      description: "Calculate parcel areas with professional accuracy"
    },
    {
      icon: <MapPin className="w-12 h-12" />,
      title: "Point Management",
      description: "Import and manage survey points effortlessly"
    },
    {
      icon: <Ruler className="w-12 h-12" />,
      title: "Advanced Tools",
      description: "Professional surveying tools for all your needs"
    },
    {
      icon: <Satellite className="w-12 h-12" />,
      title: "Modern Technology",
      description: "Built with cutting-edge technology stack"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-8xl mb-6 animated-icon inline-block"
        >
          📐
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-7xl font-bold mb-4"
        >
          <span className="gradient-text">Parcel Tools</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-2xl text-dark-300 mb-2"
        >
          Professional Surveying & Mapping Software
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="inline-block px-4 py-2 bg-success-dark/20 border border-success rounded-full"
        >
          <span className="text-success font-semibold">v2.0 Premium</span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="mb-12"
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary text-xl px-12 py-4 shadow-glow hover:shadow-glow-lg group"
        >
          <span className="flex items-center gap-3">
            Get Started
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </span>
        </button>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full"
      >
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 + index * 0.1 }}
            whileHover={{ scale: 1.05 }}
            className="card text-center group cursor-pointer"
          >
            <div className="text-primary mb-4 flex justify-center animated-icon">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold mb-2 text-dark-50 group-hover:text-primary transition-colors">
              {feature.title}
            </h3>
            <p className="text-dark-300 text-sm">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Animated Grid Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#58a6ff 1px, transparent 1px), linear-gradient(90deg, #58a6ff 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>
    </div>
  );
};

export default LandingPage;


