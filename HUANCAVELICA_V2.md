# Huancavelica Simulator v2 frontend

Huancavelica v2 is an authored-bitmap map, identified by `huancavelica-v2` and revision `huancavelica-v2-bitmap-1`. `Huancavelica_Simualtor_v2.png` is the approved final-composition reference. The production renderer preserves that composition by layering the supplied 1448×1086 `background.png`, `terrain.png`, and `decor.png`; it does not redraw islands or scenery procedurally.

## Canonical transform and rendering

The image maps to a 5000×3750 world with one uniform scale, `5000 / 1448`. Collision, projectile previews, and crater radii remain in this unchanged authored world/image space. For display, `huancavelicaV2Projection` maps the camera source rectangle onto the entire standard gameplay canvas (1600×900). On a 16:9 canvas this final screen projection is non-uniform: it widens the complete 4:3 composition without cropping islands or leaving bands. Background, terrain, decor, vehicles, labels, pickups, projectile paths and impacts, crater cutouts, and spectator world-space overlays all share the same projection; pointer/aim input uses its exact inverse. A circular world-space crater therefore projects to the same screen-space ellipse in both collision and visible terrain. Do not stretch any layer independently.

Layer order is background, mutable terrain, mutable decor, pickups/aim/gameplay entities, then HUD. Terrain and decor are rebuilt from their clean supplied PNGs whenever the authoritative crater signature changes, and every crater is replayed with `destination-out` in image space.

## Collision authority

`assets/huancavelica-v2/mask.png` is a cleaned binary collision mask derived from the supplied Terrain alpha and audited against the supplied Mask. Cleanup removes transparent antialias debris and non-supporting hanging vegetation while preserving 19 authored island masses. The browser decodes this mask once. It is authoritative for visual ground lookup and projectile-preview contact; server state remains authoritative for actual movement, shots, destruction, spawns, and pickups.

The old Huancavelica platform graph is not used by v2 physics. Huancavelica v1 remains in code only for legacy-room recovery and regression tests; it is no longer publicly selectable. All other maps keep their established renderers.

## Revision safety

The frontend accepts v2 only when the server announces both:

- terrain revision `huancavelica-v2-bitmap-1`
- collision model `bitmap-terrain-mask-v2`

On mismatch, match start is disabled and the renderer shows a controlled compatibility message instead of silently running different terrain rules.

## Verification

`node test/frontend-source-regressions.mjs` locks supplied-asset hashes and dimensions, binary-mask pixel count, uniform transform behavior, authored layer order, crater composition, and absence of procedural terrain construction. Browser runtime verification still checks the actual Canvas renderer at several viewport sizes and multiplayer state against the backend.
