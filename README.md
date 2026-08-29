# Carabayllo Secret Wars

Carabayllo Secret Wars is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/carabayllo-secret-wars`
- GitHub Pages: https://wzzzodiac.github.io/carabayllo-secret-wars/

Backend repository (repository name intentionally unchanged):
- `wzzzodiac/orbital-artillery-server`
- authoritative Node.js + Socket.IO server on Google Cloud Run

## Current release

**Carabayllo Secret Wars v0.9.8 Release Candidate — final pre-Phase-10 functional/mechanical baseline.**

Phase 9 remains closed for the current mechanical/gameplay scope. v0.9.8 RC consolidates combat balance, fair pickups, traversal recovery, adaptive soundtrack behavior, synchronized launch/impact SFX, master game volume, airborne pickup contact and inactivity-based AFK voting before the Phase 10 visual overhaul begins.

The next major milestone is **Phase 10 — Major Visual Overhaul → v1.0**. Mobile/touch gameplay is not part of this project roadmap.

## Architecture

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript ES modules + Canvas 2D
- Private room codes for 2–8 players
- Team and Survival modes
- Authoritative Node.js + Socket.IO backend
- Google Cloud Run backend in `us-east1`
- In-memory rooms; no persistent database in v0.9.8 RC
- Socket connection begins on CREATE/JOIN
- Connection-state recovery protects active matches from brief transport cuts

GitHub source/CI does not by itself prove the latest backend commit is already deployed to Cloud Run; deployed runtime parity is checked separately when needed.

## v0.9.8 gameplay baseline

- 2–8 players
- Team / Survival
- private rooms
- 5000×5000 world
- 100 HP maximum
- 40-second turns
- wind, angle and power
- free active-turn movement
- unlimited jumps with cooldown
- normal jump distance 180
- adaptive ledge vault up to 420 world units when required
- natural ledge drop
- embedded-terrain recovery before move/jump
- destructible terrain
- seven terrain presets + RANDOM
- randomized physical spawns
- camera overview / follow / projectile follow / drag / zoom / reset
- live spectator aim and weapon telemetry
- AFK F1 skip vote only after 20 seconds of active-player inactivity
- disconnect/recovery hardening
- match scoreboard and event feed
- end-of-match summary and rematch

## Weapons / utilities

Permanent slot:
- Basic — maximum 10 damage, radial falloff inside radius 260; direct hit = 10

Special pickup pool:
- Heavy Bomb — weight 25; maximum 20 damage, radial falloff inside radius 320; direct hit = 20
- Triple Shot — weight 20; 3 projectiles, 10 damage for each projectile that directly hits a vehicle
- Cluster Bomb — weight 20; main direct hit = 10; each child explosion independently deals up to 5 damage with radial falloff inside radius 150
- Shield — weight 12; halves one complete incoming attack and is then consumed if that attack hits
- Heal +20 — weight 12; restores up to 20 HP, capped at 100
- Air Strike — weight 8; 7 shells; each shell independently deals up to 5 damage with radial falloff inside radius 165
- Nuke Laser — weight 3; 20 damage

Cluster theoretical maximum remains 35 before Shield: 10 main + five children × 5. Air Strike theoretical maximum remains 35 before Shield: seven shells × 5. Shield retains 50% mitigation over one complete incoming attack sequence.

## Pickups

- turns 1–9: baseline spawn cadence every 3 turns
- turn 10+: one spawn opportunity each turn
- lifetime: 4 turns
- maximum live pickups: 4
- permanent Basic + 2 special inventory slots
- max 1 pickup per player during their own turn
- touching a pickup does not end the turn
- explosions/projectiles do not collect pickups
- Nuke may destroy pickups intersected by the beam
- placement is balanced around midpoint gaps between living players
- contact threshold is 74 world units, representing vehicle hitbox + visible pickup body
- jump/fall traversal uses a swept hitbox: grazing a pickup at any sampled point of the airborne trajectory collects it even when the landing point is elsewhere

## AFK voting

F1 is not a countdown-to-turn-end mechanic. The active player's valid activity resets the AFK clock. Only after **20 continuous seconds without active-player activity** does the F1 skip-vote control become visible to eligible living spectators. New activity hides/locks it again and clears votes.

## Music / SFX

Adaptive soundtrack:
- lobby / countdown / post-match: `sports opener.mp3`
- turns 1–8: `dark.mp3`
- turn 9: long fade to silence
- turn 10+: `adrenaline.mp3`
- loops fade out near the end, restart, then fade back in
- track changes use fade-out/fade-in transitions
- stale asynchronous playback cannot restore an outdated track

The 0–100 speaker slider is a **master game volume** and controls both soundtrack and SFX while preserving the relative loudness of each effect. The master value remains responsive in the initial page/lobby, during fades and loops, and during active gameplay.

Weapon/utility audio:
- Basic: `basic_shot.mp3` launch + `basic_explosion.mp3` impact
- Heavy: `heavy_bomb.mp3` launch + `loud_explosion.mp3` impact
- Triple: individual launch + impact voice per projectile
- Cluster: Heavy main launch/impact + individual Basic child launch/impact voices
- Air Strike: begin cue + individual shell launch/impact voices
- Nuke: warning audio is started 5 seconds before the visual warning to compensate for the source file's delayed audible onset; it is forcibly stopped exactly at visual `beamAt`, where `nuke.mp3` becomes the laser cue and the nuclear impact cue is played
- Shield: `shield.mp3`
- Heal: `health.mp3`

For Basic, Heavy, Triple, Cluster and Air Strike, launch/impact SFX are emitted from the same renderer timeline that presents the corresponding projectile/impact event.

## Match-start overlay

The match-start presentation is intentionally minimal: **START + map + mode**. Internal phase/version/arsenal labels are not shown there.

## Automated coverage

Regression coverage includes movement/jump behavior, adaptive vault, natural drop, embedded-terrain recovery, projectile/terrain collision, projectile pacing, Nuke timing/damage/terrain behavior, weapon balance, Shield sequences, radial Cluster/Air damage, disconnect handling, stats, rematch, pickup pacing, edge-graze pickup contact, airborne pickup sweep, and inactivity-based AFK eligibility.

Frontend CI syntax-checks the active renderer, controls, music and SFX modules. Audible timing/game feel still requires manual browser runtime verification.

## Version roadmap

- Phases 0–6 — core gameplay systems ✅
- Phase 7 — multiplayer QA, stats, match loop and hardening ✅
- Phase 8 — minor functional/readability polish ✅
- Phase 9 — v0.9 Beta functional release ✅
- v0.9.1–v0.9.7 — post-close beta/pre-release hotfixes ✅
- **v0.9.8 Release Candidate — current pre-Phase-10 baseline**
- **Phase 10 — Major Visual Overhaul → v1.0 ⏳ NEXT**

## Phase 10 parking lot

Saved ideas include animal characters riding small artillery vehicles, selectable character/vehicle roster, unique visual identity per map, distinct backgrounds/terrain themes, vertical tactical terrain, and later mobility experiments only if map design demonstrates a real need.

## Development rules

Gameplay-critical state remains server authoritative: turns, projectile resolution, damage, inventory, pickups, deaths, stats attribution, match result and rematch state.

Starting-player weighting against the host is intentional unless explicitly redesigned.

Historical versioned documents keep their historical filenames/content. When old documents disagree with current executable source or later snapshots, current source/later snapshots win.
