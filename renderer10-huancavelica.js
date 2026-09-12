import { createRenderer as createPhase9Renderer } from './renderer7a-visual.js?v=v098-csw-runtime-clean-1';
import { huancavelicaPlatformY, huancavelicaTerrainY, isHuancavelicaRoom } from './huancavelica-map.js?v=phase10-production-map-3';
import { HUANCAVELICA_V2_REVISION, huancavelicaV2RevisionCompatible, huancavelicaV2TerrainY, isHuancavelicaV2Room } from './huancavelica-v2-map.js?v=huancavelica-v2-bitmap-1';

// Huancavelica renders inside the base world pass, between the scenic
// background and gameplay entities. This wrapper deliberately owns no opaque
// canvas: vehicles, pickups and projectiles remain visible while the same
// server platform geometry drives art, aiming previews and destruction.
export function createRenderer(canvas, config) {
  return createPhase9Renderer(canvas, config);
}

export const phase10HuancavelicaVisualTestHooks = Object.freeze({
  isHuancavelica: isHuancavelicaRoom,
  platformY: huancavelicaPlatformY,
  terrainY: huancavelicaTerrainY
});

export const phase11HuancavelicaV2VisualTestHooks=Object.freeze({
  revision:HUANCAVELICA_V2_REVISION,
  isHuancavelicaV2:isHuancavelicaV2Room,
  revisionCompatible:huancavelicaV2RevisionCompatible,
  terrainY:huancavelicaV2TerrainY
});
