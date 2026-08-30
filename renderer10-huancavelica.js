import { createRenderer as createPhase9Renderer } from './renderer7a-visual.js?v=v098-csw-runtime-clean-1';
import { huancavelicaPlatformY, huancavelicaTerrainY, isHuancavelicaRoom } from './huancavelica-map.js?v=phase10-production-map-2';

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

