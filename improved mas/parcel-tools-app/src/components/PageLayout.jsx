import React from 'react';
import { useNavigate } from 'react-router-dom';
import LicenseBadge from './LicenseBadge';
import BackButton from './BackButton';

/**
 * PageLayout — universal zero-scroll page wrapper.
 *
 * Props:
 *   title        string   — page title shown in top bar
 *   backPath     string   — where the back button goes (default '/')
 *   backLabel    string   — back button label (default 'Main Menu')
 *   headerRight  ReactNode — optional extra content in top-right of header
 *   showLicense  bool     — show the license badge in top bar (default true)
 *   footer       ReactNode — optional footer slot (replaces default nothing)
 *   children     ReactNode — page body (must handle its own overflow if needed)
 *   className    string   — extra classes for content area
 */
const PageLayout = ({
  title,
  backPath = '/',
  backLabel = 'Main Menu',
  headerRight,
  showLicense = true,
  footer,
  children,
  className = '',
  onBack,
}) => {
  const navigate = useNavigate();

  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      navigate(backPath);
    }
  }, [onBack, navigate, backPath]);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Skip if there's a visible dialog or modal open
        const openDialog = document.querySelector('[role="dialog"], .modal, .dialog, .confirm-dialog');
        if (openDialog) return;

        // Blur active text fields instead of navigating away
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          document.activeElement.blur();
          return;
        }

        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBack]);

  return (
    <div className="page-container">
      {/* ── Top Bar ───────────────────────────────────────────── */}
      <header className="page-topbar">
        <BackButton onClick={handleBack} label={backLabel} compact />

        {title && (
          <h1 className="text-base font-bold text-dark-100 flex-1 truncate">{title}</h1>
        )}

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          {showLicense && <LicenseBadge />}
          {headerRight}
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────── */}
      <main className={`page-content ${className}`}>
        {children}
      </main>

      {/* ── Footer slot ───────────────────────────────────────── */}
      {footer && footer}
    </div>
  );
};

export default PageLayout;
