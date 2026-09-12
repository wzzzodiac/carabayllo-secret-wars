export const BACKEND_URL = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname)
  ? 'http://127.0.0.1:3000'
  : 'https://orbital-artillery-server-git-873648916633.us-east1.run.app';

export const CLIENT_CONFIG = Object.freeze({
  maxPlayers: 8,
  internalWidth: 1600,
  internalHeight: 900
});
