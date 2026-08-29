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

Phase 9 is closed for the current mechanical/gameplay scope. Subsequent changes to this frozen beta are treated as v0.9 hotfixes rather than reopening Phase 9 automatically.

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
- 100 HP maximum
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
- Basic — maximum 10 damage on a direct hit

Special pickup pool:
- Heavy Bomb — weight 25; maximum 20 direct damage
- Triple Shot — weight 20; 3 projectiles, 10 damage for each projectile that directly hits a vehicle
- Cluster Bomb — weight 20; current 14 max damage per subimpact baseline retained
- Shield — weight 12; halves one complete incoming attack and is then consumed if that attack hits
- Heal +20 — weight 12; restores up to 20 HP, capped at 100
- Air Strike — weight 8; 7 shells, 5 damage for each shell that directly reaches the vehicle hitbox
- Nuke Laser — weight 3; 20 direct damage

Pool total: 100.

Current notable behavior:
- Basic, Heavy, Triple and Cluster use long readable projectile flights.
- Triple does not award damage merely because a nearby projectile hits terrain: only the individual projectiles that directly hit the vehicle count for its 10-damage hits.
- Air Strike shells visibly descend from the top of the battle view; only shells that directly reach the vehicle hitbox deal their 5 damage to that vehicle.
- Nuke uses a designator, 5-second warning and 5-second beam.
- Nuke remains at 20 direct damage and keeps the diagonal terrain-scar behavior; the current v0.9 hotfix slightly strengthens that scar without changing its basic geometry or turning it into a vertical void.
- Shield retains the 50% mitigation baseline but now protects against one entire incoming attack sequence, including multi-projectile attacks, rather than being consumed by the first child hit alone.
- Heal restores +20 up to 100 HP.

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

The v0.9 placeholder vehicles remain temporary assets for Phase 10, but their current gameplay scale is now established:

- vehicle presentation reduced to **65%** of the previous v0.9 placeholder size
- wheels, cannon, Shield ring, attached HP/name text and weapon badge scale with the vehicle
- authoritative projectile hit radius reduced from 78 to **51 world units** to match the smaller vehicle footprint
- vehicle-attached HP/name text is correspondingly smaller; global spectator/HUD panels keep their normal readable size

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
- 51-unit v0.9 vehicle hitbox behavior
- Basic direct damage = 10
- Heavy direct damage = 20
- Triple damage only from directly hitting child projectiles
- Shield covering a complete Triple volley once
- Air Strike direct shell damage = 5
- Heal = +20 with 100 HP cap
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
- **v0.9 Beta hotfixes — balance/readability corrections as needed**
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
