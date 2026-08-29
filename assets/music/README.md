# Orbital Artillery v0.9.6 audio assets

## Soundtrack

Files currently used by the game:

- `sports opener.mp3` — **Sports Opener**, AtlasAudio — lobby / countdown / post-match
  - Source: https://pixabay.com/music/rock-sports-opener-590001/
- `dark.mp3` — **Dark**, AudioCopper — early match, turns 1–8; fades to silence during turn 9
  - Source: https://pixabay.com/music/action-dark-571483/
- `adrenaline.mp3` — **Adrenaline - Adrenaline Music**, The_Mountain — turn 10+ until the round ends
  - Source: https://pixabay.com/music/action-adrenaline-adrenaline-music-576557/

All three source pages identify the tracks as free for use under the Pixabay Content License. Pixabay's license permits using and adapting Content as part of a larger creative work; standalone redistribution of the Content is restricted. Source/license details are retained here even though attribution is not required by the Pixabay Content License.

### Transition contract

- every track enters with a fade-in
- when changing tracks, outgoing and incoming audio use independent ramps for a real crossfade
- every loop fades out near the end, restarts cleanly, then fades back in
- turn 9 uses a longer fade from the early-game track to silence
- turn 10 fades in the late-game track
- match end crossfades back to lobby music
- music volume is controlled locally from 0–100 and persisted in the browser
- browser autoplay rules are respected: playback unlocks after the player's first pointer or keyboard interaction
- there is no legacy procedural/synth music fallback; missing soundtrack assets fail silent and log an error instead

## Weapon / utility SFX

Current local files:

- `basic_shot.mp3`
- `heavy_bomb.mp3`
- `air_strike_begin.mp3`
- `warning.mp3`
- `nuke.mp3`
- `shield.mp3`
- `health.mp3`
- `basic_explosion.mp3`
- `loud_explosion.mp3`
- `nuke_explosion.mp3`

Playback contract:

- Basic: basic shot + basic explosion on impact
- Heavy: heavy launch + loud explosion on impact
- Triple: one basic shot per projectile + one basic explosion per projectile impact
- Cluster: heavy launch/main loud explosion + individual basic child launches/explosions
- Air Strike: begin cue + individual shell cues + individual basic explosions
- Nuke: warning after target lock until beam start, then nuke activation + nuke explosion
- Shield: shield activation cue
- Heal: health cue

`audio.js` uses small preloaded voice pools so rapid multi-projectile weapons can overlap without cutting each other off. Authoritative timestamps are used for projectile and impact synchronization; reasonably late network events are played immediately rather than silently discarded.
