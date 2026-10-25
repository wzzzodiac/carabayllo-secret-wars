# Somber visual direction v1

Production artwork approved from the A/B/C comparison on 2026-10-25.

- Chacras: damp umber earth, olive greenery, blue-grey valley mist.
- Cantera: burnt copper stone, soot, cold quarry backdrop.
- Huancavelica: graphite islands, subdued moss and burgundy foliage, stormy Andes.

`chacras/` and `cantera/` contain opaque 1672×941 backgrounds and transparent
1672×1672 terrain layers. `huancavelica/` contains 1448×1086 background, terrain
and decor layers. Runtime collision still reads the original mask PNGs and
server bins. Every new terrain/decor alpha byte matches its original layer.

`avatars/` contains six RGBA 2048×1024 atlases, one per animal. Each contains eight
complete, individually authored rider-and-vehicle sprites. `manifest.js` stores
their tight rectangles, visual widths and wheel hub samples. The runtime draws
one complete frame, with optional rotating hub clips sampled from that same
frame. It never overlays a separate animal PNG or constructs a cockpit.

Visual size is independent of the original body/hitbox. The wheel baseline,
uniform sprite proportions, slope pitch, landing squash, ground shadows,
terrain contact occlusion and dust remain connected to the existing pose.

Art was generated with built-in image_gen, not procedural terrain painting.
Generation prompts and source PNGs are preserved in the surrounding workspace:
`concept-art/somber-production-20261025/`. Its `build-assets.mjs` performs only
resizing, original-alpha restoration and atlas packing; run with the existing
bundled sharp package available via NODE_PATH. No package was added to the game.

Validation: npm run check; test/integrated-fleet.html; test/bitmap-render-check.html.
Original art remains in assets/map-themes/, assets/huancavelica-v2/ and
assets/mini-squad/ for provenance. These new files replace only presentation.
