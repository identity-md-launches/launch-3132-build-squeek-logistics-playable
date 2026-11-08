import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameErrorBoundary, GameErrorScreen } from './GameErrorBoundary';
import './style.css';

const container = document.getElementById('root')!;
const root = createRoot(container);
let failed = false;
function fail(error: unknown) {
  failed = true;
  console.error('[Squeek Logistics] Game startup or runtime failed.', error);
  root.render(<GameErrorScreen />);
}

// React boundaries cover rendering/effects; these also cover uncaught timer,
// event-handler and promise failures. Keep the actual error in the console.
window.addEventListener('error', event => { if (event.error) fail(event.error); });
window.addEventListener('unhandledrejection', event => fail(event.reason));

// Import after recovery handlers are installed: a failing dependency or missing
// application chunk can now produce a useful screen before App ever mounts.
void import('./App').then(({ default: App }) => {
  if (!failed) root.render(<React.StrictMode><GameErrorBoundary><App /></GameErrorBoundary></React.StrictMode>);
}).catch(fail);
