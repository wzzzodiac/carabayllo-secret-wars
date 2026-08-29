# Orbital Artillery v0.9.5 soundtrack

Selected soundtrack assets:

- `sports-opener-590001.mp3` — **Sports Opener**, AtlasAudio — lobby / countdown / post-match
  - Source: https://pixabay.com/music/rock-sports-opener-590001/
- `dark-571483.mp3` — **Dark**, AudioCopper — early match, turns 1–8; fades to silence during turn 9
  - Source: https://pixabay.com/music/action-dark-571483/
- `adrenaline-576557.mp3` — **Adrenaline - Adrenaline Music**, The_Mountain — turn 10+ until the round ends
  - Source: https://pixabay.com/music/action-adrenaline-adrenaline-music-576557/

All three source pages identify the tracks as free for use under the Pixabay Content License. Pixabay's license permits using and adapting Content as part of a larger creative work; standalone redistribution of the Content is restricted. Source/license details are retained here even though attribution is not required by the Pixabay Content License.

## Transition contract

- every track enters with a fade-in
- when changing tracks, outgoing and incoming audio use independent ramps for a real crossfade
- every loop fades out near the end, restarts cleanly, then fades back in
- turn 9 uses a longer fade from the early-game track to silence
- turn 10 fades in the late-game track
- match end crossfades back to lobby music
- music volume is controlled locally from 0–100 and persisted in the browser
- browser autoplay rules are respected: playback unlocks after the player's first pointer or keyboard interaction

## Asset status

`music.js` expects the three files above under this directory. If an asset is unavailable, the legacy generated synth remains as a fail-safe rather than breaking game audio.
