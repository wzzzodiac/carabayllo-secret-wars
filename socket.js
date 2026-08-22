import { BACKEND_URL } from './config.js';

// Phase 0 boundary only. Socket.IO will be wired during the networking milestone.
export function createSocketBoundary() {
  return Object.freeze({
    endpoint: BACKEND_URL,
    isConfigured: Boolean(BACKEND_URL),
    connect() {
      throw new Error('Networking is not implemented in Phase 0.');
    }
  });
}
