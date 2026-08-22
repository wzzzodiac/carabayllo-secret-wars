import { BACKEND_URL } from './config.js';

let socketPromise = null;

async function loadSocketIO() {
  const module = await import('https://cdn.socket.io/4.8.1/socket.io.esm.min.js');
  return module.io;
}

export function createSocketBoundary() {
  let socket = null;

  return Object.freeze({
    endpoint: BACKEND_URL,
    isConfigured: Boolean(BACKEND_URL),
    get isConnected() {
      return Boolean(socket?.connected);
    },
    async connect() {
      if (!BACKEND_URL) {
        throw new Error('Backend URL is not configured.');
      }

      if (socket?.connected) return socket;

      if (!socketPromise) {
        socketPromise = loadSocketIO().then(io => {
          socket = io(BACKEND_URL, {
            autoConnect: false,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 3,
            timeout: 8_000
          });

          socket.on('disconnect', () => {
            socketPromise = null;
          });

          socket.connect();
          return socket;
        }).catch(error => {
          socketPromise = null;
          throw error;
        });
      }

      return socketPromise;
    },
    disconnect() {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      socketPromise = null;
    }
  });
}
