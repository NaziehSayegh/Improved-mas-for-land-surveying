import React from 'react';

const TitleBar = () => {
  return (
    <div 
      className="h-8 bg-dark-900 border-b border-dark-700/60 flex items-center justify-between px-4 select-none flex-shrink-0 z-[9999]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">📐</span>
        <span className="text-xs font-semibold text-dark-300 tracking-wide">
          Parcel Tools - Professional Surveying Software
        </span>
      </div>
      {/* Spacer to keep the right-hand side clear for native overlay window controls */}
      <div className="w-[150px]" style={{ WebkitAppRegion: 'no-drag' }} />
    </div>
  );
};

export default TitleBar;
