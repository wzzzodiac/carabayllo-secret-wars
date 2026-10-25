# Chacras del Chillón / Cantera de Carabayllo

Production bitmap maps, preserving Walter's approved illustrated concepts.
The background and source terrain were generated previously with built-in
image_gen; exact generation prompts remain in prompts.json. No new AI art was
used for the gameplay conversion.

For each folder (chacras and cantera):
- background.png: original non-colliding panorama,1672 ×941.
- terrain.png: original approved transparent source illustration,1672 ×941.
- terrain-bitmap.png: aligned playable terrain,1672 ×1672, baked from the existing
  illustrated heightfield view. RGB artwork is retained; alpha is cleaned to0/255.
- mask.png: white solid pixels / transparent air,1672 ×1672. Its alpha matches
  terrain-bitmap.png exactly, on every pixel.

The server loads the same mask as packed bits from backend/assets/*-terrain-mask.bin.
Both use scale5000/1672 and a5000 ×5000 world. Initial ledges and all three quarry
fissures retain the previous layout, within one raster pixel (~2.99 world units).
After a shot, the bitmap is authoritative: circular holes, underground tunnels,
remaining roofs, walls, ground support and falling all use that same solid map.
The old additive heightfield crater is no longer used for these production maps.

Scenic corn/trees/buildings/machinery stay in the background. Rim vegetation and
vines are baked into the destructible illustrated terrain. Huancavelica's original
art, mask, dimensions, balance and default deterministic gameplay stay unchanged.

Reproduction:
1. node qa-evidence/map-selection-20261025/export-bitmap-bake.mjs from workspace root
2. Open frontend/test/bake-themed-maps.html locally and run its bake action.
   Export the four DOM canvases' data-png attributes to the terrain-bitmap/mask PNGs.
3. Pack mask alpha>=128, row-major, least-significant bit first, to the server bin.
   frontend/test/themed-bitmap-regressions.mjs verifies all PNG/art/bin pixels.

Runtime: bitmap-map.js, simulation/themed-maps.js, server phase12-themed-maps.js.
Both maps are available in the multiplayer lobby and practice.html's Map selector.
The original legacy-map-art.js stays only for historical heightfield previews
and for reproducing the artwork bake, not for production bitmap collision.
