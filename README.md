# Orbital Artillery

Orbital Artillery is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/orbital-artillery`
- GitHub Pages: https://wzzzodiac.github.io/orbital-artillery/

Backend:
- `wzzzodiac/orbital-artillery-server`
- Authoritative Node.js + Socket.IO server on Google Cloud Run

## Current status

**Current development phase: Phase 6E — Balance & Gameplay Tuning baseline implemented in code.**

Phase 6E keeps the existing Phase 6D gameplay mechanics—Nuke Laser, free active-turn movement and live spectator aim—but replaces the old pre-final pickup rarity model with an exact 100-point baseline distribution:

- Heavy Bomb: 25
- Triple Shot: 20
- Cluster Bomb: 20
- Shield: 12
- Heal +30: 12
- Air Strike: 8
- Nuke Laser: 3

A post-6E **Coby Debug V8** code pass was completed. The new balance wrapper, server wiring, deterministic roll boundaries, frontend identity/cache chain, CI and Pages deployment were reviewed. No remaining confirmed gameplay/code blocker was found from this pass. Manual browser/gameplay/balance QA is still pending.

Phase 6E intentionally does **not** change current weapon damage/radii or the 40-second turn yet. Those values remain the baseline until real multiplayer play gives evidence to tune them.

Next planned phase after manual findings are incorporated: **Phase 6F — Visual & Spectator Polish**.

Mobile/touch gameplay is not part of the current roadmap.

For canonical recovery, use the highest-numbered versions of:
- `ORBITAL_ARTILLERY_PROGRESS_V*.txt`
- `COBY_DEBUG_V*.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V*.txt`

Current canonical snapshots:
- `ORBITAL_ARTILLERY_PROGRESS_V8.txt`
- `COBY_DEBUG_V8.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V8.txt`

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
- Free active-turn movement across reachable terrain
- Unlimited per-turn jumping with short normal-jump cadence
- Long natural fall/death timing for jumps into void
- Live spectator aim: active angle, power and trajectory visible to all clients
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
- Nuke Laser
- F1 AFK turn-skip voting
- Disconnect/turn-order hardening
- Phase 6E 100-point balanced pickup pool
- Frontend/server CI and regression tests

## Phase 6E balance baseline

The authoritative server now routes through `phase6e.js`, which wraps Phase 6D and changes only the rarity selection of newly spawned pickups. Each new box is normalized once against the 100-point Phase 6E pool, so existing combat/turn/movement logic remains inherited from the already-hardened Phase 6D path.

The server public state exposes `phase: "6E"`, the exact `itemPool`, and `balanceRules` metadata. The Phase 6E test suite verifies the total pool, exact weights, deterministic 0–99 roll boundaries, public pacing metadata and one-time normalization of newly spawned pickups.

## Key current constants

- HP: 100
- Turn: 40 s
- Move step: 15
- Movement radius: none during active turn
- Max walk surface delta: 42
- Jump distance: 180
- Jump quota: none during active turn
- Normal jump visual: ~500 ms
- Jump cooldown: ~450 ms
- Aim: 5–85°, default 45°
- Power: 10–100, default 55
- Basic: 45 max damage, radius 260, crater 135/165
- Heavy: 60, radius 320, crater 190/90
- Triple: 3 shots ±6°, 20 each, radius 175, crater 78/78
- Cluster: 5 subimpacts, 14 each, radius 150, crater 70/70
- Shield: next applicable damage ×0.5
- Heal: +30, cap 100
- Air Strike: 7 shells, 1200 ms warning, 120 ms stagger, 105 spacing, 16 max damage/shell, radius 165, crater 72/62
- Nuke Laser: 20 direct damage, 3000 ms warning after designator lock, 3000 ms sustained beam, large diagonal terrain cut, no conventional knockback
- Pickups: every 3 turns, lifetime 4 turns, max 2, contact radius 64
- Phase 6E pool: 25/20/20/12/12/8/3 = 100
- AFK vote: opens at 20 s remaining, strict majority of other living players

## Movement philosophy

The old Phase 4 limits of ±520 movement and two jumps per turn are no longer gameplay limits.

During the active player's 40-second turn:
- movement is allowed across normally reachable terrain
- walking still respects terrain steepness/collision rules
- jumping has no per-turn counter
- normal jump spam is constrained by the short jump animation/cooldown
- jumps into void preserve the longer fall/death presentation
- firing locks movement while the projectile/special action resolves
- Shield and Heal remain instant utility actions under their existing turn rules

The turn clock is intentionally the main cost of repositioning. Phase 6E keeps 40 seconds until manual play determines whether it should change.

## Spectator aim

All clients receive the authoritative active-player aim state. Spectators can see the current angle, power and trajectory preview while the active player prepares a shot. Triple, Air Strike and Nuke use their weapon-specific presentation where available; the Nuke uses the normal artillery trajectory as its visible designator.

## Nuke Laser behavior

- Very rare pickup: Phase 6E weight 3/100
- Normal artillery projectile acts as the server-authoritative designator
- Designator impact locks the target
- 3-second warning after target lock
- Sustained 3-second diagonal disintegration beam
- Catastrophic frontend presentation with darkening, warning line, multi-layer beam glow/core, particles/pulses and afterglow
- Overlay uses the exact base renderer camera view
- Large diagonal terrain destruction corridor
- Terrain is removed only where the surface intersects the beam corridor
- 20 HP direct damage with full self/friendly fire
- Shield halves the applicable direct hit and is consumed
- No conventional knockback
- Main danger is removing support terrain and causing falls
- Pickups intersected by the beam are destroyed rather than collected
- Nuke always ends the offensive turn after resolution if the match continues

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
- Phase 4 — movement / aim / fire ✅; movement later expanded in Phase 6D
- Phase 5A — destructible terrain ✅
- Phase 5B — HP / damage / death / victory ✅
- Phase 6A — pickups / inventory / Heavy Bomb ✅
- Phase 6B — Triple Shot / Cluster Bomb / Shield ✅
- Phase 6B.1 — AFK Skip Vote ✅
- Phase 6C.1 — Heal ✅
- Phase 6C.2 — Air Strike ✅ implementation; manual PC QA pending
- Phase 6D — Nuke Laser + free movement + live spectator aim ✅ implementation; code debug passed; manual PC QA pending
- Phase 6E — Balance & Gameplay Tuning ✅ baseline implementation; post-6E code debug passed; manual balance QA pending
- Phase 6F — Visual & Spectator Polish ⏳
- Phase 7A — Full Multiplayer QA ⏳
- Phase 7B — Bugfix & Regression Hardening ⏳
- Phase 8 — Release Candidate / Final Polish ⏳
- Phase 9 — v1.0 Release ⏳

## Automated baseline

Post-Phase 6E checkpoint:
- Server CI passed with Phase 6E balance regressions plus the existing combat/movement/Nuke suite.
- Frontend CI passed with the Phase 6E identity/cache chain.
- GitHub Pages deployed the Phase 6E frontend commit successfully.

Automated checks do not replace manual browser/gameplay QA. Live Cloud Run deployment/source parity must also be verified rather than assumed solely from GitHub source.

## Development rules

Gameplay-critical state remains server authoritative: turns, damage, inventory, projectile/special resolution, pickups, deaths and victory.

Starting-player weighting against the host is intentional and must not be "fixed" unless explicitly changed.

The Phase 6E 100-point pool is the current baseline, not a guarantee that manual play will never justify another tuning pass.

When performing a Coby Debug, distinguish confirmed code bugs from manual visual/gameplay checks. Anything requiring actual play/visual inspection belongs in the highest-numbered TODO list and must not be marked complete without manual testing.

Older summaries may describe a feature as pending even when later commits implemented it. In conflicts, current executable code and later commits win.
