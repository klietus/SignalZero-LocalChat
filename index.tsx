import { Buffer } from 'buffer';
// @ts-ignore
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { logger } from './services/logger';

// Global Error Logging
window.addEventListener('error', (event) => {
    logger.error('GLOBAL_ERROR', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
    });
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('UNHANDLED_REJECTION', event.reason?.message || 'Unknown reason', event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
