// Future audio subsystem boundary.
// Keep sounds client-side; authoritative gameplay never depends on audio timing.
export function createAudioSystem() {
  return Object.freeze({
    enabled: true,
    play() {}
  });
}
