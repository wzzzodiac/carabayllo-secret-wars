# Orbital Artillery

Orbital Artillery is a browser-based 2D turn-based multiplayer artillery game for 2–8 players.

The game is split into two repositories:

- `wzzzodiac/orbital-artillery` — browser client / frontend
- `wzzzodiac/orbital-artillery-server` — authoritative Node.js + Socket.IO backend

## Current status

**Current development phase: Phase 6C.2 — Heal + Air Strike implemented.**

The original Phase 0 networking scaffold has grown into a functional multiplayer gameplay loop with private rooms, game modes, turn-based movement, aiming, projectile physics, destructible terrain, health/death/victory rules, pickups, inventory, special weapons, AFK turn voting, regression tests and CI checks.

The next planned gameplay feature is **Phase 6D — Nuke Laser**, followed by balance, QA, mobile UX and multiplayer polish.

For the persistent development history and exact resume point, read:

- `ORBITAL_ARTILLERY_PROGRESS.txt`
- `COBY_DEBUG.txt`

## Architecture

- Static frontend intended for GitHub Pages
- Vanilla HTML/CSS/JavaScript + Canvas 2D
- Temporary player names; no accounts in the MVP
- Private room codes for 2–8 players
- Authoritative Node.js + Socket.IO server
- Google Cloud Run backend target
- In-memory rooms for the MVP
- No persistent database for the MVP

## Implemented gameplay

- Private room creation and joining
- Host, ready state, teams and game modes
- Server-authoritative turn system
- Player movement and jumping
- Aim angle, power and wind
- Projectile trajectory preview and projectile simulation
- Multiple terrain presets
- Destructible terrain and craters
- Explosion knockback and void falls
- HP, damage, deaths and victory conditions
- Survival and team modes
- Pickup spawning and expiration
- Two-slot special-item inventory plus permanent basic weapon
- Pickup collection by movement or explosion
- Heavy Bomb
- Triple Shot
- Cluster Bomb
- Shield
- Heal +30
- Air Strike
- Full friendly fire/self-damage where applicable
- F1 AFK turn-skip voting
- Disconnect/turn-order hardening
- Frontend/server syntax CI
- Regression tests for turn flow, AFK voting and special weapons

## Terrain presets

Current terrain families include:

- Rolling Expanse
- Terrace Line
- Twin Peaks
- Impact Basin
- Broken Ridge
- Drift Islands
- Canyon Run

## Current item rules

The basic weapon is always available in slot 1. Slots 2 and 3 are inventory slots for collected special items.

Pickups currently spawn periodically during matches, expire after a limited number of turns and can be collected either by touching them or by hitting them with an explosion when inventory space is available.

## Current Phase 6C.2 highlights

### Heal

- Restores up to 30 HP
- Maximum HP: 100
- Cannot be used at full HP
- Does not consume the offensive turn

### Air Strike

- Seven-shell barrage
- Warning before impacts
- Staggered shell impacts
- Terrain destruction
- Damage to enemies, teammates and self
- Can interact with shields, pickups and match-ending deaths

## Roadmap summary

- Phase 0 — project scaffold and architecture ✅
- Phase 1 — private-room multiplayer networking ✅
- Phase 2 — synchronized arena foundation ✅
- Phase 3 — authoritative turn system ✅
- Phase 4 — movement, aiming and artillery physics ✅
- Phase 5A — terrain presets and destructible terrain ✅
- Phase 5B — health, damage, deaths and victory ✅
- Phase 6A — pickups, inventory and Heavy Bomb ✅
- Phase 6B — Triple Shot, Cluster Bomb and Shield ✅
- Phase 6C.1 — Heal ✅
- Phase 6C.2 — Air Strike ✅
- Phase 6D — Nuke Laser ⏭ NEXT
- Balance / QA / mobile UX / multiplayer polish ⏳

## Development rule

The server remains authoritative for gameplay state and resolution. New mechanics should not trust client-side state for damage, turns, inventory, victory or projectile outcomes.

Before continuing development from a new ChatGPT conversation, read `COBY_DEBUG.txt` and `ORBITAL_ARTILLERY_PROGRESS.txt` and verify the latest commits in both repositories.
