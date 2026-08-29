# Orbital Artillery

Orbital Artillery is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/orbital-artillery`
- GitHub Pages: https://wzzzodiac.github.io/orbital-artillery/

Backend:
- `wzzzodiac/orbital-artillery-server`
- Authoritative Node.js + Socket.IO server on Google Cloud Run

## Current release

**Orbital Artillery v0.9.8 Release Candidate — final pre-Phase-10 functional/mechanical baseline.**

Phase 9 remains closed for the current mechanical/gameplay scope. v0.9.8 RC consolidates combat balance, fair pickups, traversal recovery, adaptive soundtrack behavior and synchronized weapon/impact SFX before the Phase 10 visual overhaul begins.

The next major milestone is **Phase 10 — Major Visual Overhaul → v1.0**. Phase 10 is not part of the v0.9.8 RC mechanical contract.

Mobile/touch gameplay is not part of this project roadmap.

## Architecture

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript ES modules + Canvas 2D
- Private room codes for 2–8 players
- Team and Survival modes
- Authoritative Node.js + Socket.IO server
- Google Cloud Run backend in `us-east1`
- In-memory rooms; no persistent database in v0.9.8 RC
- Socket connection begins on CREATE/JOIN rather than intentionally waking the backend on page load
- Connection-state recovery protects active matches from brief transport cuts

GitHub source/CI does not by itself prove the latest backend commit is already deployed to Cloud Run; deployed runtime parity is checked separately when needed.

## v0.9.8 gameplay baseline

- 2–8 players
- Team / Survival
- private rooms
- server-authoritative turns and combat
- 5000×5000 world
- 100 HP maximum
- 40-second turns
- wind, angle and power
- free active-turn movement
- unlimited jumps with cooldown
- adaptive ledge vault for unusually tall/wide terrain walls
- natural ledge drop when walking onto a lower solid surface
- embedded-terrain recovery before move/jump so terrain deformation cannot permanently trap a vehicle inside the heightmap
- destructible terrain
- seven terrain presets + RANDOM selector
- randomized physical spawns
- camera overview / follow / projectile follow / drag / zoom / reset
- live spectator aim and weapon telemetry
- AFK F1 skip vote
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

Pool total: 100.

Current notable behavior:
- Triple only deals damage for the individual projectiles that directly hit the vehicle: 0/1/2/3 hits = 0/10/20/30 damage before Shield.
- Cluster child explosions are independent. A vehicle inside several child blast radii receives damage from each qualifying explosion, with distance falloff per child.
- Air Strike shells are independent. A vehicle inside several shell blast radii receives damage from each qualifying shell, with distance falloff per shell.
- Cluster theoretical maximum remains 35 before Shield: 10 main + five children × 5.
- Air Strike theoretical maximum remains 35 before Shield: seven shells × 5.
- Nuke uses a designator, 5-second warning and 5-second beam, remains at 20 damage and keeps the diagonal terrain scar.
- Shield retains 50% mitigation and protects one entire incoming attack sequence.
- Heal restores +20 up to 100 HP.

## Pickup rules

- turns 1–9: baseline pickup cadence every 3 turns
- from turn 10 onward: one pickup spawn opportunity every turn
- pickup lifetime: 4 turns
- maximum live pickups: 4
- permanent Basic + 2 special inventory slots
- each player may collect at most 1 pickup during their own turn
- touching a pickup does not end the turn
- explosions/projectiles do **not** collect pickups
- Nuke may destroy pickups intersected by the beam
- spawn placement is balanced around midpoint gaps between living players
- touch collection uses a 74-world-unit center threshold, representing the 51-unit vehicle hit radius plus the visible pickup body; a slight visual/hitbox graze should collect the box

## Vehicle / traversal readability

The placeholder vehicles remain temporary assets for Phase 10:

- vehicle presentation at 65% of the previous large placeholder size
- wheels, cannon, Shield ring, attached HP/name text and weapon badge scale with the vehicle
- authoritative projectile hit radius = 51 world units
- normal jump distance remains 180 world units
- adaptive ledge vault may extend a blocked jump up to 420 world units only when required to clear unusually tall/wide terrain
- walking down a steep but solid ledge creates a short fall motion instead of forcing the player to jump forward
- before move/jump, a vehicle detected below the valid terrain surface is reconciled back to the authoritative surface to prevent permanent terrain traps

## Music / SFX

Adaptive soundtrack:
- lobby / countdown / post-match: `sports opener.mp3`
- turns 1–8: `dark.mp3`
- turn 9: long fade to silence
- turn 10+: `adrenaline.mp3`
- every soundtrack loop fades out near its end, restarts and fades back in
- track changes use fade-out/fade-in transitions
- a transition token prevents stale asynchronous `audio.play()` completions from restoring the wrong lobby/game track
- music tracks are reused rather than creating competing active music instances
- local music volume is adjustable from 0–100 and persisted in the browser

Weapon/utility audio:
- Basic launch: `basic_shot.mp3`; impact: `basic_explosion.mp3`
- Heavy launch: `heavy_bomb.mp3`; impact: `loud_explosion.mp3`
- Triple: individual Basic launch and explosion voice per projectile
- Cluster: Heavy launch/impact for the main projectile plus individual Basic launch/explosion voices for children
- Air Strike: `air_strike_begin.mp3` plus individual Basic shell voices and individual explosion voices
- Nuke: warning loop, Nuke activation and nuclear explosion sequence
- Shield: `shield.mp3`
- Heal: `health.mp3`

For Basic, Heavy, Triple, Cluster and Air Strike, launch/impact SFX are emitted by the same renderer timeline that decides when the corresponding projectile/impact becomes visible. Events are keyed and consumed once. A late room state therefore plays the sound on the first frame where the client can actually show that event instead of silently discarding it because a timestamp window expired. Audio events arriving before browser audio unlock are retained only briefly and flushed after user interaction, avoiding both missing first sounds and stale delayed playback.

## Match-start overlay

The countdown presentation is intentionally player-facing and minimal: **START + map + mode**. Internal phase/version/arsenal labels are not shown in the match-start overlay.

## Automated coverage

Regression coverage includes, among other cases:

- 8-player Survival turn cycle
- balanced Team 2v2 alternation
- free movement and jump behavior
- adaptive high-wall vault
- natural downward ledge drop
- embedded-terrain recovery
- projectile/terrain face collision
- long visible projectile pacing
- Air Strike descent pacing
- Nuke timing/damage/terrain behavior
- 51-unit vehicle hitbox behavior
- Basic direct damage = 10
- Heavy direct damage = 20
- Triple direct projectile damage = 10 each
- Cluster main direct hit = 10 and radial child damage up to 5 each inside radius 150
- Shield covering a complete multi-hit attack once
- Air Strike radial shell damage up to 5 each inside radius 165
- Heal = +20 with 100 HP cap
- disconnect/false-victory handling
- stats / attribution / assists
- rematch reset and RANDOM rematch
- pickup frenzy from turn 10
- maximum 4 live pickups
- one pickup per player per turn
- touch-only pickup collection
- pickup edge-graze collection beyond the former 64-unit threshold

Frontend CI syntax-checks the active renderer, controls, music and SFX modules. Browser-level music looping, audible synchronization and game feel still require manual runtime verification.

Historical Phase 6/7 tests remain in the suite as regressions even though the public game is identified by release version rather than internal development phases.

## Version roadmap

- Phases 0–6 — core gameplay systems ✅
- Phase 7 — multiplayer QA, stats, match loop and hardening ✅
- Phase 8 — minor functional/readability polish ✅
- **Phase 9 — v0.9 Beta functional release ✅**
- **v0.9.1–v0.9.7 — post-close beta/pre-release hotfixes ✅**
- **v0.9.8 Release Candidate — current pre-Phase-10 baseline**
- **Phase 10 — Major Visual Overhaul → v1.0 ⏳ NEXT**

## Phase 10 parking lot

Ideas intentionally saved for later evaluation:

- replace placeholder tanks with animal characters riding small artillery vehicles
- selectable character/vehicle roster
- unique visual identity per map
- distinct backgrounds / sky / ground themes
- moon/space-rock style maps
- terrain masses above the main ground rather than a simple second floor
- cliffs, floating rocks, canyon structures and other vertical tactical terrain
- evaluate access to elevated terrain through map design first
- teleport/reposition utility only if vertical-map play demonstrates a real need
- evaluate higher HP only after testing the new Phase 10 map geometry and match pacing

These are Phase 10 ideas, not part of the v0.9.8 RC mechanical contract.

## Development rules

Gameplay-critical state remains server authoritative: turns, projectile resolution, damage, inventory, pickups, deaths, stats attribution, match result and rematch state.

Starting-player weighting against the host is intentional and should not be changed unless explicitly redesigned.

When code and old documents disagree, current executable source and later versioned snapshots win.
