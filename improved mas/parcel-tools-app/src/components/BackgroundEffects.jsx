import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';

const BackgroundEffects = () => {
  // Reduce animated elements for performance
  const icons = ['🧭', '📐'];
  const [dimensions, setDimensions] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1920, height: typeof window !== 'undefined' ? window.innerHeight : 1080 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate stable icon positions based on dimensions
  const iconPositions = useMemo(() => {
    return icons.map((icon, index) => {
      const seed = index * 137.508; // Golden angle for good distribution
      const initialX = (Math.sin(seed) * 0.4 + 0.5) * dimensions.width;
      const initialY = (Math.cos(seed) * 0.4 + 0.5) * dimensions.height;
      const waypoint1X = (Math.sin(seed + 1) * 0.4 + 0.5) * dimensions.width;
      const waypoint1Y = (Math.cos(seed + 1) * 0.4 + 0.5) * dimensions.height;
      const waypoint2X = (Math.sin(seed + 2) * 0.4 + 0.5) * dimensions.width;
      const waypoint2Y = (Math.cos(seed + 2) * 0.4 + 0.5) * dimensions.height;
      
      return {
        initial: { x: initialX, y: initialY },
        waypoints: {
          x: [initialX, waypoint1X, waypoint2X, initialX],
          y: [initialY, waypoint1Y, waypoint2Y, initialY],
        },
      };
    });
  }, [dimensions.width, dimensions.height]);

  return (
    <div className="floating-bg w-full h-full overflow-hidden">
      {/* Keep only two very light animated circles */}
      <motion.div
        className="blur-circle bg-primary-500 w-64 h-64 -top-24 -left-24"
        animate={{ scale: [1, 1.05, 1], opacity: [0.08, 0.12, 0.08] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="blur-circle bg-blue-400 w-64 h-64 top-1/2 -right-24"
        animate={{ scale: [1, 1.05, 1], opacity: [0.06, 0.1, 0.06] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Minimal floating icons (2) with very slow movement */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {icons.map((icon, index) => {
          const positions = iconPositions[index];
          return (
            <motion.div
              key={index}
              className="absolute text-3xl pointer-events-none"
              initial={positions.initial}
              animate={{ x: positions.waypoints.x, y: positions.waypoints.y }}
              transition={{ duration: 40 + index * 10, repeat: Infinity, ease: "linear" }}
            >
              {icon}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BackgroundEffects;


