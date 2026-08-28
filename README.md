# Orbital Artillery

Orbital Artillery is a browser/desktop 2D turn-based multiplayer artillery game for 2–8 players, inspired by Gunbound/Wild Ones.

Frontend:
- `wzzzodiac/orbital-artillery`
- GitHub Pages: https://wzzzodiac.github.io/orbital-artillery/

Backend:
- `wzzzodiac/orbital-artillery-server`
- Authoritative Node.js + Socket.IO server on Google Cloud Run

## Current status

**Current development phase: Phase 7A — Full Multiplayer QA, in progress.**

The planned v1 gameplay/core feature scope is now effectively feature-complete in code, including two new Phase 7A subphases:
- **Phase 7A.1 — Match Stats & Event Tracking** ✅ implementation
- **Phase 7A.2 — Rematch & Match Loop** ✅ implementation

This does **not** mean Phase 7A or the game is release-ready. Two-client browser sync, visual behavior, full human-played matches, balance/game feel and the complete manual QA list are still pending.

Current code gate: **COBY_DEBUG_V13.txt — PASS** after finding and fixing two real post-feature issues:
1. stale frontend cache for the updated match-stats module;
2. legitimate projectile damage could be lost from telemetry when the same resolution also sent the target into the void.

Current canonical snapshots:
- `ORBITAL_ARTILLERY_PROGRESS_V11.txt`
- `COBY_DEBUG_V13.txt`
- `ORBITAL_ARTILLERY_TODOLIST_V12.txt`

Mobile/touch gameplay is not part of the current roadmap.

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

The current backend source routes gameplay through `phase7a1.js`, which wraps the hardened Phase 6E gameplay contract with authoritative match telemetry and the rematch loop. Source `/health` reports Phase 7A.1. GitHub source/CI does not by itself prove the Cloud Run revision is already deployed; deployed runtime parity should be checked separately before release.

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
- Phase 6F live spectator telemetry and active-weapon identity
- Weapon-specific attack-resolution status presentation
- Projectile trajectory preview and simulation
- Seven terrain presets
- RANDOM terrain selection in lobby
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
- Authoritative live match scoreboard
- Damage dealt / damage received
- Kills / assists / deaths / self-KOs / void deaths
- Pickups collected / biggest hit
- Weapon-use counts and most-used-weapon summary
- Server-generated match event feed
- Death attribution: player / self-KO / void / shooter-caused terrain collapse
- End-of-match summary
- Host SAME MAP rematch
- Host RANDOM MAP rematch
- Frontend/server CI and regression tests

## Phase 6E balance baseline

The current pickup distribution is exactly 100 weight points:
- Heavy Bomb: 25
- Triple Shot: 20
- Cluster Bomb: 20
- Shield: 12
- Heal +30: 12
- Air Strike: 8
- Nuke Laser: 3

Gameplay baseline remains:
- 40 s turns
- pickup every 3 turns
- pickup lifetime 4 turns
- max 2 pickups
- free active-turn movement
- jump cooldown ~450 ms
- normal jump visual ~500 ms.

Final feel/balance remains subject to manual play.

## Phase 6F presentation layer

`renderer6f.js` wraps the previous renderer stack and adds presentation only:
- LIVE spectator feed with active player, selected weapon, angle, power and wind
- active weapon badge anchored to the animated vehicle
- weapon-specific resolution ribbons
- inherited Air Strike and Nuke world-space effects
- exact inherited camera view.

`combat-controls6f.js` adds active weapon / spectator telemetry to the battle HUD without changing input authority.

Current renderer cache key: `phase6f-spectator-polish-2`.

## Phase 7A.1 — Match Stats & Event Tracking

`phase7a1.js` observes the actual authoritative server state before/after gameplay resolutions instead of duplicating the historical combat resolvers.

Per-player authoritative stats:
- damage dealt
- damage received
- kills
- assists
- deaths
- self-KOs
- void deaths
- pickups
- biggest hit
- successful weapon/utility uses
- per-weapon use counts.

Important invariants:
- self-damage increases damage received but does not increase damage dealt or biggest hit;
- pure environmental void death does not convert remaining HP into fake damage;
- if an actual impact deals damage and that same resolution also causes a void death, only the real `lastDamage` amount is credited;
- kills are credited to a non-self source when applicable;
- assist rule for v1: every other prior non-self contributor to that victim in the current match gets one assist when another player gets the kill.

The server also publishes a capped match event feed and death-attribution metadata.

`match-stats7a1.js` displays the live scoreboard as a DOM panel separate from the Canvas renderer. It shows damage, kills, assists, damage taken, pickups, uses and biggest hit plus recent events.

The final summary includes:
- result/winner
- duration
- turns
- top damage
- top kills in authoritative state
- most-used weapon.

## Phase 7A.2 — Rematch & Match Loop

At match end, the host can choose:
- `REMATCH // SAME MAP`
- `REMATCH // RANDOM MAP`

A rematch preserves:
- private room code
- connected players
- game mode
- teams.

It resets:
- HP / alive state
- arena/craters
- pickups
- inventories
- selected weapon
- Shield
- previous telemetry/results.

The retained players are readied automatically and exactly one fresh countdown is started. RANDOM rematch intentionally selects a different concrete terrain from the previous match.

The lobby terrain selector also includes `RANDOM MAP`; selecting it resolves immediately to a concrete terrain and resets READY states.

## Phase 7A automated QA

`test/phase7a.test.js` covers core multiplayer contracts:
- 8-player Survival turn-cycle wrap
- balanced Team 2v2 alternation
- spectator aim/weapon parity
- free movement beyond the old ±520 envelope
- more than two jumps after normal cooldown/motion timing
- shot-in-flight movement lock.

`test/phase7a1.test.js` additionally covers:
- zeroed public telemetry
- weapon/utility usage tracking
- self-damage leaderboard invariant
- real impact damage + void-death attribution
- same-map rematch reset
- random rematch
- RANDOM lobby terrain
- non-host rematch rejection.

These automated tests are evidence for server contracts only; they do not replace browser/network/game-feel QA.

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
- Match event feed server cap: 36 recent events

## Current terrain presets

- Rolling Expanse
- Terrace Line
- Twin Peaks
- Impact Basin
- Broken Ridge
- Drift Islands
- Canyon Run
- RANDOM MAP selector resolves to one of the concrete presets.

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
- Phase 6D — Nuke + free movement + live spectator aim ✅ implementation; manual PC QA pending
- Phase 6E — Balance & Gameplay Tuning ✅ baseline implementation; manual balance QA pending
- Phase 6F — Visual & Spectator Polish ✅ implementation; manual visual QA pending
- Phase 7A — Full Multiplayer QA 🔄 automated contracts passed; manual full QA pending
- Phase 7A.1 — Match Stats & Event Tracking ✅ implementation; manual validation pending
- Phase 7A.2 — Rematch & Match Loop ✅ implementation; manual validation pending
- Phase 7B — Bugfix & Regression Hardening ⏳
- Later presentation block — map edits/new maps/vehicle visual redesign/polish ⏳
- Phase 8 — Release Candidate / Final Polish ⏳
- Phase 9 — v1.0 Release ⏳

## Automated baseline

Current post-feature gate:
- `COBY_DEBUG_V13.txt`: PASS after two confirmed fixes
- latest Phase 7A telemetry Server CI: SUCCESS
- corrected Phase 7A frontend CI: SUCCESS
- corrected Phase 7A GitHub Pages deployment: SUCCESS.

Automated checks do not replace manual desktop QA.

## Development rules

Gameplay-critical state remains server authoritative: turns, damage, inventory, projectile/special resolution, pickups, deaths, stats attribution, rematch state and victory.

Starting-player weighting against the host is intentional and must not be "fixed" unless explicitly changed.

The Phase 6E 100-point pool remains the baseline, not a guarantee that manual play will never justify tuning.

When performing a Coby Debug, distinguish confirmed code bugs from manual visual/gameplay checks. Anything requiring actual play/visual inspection belongs in the highest-numbered TODO list and must not be marked complete without manual testing.

Older summaries may describe a feature as pending even when later commits implemented it. In conflicts, current executable code and later commits win.
