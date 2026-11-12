import React from 'react';

/**
 * Catches a crash while drawing any screen and shows a message with a way back,
 * instead of leaving the whole window black. The open project stays in memory
 * when the user chooses "Try again".
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Screen crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full w-full flex items-center justify-center bg-dark-900 text-white p-6">
        <div className="max-w-lg w-full bg-dark-800 border border-dark-600 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold mb-2">Something went wrong on this screen</h2>
          <p className="text-dark-300 text-sm mb-4">
            Your project is still open. Try again, or reload the app if the problem repeats.
          </p>
          <pre className="text-left text-xs text-red-300 bg-dark-900 border border-dark-700 rounded p-3 mb-4 overflow-auto max-h-32 whitespace-pre-wrap">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="flex gap-3 justify-center">
            <button onClick={() => this.setState({ error: null })} className="btn-primary py-2 px-4 text-sm">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-secondary py-2 px-4 text-sm">
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
