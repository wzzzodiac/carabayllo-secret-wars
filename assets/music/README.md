# Carabayllo Secret Wars v0.9.8 RC audio assets

## Soundtrack

Files currently used by the game:

- `sports opener.mp3` — **Sports Opener**, AtlasAudio — lobby / countdown / post-match
  - Source: https://pixabay.com/music/rock-sports-opener-590001/
- `dark.mp3` — **Dark**, AudioCopper — early match, turns 1–8; fades to silence during turn 9
  - Source: https://pixabay.com/music/action-dark-571483/
- `adrenaline.mp3` — **Adrenaline - Adrenaline Music**, The_Mountain — turn 10+ until the round ends
  - Source: https://pixabay.com/music/action-adrenaline-adrenaline-music-576557/

All three source pages identify the tracks as free for use under the Pixabay Content License. Source/license details are retained here even though attribution is not required by the Pixabay Content License.

### Transition contract

- every track enters with a fade-in
- when changing tracks, outgoing and incoming audio use independent ramps
- every loop fades out near the end, restarts cleanly, then fades back in
- turn 9 uses a longer fade from early-game music to silence
- turn 10 fades in the late-game track
- match end returns to lobby music
- the 0–100 game-volume slider controls both soundtrack and SFX
- browser autoplay rules are respected
- there is no legacy procedural/synth music fallback

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
- Nuke: `warning.mp3` starts 5 seconds before the visual warning begins to compensate for delayed audible content in that source file; the warning audio is stopped exactly when the visual warning ends at `beamAt`; `nuke.mp3` then accompanies the active laser and `nuke_explosion.mp3` provides the nuclear impact cue
- Shield: shield activation cue
- Heal: health cue

`audio.js` uses preloaded voice pools so rapid multi-projectile weapons can overlap without cutting each other off. Basic/Heavy/Triple/Cluster/Air launch and impact cues are driven by the visual renderer events so the audible event follows the same local presentation timeline.
