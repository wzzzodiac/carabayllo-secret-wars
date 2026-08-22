import { CLIENT_CONFIG } from './config.js';
import { createSocketBoundary } from './socket.js';
import { createRenderer } from './renderer.js';
import { createUI } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ui = createUI();
const renderer = createRenderer(canvas, CLIENT_CONFIG);
const socket = createSocketBoundary();

renderer.drawScaffold();
ui.setClientStatus('READY');
ui.setServerStatus(socket.isConfigured ? 'CONFIGURED / OFFLINE' : 'NOT CONFIGURED');

console.info('Orbital Artillery client scaffold ready.', {
  maxPlayers: CLIENT_CONFIG.maxPlayers,
  serverConfigured: socket.isConfigured
});
