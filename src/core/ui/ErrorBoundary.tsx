import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getLogger } from '../log/logger';

const log = getLogger('ui');

/**
 * Catches render errors anywhere below it, logs them, and shows a friendly
 * recovery screen instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('render crashed', { error, componentStack: info.componentStack?.split('\n').slice(0, 10).join('\n') });
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <main className="screen__body" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h1>Oops — something broke</h1>
          <p className="muted">It has been logged. Grown-ups can find details under Data → Diagnostics.</p>
          <button type="button" className="btn btn--primary btn--big" onClick={this.reset} autoFocus>
            Back to start
          </button>
        </main>
      </div>
    );
  }
}
