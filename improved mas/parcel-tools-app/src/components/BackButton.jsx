import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * The one "back to the main menu" button used on every page, so it looks and reads the same everywhere.
 * (Pages handle the Esc key themselves; the "(Esc)" hint is only a label.)
 */
export default function BackButton({ onClick, label = 'Main Menu', hint = true, compact = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}${hint ? ' (Esc)' : ''}`}
      className={`btn-ghost py-1.5 px-3 text-sm flex-shrink-0 group border border-dark-700/60 ${className}`}
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      <span className={compact ? 'hidden sm:inline' : ''}>{label}</span>
      {hint && <span className="ml-0.5 text-dark-500 text-xs hidden md:inline">(Esc)</span>}
    </button>
  );
}
