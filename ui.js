export function createUI() {
  const clientStatus = document.getElementById('clientStatus');
  const serverStatus = document.getElementById('serverStatus');

  return Object.freeze({
    setClientStatus(value) {
      clientStatus.textContent = value;
    },
    setServerStatus(value) {
      serverStatus.textContent = value;
    }
  });
}
