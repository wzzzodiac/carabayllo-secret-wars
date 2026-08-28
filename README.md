# Orbital Artillery

Orbital Artillery is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/orbital-artillery`
- GitHub Pages: https://wzzzodiac.github.io/orbital-artillery/

Backend:
- `wzzzodiac/orbital-artillery-server`
- Authoritative Node.js + Socket.IO server on Google Cloud Run

## Current status

**Current development phase: Phase 6C.2 — Heal + Air Strike implemented.**

Air Strike mechanics, warning HUD and barrage renderer are present in the current code. Manual deployed-browser QA is still pending for its visual sequence, camera behavior and multiplayer synchronization.

The next planned gameplay feature is **Phase 6D — Nuke Laser**, followed by final pickup/weapon balancing and broad desktop QA.

Mobile/touch gameplay is not part of the current roadmap.

For the canonical resume state, use the highest-numbered versions of:
- `ORBITAL_ARTILLERY_PROGRESS_V*.txt`
- `COBY_DEBUG_V*.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V*.txt`

Current canonical snapshots:
- `ORBITAL_ARTILLERY_PROGRESS_V4.txt`
- `COBY_DEBUG_V4.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V4.txt`

## Architecture

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript ES modules + Canvas 2D
- Temporary player names; no accounts in MVP
- Private room codes for 2–8 players
- Authoritative Node.js + Socket.IO server
- Google Cloud Run backend in `us-east1`
- In-memory rooms; no persistent database in MVP
- Active rooms may be lost if the Cloud Run instance restarts; accepted for MVP
- Server connection begins on CREATE/JOIN rather than intentionally waking the backend on page load
- Intended Cloud Run behavior: min instances 0, expected max 1

Current server limits/defaults include 20 rooms, 64 concurrent sockets, 20 connection attempts/min/IP, 30 packets/s and 30-minute idle disconnect outside active/countdown matches.

## Implemented gameplay

- Private room creation/joining
- Host, READY, Team and Survival modes
- Server-authoritative turns and game state
- 5000×5000 world
- Countdown overview, active-player follow, projectile follow, manual camera drag, wheel zoom and double-click return-to-follow
- 40-second turns and per-turn wind
- Weighted first-player selection that intentionally favors non-hosts
- Randomized physical spawn positions
- Movement, jumping, aim and power
- Projectile trajectory preview and simulation
- Seven terrain presets
- Destructible terrain and craters
- Knockback, HP, falls, deaths and victory
- Pickup spawning, lifetime and explosion/contact collection
- Permanent Basic weapon + two special inventory slots
- Heavy Bomb
- Triple Shot
- Cluster Bomb
- Shield
- Heal +30
- Air Strike
- F1 AFK turn-skip voting
- Disconnect/turn-order hardening
- Frontend/server CI and regression tests

## Key current constants

- HP: 100
- Turn: 40 s
- Movement radius: ±520
- Move step: 15
- Max walk surface delta: 42
- Jump: 180, max 2/turn
- Aim: 5–85°, default 45°
- Power: 10–100, default 55
- Basic: 45 max damage, radius 260, crater 135/165
- Heavy: 60, radius 320, crater 190/90
- Triple: 3 shots ±6°, 20 each, radius 175, crater 78/78
- Cluster: 5 subimpacts, 14 each, radius 150, crater 70/70
- Shield: next applicable damage ×0.5
- Heal: +30, cap 100
- Air Strike: 7 shells, 1200 ms warning, 120 ms stagger, 105 spacing, 16 max damage/shell, radius 165, crater 72/62
- Pickups: every 3 turns, lifetime 4 turns, max 2, contact radius 64
- AFK vote: opens at 20 s remaining, strict majority of other living players

## Current terrain presets

- Rolling Expanse
- Terrace Line
- Twin Peaks
- Impact Basin
- Broken Ridge
- Drift Islands
- Canyon Run

## Current roadmap

- Phase 0 — scaffold / architecture ✅
- Phase 1 — private-room networking ✅
- Phase 2 — synchronized arena ✅
- Phase 2.5 — world / camera ✅
- Phase 3 — turns / wind ✅
- Phase 4 — movement / aim / fire ✅
- Phase 5A — destructible terrain ✅
- Phase 5B — HP / damage / death / victory ✅
- Phase 6A — pickups / inventory / Heavy Bomb ✅
- Phase 6B — Triple Shot / Cluster Bomb / Shield ✅
- Phase 6B.1 — AFK Skip Vote ✅
- Phase 6C.1 — Heal ✅
- Phase 6C.2 — Air Strike ✅ implementation; manual PC QA pending
- Phase 6D — Nuke Laser ⏭ NEXT
- Final balance + broad desktop QA ⏳

## Phase 6D concept

Nuke Laser is an approved future concept, not yet implemented:
- very rare
- diagonal terrain-disintegration beam
- direct player damage around 20 HP
- little or no conventional knockback
- main danger is destroying support terrain and causing falls

Exact beam geometry, Shield/self/friendly-fire behavior, pickup interaction and turn semantics must be finalized before implementation.

## Development rules

Gameplay-critical state remains server authoritative: turns, damage, inventory, projectile/special resolution, pickups, deaths and victory.

Starting-player weighting against the host is intentional and must not be "fixed" unless explicitly changed.

When performing a Coby Debug, distinguish confirmed code bugs from manual visual/gameplay checks. Anything requiring actual play/visual inspection belongs in the highest-numbered TODO list and must not be marked complete without manual testing.

Older summaries may describe a feature as pending even when later commits implemented it. In conflicts, current executable code and later commits win.
