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

Air Strike mechanics, warning HUD and barrage renderer are present in the current code. Manual deployed-browser QA is still pending for its visual sequence and multiplayer synchronization.

The next planned gameplay feature is **Phase 6D — Nuke Laser**, followed by final pickup/weapon balancing and broad desktop QA.

Mobile/touch gameplay is not part of the current roadmap.

For the canonical resume state, use the highest-numbered versions of:
- `ORBITAL_ARTILLERY_PROGRESS_V*.txt`
- `COBY_DEBUG_V*.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V*.txt`

Current canonical snapshots:
- `ORBITAL_ARTILLERY_PROGRESS_V3.txt`
- `COBY_DEBUG_V3.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V3.txt`

## Architecture

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript + Canvas 2D
- Temporary player names; no accounts in MVP
- Private room codes for 2–8 players
- Authoritative Node.js + Socket.IO server
- Google Cloud Run backend
- In-memory rooms; no persistent database in MVP
- Server connection begins on CREATE/JOIN rather than intentionally waking the backend on page load

## Implemented gameplay

- Private room creation/joining
- Host, READY, Team and Survival modes
- Server-authoritative turns and game state
- 5000×5000 world with overview/follow/manual camera
- Movement, jumping, aim, power and wind
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

## Development rules

Gameplay-critical state remains server authoritative: turns, damage, inventory, projectile/special resolution, pickups, deaths and victory.

Starting-player weighting against the host is an intentional design decision and must not be "fixed" unless explicitly changed.

When performing a Coby Debug, distinguish confirmed code bugs from manual visual/gameplay checks. Anything requiring actual play/visual inspection belongs in the highest-numbered TODO list and must not be marked complete without manual testing.
