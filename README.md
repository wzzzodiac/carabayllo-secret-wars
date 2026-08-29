# Orbital Artillery

Orbital Artillery is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/orbital-artillery`
- GitHub Pages: https://wzzzodiac.github.io/orbital-artillery/

Backend:
- `wzzzodiac/orbital-artillery-server`
- Authoritative Node.js + Socket.IO server on Google Cloud Run

## Current release

**Orbital Artillery v0.9 Beta — functional gameplay build.**

Phase 9 is closed for the current mechanical/gameplay scope. The game can be played from lobby to result/rematch with the planned v0.9 mechanics implemented and regression-covered.

The next major milestone is **Phase 10 — Major Visual Overhaul → v1.0**. Phase 10 is intentionally parked for now and will focus on the large visual identity pass: characters/animal riders, vehicles, map art, backgrounds, terrain redesign and later vertical/dynamic map experimentation.

Mobile/touch gameplay is not part of this project roadmap.

## Architecture

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript ES modules + Canvas 2D
- Private room codes for 2–8 players
- Team and Survival modes
- Authoritative Node.js + Socket.IO server
- Google Cloud Run backend in `us-east1`
- In-memory rooms; no persistent database in v0.9
- Socket connection begins on CREATE/JOIN rather than intentionally waking the backend on page load
- Connection-state recovery protects active matches from brief transport cuts

GitHub source/CI does not by itself prove the latest backend commit is already deployed to Cloud Run; deployed runtime parity is checked separately when needed.

## v0.9 gameplay baseline

- 2–8 players
- Team / Survival
- private rooms
- server-authoritative turns and combat
- 5000×5000 world
- 40-second turns
- wind, angle and power
- free active-turn movement
- unlimited jumps with cooldown
- destructible terrain
- seven terrain presets + RANDOM selector
- randomized physical spawns
- camera overview / follow / projectile follow / drag / zoom / reset
- live spectator aim and weapon telemetry
- AFK F1 skip vote
- disconnect/recovery hardening
- match scoreboard and event feed
- damage / kills / assists / damage taken / pickups / biggest hit
- death attribution
- end-of-match summary
- same-map and random-map rematch

## Weapons / utilities

Permanent slot:
- Basic

Special pickup pool:
- Heavy Bomb — 25
- Triple Shot — 20
- Cluster Bomb — 20
- Shield — 12
- Heal +30 — 12
- Air Strike — 8
- Nuke Laser — 3

Pool total: 100.

Current notable behavior:
- Basic, Heavy, Triple and Cluster use long readable projectile flights.
- Air Strike shells visibly descend from the top of the battle view.
- Nuke uses a designator, 5-second warning and 5-second beam.
- Nuke deals 20 direct damage and creates a survivable diagonal terrain scar rather than a vertical void.
- Shield halves the next applicable damage.
- Heal restores +30 up to 100 HP.

## v0.9 pickup pacing

The final v0.9 pickup rules are designed to make late matches increasingly chaotic:

- turns 1–9: baseline pickup cadence every 3 turns
- from turn 10 onward: one pickup spawn opportunity every turn
- pickup lifetime: 4 turns
- maximum live pickups on the map: 4
- permanent Basic + 2 special inventory slots
- each player may collect at most 1 pickup during their own turn
- touching a pickup does not end the turn
- after collecting a pickup, the player may still move and fire normally
- explosions/projectiles do **not** collect pickups
- Nuke may still destroy pickups intersected by the beam

This creates an early positioning phase followed by a more frantic late-game item economy without allowing one player to vacuum multiple boxes during a single free-movement turn.

## Current vehicle/combat readability baseline

The v0.9 placeholder vehicles remain temporary assets for Phase 10, but their gameplay scale is now established:

- enlarged vehicle presentation
- matching enlarged projectile hitbox
- one large HP bar per vehicle
- readable `YOU // HP` / player-name labels
- active weapon badge
- larger spectator/AFK panel

The current tank/cart art is explicitly placeholder material and is expected to be replaced in Phase 10.

## Automated coverage

Regression coverage includes, among other cases:

- 8-player Survival turn cycle
- balanced Team 2v2 alternation
- spectator aim parity
- free movement beyond the historical movement envelope
- more than two jumps per turn
- projectile movement lock
- projectile/terrain face collision
- long visible projectile pacing
- Air Strike descent pacing
- Nuke timing/damage/terrain behavior
- large vehicle hitbox behavior
- 100 turn timeouts without false victory
- disconnect turn-order handling
- stats / damage attribution / assists
- rematch reset and RANDOM rematch
- v0.9 pickup frenzy from turn 10
- maximum 4 live pickups
- one pickup per player per turn
- touch-only pickup contract in public v0.9 state

Historical Phase 6/7 tests remain in the suite as regressions even though the public game is now identified by release version rather than internal development phases.

## Version roadmap

- Phases 0–6 — core gameplay systems ✅
- Phase 7 — multiplayer QA, stats, match loop and hardening ✅
- Phase 8 — minor functional/readability polish ✅
- **Phase 9 — v0.9 Beta functional release ✅**
- **Phase 10 — Major Visual Overhaul → v1.0 ⏳ PARKED**

Phase 10 is expected to cover the major identity pass rather than reopening the v0.9 mechanical foundation unnecessarily.

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

These are Phase 10 ideas, not part of the v0.9 mechanical contract.

## Development rules

Gameplay-critical state remains server authoritative: turns, projectile resolution, damage, inventory, pickups, deaths, stats attribution, match result and rematch state.

Starting-player weighting against the host is intentional and should not be changed unless explicitly redesigned.

When code and old documents disagree, current executable source and later versioned snapshots win.
