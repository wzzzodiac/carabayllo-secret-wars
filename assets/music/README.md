# Orbital Artillery v0.9.5 soundtrack assets

Expected local files:

- `sports-opener-590001.mp3` — lobby / post-match
- `dark-571483.mp3` — early match, turns 1–8; fades out during turn 9
- `adrenaline-576557.mp3` — turn 10+ until the round ends

Selected source pages:

- https://pixabay.com/music/rock-sports-opener-590001/
- https://pixabay.com/music/action-dark-571483/
- https://pixabay.com/music/action-adrenaline-adrenaline-music-576557/

The browser should serve committed local audio files rather than hotlinking Pixabay page URLs. Until the three MP3 files are committed, `music.js` falls back to the legacy generated synth so the current game remains functional.

Transition contract:

- fade in on track start
- fade out / fade in around every loop boundary
- turn 9 fades the early track to silence
- turn 10 fades in the late track
- match end transitions back to lobby music
- user volume is 0–100 and stored locally in the browser
