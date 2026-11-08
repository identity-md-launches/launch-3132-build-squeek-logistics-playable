import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react';

export function GameErrorScreen() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="game-fallback" aria-labelledby="failure-title">
    <a className="fallback-brand" href="./">Squeek Logistics</a>
    <div role="alert">
      <h1 id="failure-title" ref={heading} tabIndex={-1}>The outpost could not open</h1>
      <p>Reload to try again. Any existing browser save will be kept.</p>
    </div>
    <button className="button primary" onClick={() => window.location.reload()}>Reload game</button>
    <p className="subtle">If this keeps happening, try again later. Avoid clearing browser data unless you have a save backup.</p>
  </main>;
}

export class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Squeek Logistics] Game rendering failed.', error, info.componentStack);
  }

  render() { return this.state.failed ? <GameErrorScreen /> : this.props.children; }
}
