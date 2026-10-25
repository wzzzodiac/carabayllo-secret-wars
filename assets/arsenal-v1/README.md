# Arsenal v1

Production artwork for Basic, Heavy Bomb, Triple Shot, Cluster Bomb, Air Strike,
Nuke Laser, Shield and Heal +20. Local implementation, 2026-10-25.

The approved concept is `../../../concept-art/weapon-proposals-20261025/arsenal-proposal.png`.
The objects and four-stage impact art were generated with the built-in ImageGen
tool using that concept as the design reference, with genuine transparent alpha.
No third-party game sprites were extracted.

- `objects.png`: ten isolated objects, 1920 × 768. Triple uses one dart three times;
  Cluster and Air Strike have dedicated subcharge and falling-bomb sprites.
- `impact.png`: four impact stages, 2048 × 683, with a common ground anchor.
- `manifest.js`: tight source rectangles and impact anchor.

Exact generation prompts, source images, packaging script and report are in
`../../../concept-art/arsenal-production-20261025/`. Packaging only crops, resizes
and arranges the generated art; it does not recreate it procedurally.

Runtime integration is in `../../weapon-art.js`. Rotation follows the projected
authoritative velocity; explosions use authoritative impact positions/timestamps.
Pickup art, equipment icons, shield mesh and healing pulse share this presentation
layer. This asset set does not define damage, collision, physics or inventory rules.

Visual scale: pickups use 80% of the local rider/vehicle's authored width;
projectiles (including subcharges and Air Strike bombs) use 50% of their owner's
width. Both follow the avatar's camera scale without pixel-size clamps. Pickup
art is anchored above its original ground point; collection bounds are unchanged.
Ground pickups turn around their vertical axis every 4.2 seconds, retaining a
readable narrow edge. A low-opacity, item-colored radial backlight and soft rim
separate them from the scenery. Original atlas pixels are not tinted or replaced.

Validation: `npm run check`; browser review: `/test/arsenal-review.html`.
