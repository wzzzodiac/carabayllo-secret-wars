# Orbital Artillery

Browser client for a future 2D turn-based multiplayer artillery game for 2–8 players.

## Current status

**Phase 0 — scaffold only.** No multiplayer gameplay is implemented yet.

Planned architecture:

- Static frontend on GitHub Pages
- Vanilla HTML/CSS/JavaScript + Canvas 2D
- Temporary player names; no accounts in the MVP
- Private room codes for up to 8 players
- Authoritative Node.js + Socket.IO server in the separate `orbital-artillery-server` repository
- Google Cloud Run target with `min instances = 0` and initially `max instances = 1`
- No database for the MVP

## Files

- `index.html` — application shell
- `style.css` — base interface styling
- `client.js` — client bootstrap
- `config.js` — runtime endpoint configuration placeholder
- `socket.js` — future WebSocket/Socket.IO boundary
- `renderer.js` — Canvas renderer scaffold
- `ui.js` — DOM/UI helpers
- `audio.js` — future audio boundary
- `terrain-renderer.js` — terrain rendering scaffold
- `projectile-renderer.js` — projectile rendering scaffold
- `shared/` — constants/protocol names mirrored by the server
- `assets/` — future original/free sprites, audio and maps

## First implementation milestone

Create a private room from one browser, join the same room from seven additional tabs/devices, and show all eight temporary players in the same lobby.

No accounts, rankings, shop, matchmaking, persistent database or gameplay physics should be added before that networking milestone is stable.
