export const HUANCAVELICA_ID = 'huancavelica';
export const HUANCAVELICA_IMAGE_WIDTH = 1448;
export const HUANCAVELICA_IMAGE_HEIGHT = 1086;
export const HUANCAVELICA_WORLD_WIDTH = 5000;
export const HUANCAVELICA_WORLD_HEIGHT = 5000;
export const HUANCAVELICA_ALPHA_THRESHOLD = 16;

const ASSET_URLS = Object.freeze({
  background: new URL('./assets/huancavelica/background.png', import.meta.url).href,
  terrain: new URL('./assets/huancavelica/terrain.png', import.meta.url).href,
  mask: new URL('./assets/huancavelica/mask.png', import.meta.url).href,
  decor: new URL('./assets/huancavelica/decor.png', import.meta.url).href
});

let cleanCollisionMask = null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const isHuancavelicaRoom = room => (
  room?.terrainPreset === HUANCAVELICA_ID || room?.arena?.phase10Theme === HUANCAVELICA_ID
);

export function huancavelicaWorldToImage(x, y) {
  return {
    x: Number(x) / HUANCAVELICA_WORLD_WIDTH * HUANCAVELICA_IMAGE_WIDTH,
    y: Number(y) / HUANCAVELICA_WORLD_HEIGHT * HUANCAVELICA_IMAGE_HEIGHT
  };
}

export function huancavelicaImageToWorld(x, y) {
  return {
    x: Number(x) / HUANCAVELICA_IMAGE_WIDTH * HUANCAVELICA_WORLD_WIDTH,
    y: Number(y) / HUANCAVELICA_IMAGE_HEIGHT * HUANCAVELICA_WORLD_HEIGHT
  };
}

function craterContains(crater, x, y) {
  const cx = Number(crater?.x), cy = Number(crater?.y), radius = Math.max(0, Number(crater?.radius));
  return [cx, cy, radius].every(Number.isFinite) && radius > 0 && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

export function huancavelicaIsSolid(room, x, y) {
  if (!cleanCollisionMask) return false;
  const image = huancavelicaWorldToImage(x, y);
  const px = Math.floor(image.x), py = Math.floor(image.y);
  if (px < 0 || px >= HUANCAVELICA_IMAGE_WIDTH || py < 0 || py >= HUANCAVELICA_IMAGE_HEIGHT) return false;
  if (!cleanCollisionMask[py * HUANCAVELICA_IMAGE_WIDTH + px]) return false;
  return !(room?.arena?.craters ?? []).some(crater => craterContains(crater, Number(x), Number(y)));
}

function surfaceNear(room, x, targetY, radius = 460) {
  if (!cleanCollisionMask) return null;
  const imageX = clamp(Math.floor(huancavelicaWorldToImage(x, 0).x), 0, HUANCAVELICA_IMAGE_WIDTH - 1);
  const centerY = huancavelicaWorldToImage(0, targetY).y;
  const radiusPixels = Math.max(2, Math.ceil(radius / HUANCAVELICA_WORLD_HEIGHT * HUANCAVELICA_IMAGE_HEIGHT));
  for (let delta = 0; delta <= radiusPixels; delta += 1) {
    for (const py of delta ? [Math.floor(centerY - delta), Math.ceil(centerY + delta)] : [Math.round(centerY)]) {
      if (py < 0 || py >= HUANCAVELICA_IMAGE_HEIGHT) continue;
      const worldY = huancavelicaImageToWorld(0, py).y;
      if (huancavelicaIsSolid(room, x, worldY) && !huancavelicaIsSolid(room, x, huancavelicaImageToWorld(0, py - 1).y)) return worldY;
    }
  }
  return null;
}

export function huancavelicaPlatformY(room, platform, x) {
  const px = clamp(Number(x), Number(platform?.x1 ?? x), Number(platform?.x2 ?? x));
  return surfaceNear(room, px, Number(platform?.y ?? HUANCAVELICA_WORLD_HEIGHT), Math.max(460, Number(platform?.depth ?? 0) * .72)) ?? Number(platform?.y ?? HUANCAVELICA_WORLD_HEIGHT);
}

export function huancavelicaTerrainY(room, x) {
  if (!cleanCollisionMask) {
    const matches = (room?.arena?.platforms ?? []).filter(platform => x >= Number(platform.x1) && x <= Number(platform.x2));
    return matches.length ? Math.min(...matches.map(platform => Number(platform.y))) : Number(room?.arena?.worldHeight ?? HUANCAVELICA_WORLD_HEIGHT);
  }
  for (let py = 0; py < HUANCAVELICA_IMAGE_HEIGHT; py += 1) {
    const y = huancavelicaImageToWorld(0, py).y;
    if (huancavelicaIsSolid(room, x, y)) return y;
  }
  return HUANCAVELICA_WORLD_HEIGHT;
}

function imageFor(url, onLoad) {
  const image = new Image();
  image.decoding = 'async';
  image.addEventListener('load', () => onLoad(image), { once: true });
  image.src = url;
  return image;
}

export function createHuancavelicaPainter(ctx, canvas) {
  let backgroundImage = null;
  let terrainImage = null;
  let maskImage = null;
  let decorImage = null;
  let terrainCanvas = null;
  let decorCanvas = null;
  let damageSignature = null;

  const createLayerCanvas = image => {
    const layer = document.createElement('canvas');
    layer.width = HUANCAVELICA_IMAGE_WIDTH;
    layer.height = HUANCAVELICA_IMAGE_HEIGHT;
    layer.getContext('2d').drawImage(image, 0, 0);
    return layer;
  };

  const initializeCollision = image => {
    const source = createLayerCanvas(image);
    const pixels = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, HUANCAVELICA_IMAGE_WIDTH, HUANCAVELICA_IMAGE_HEIGHT).data;
    cleanCollisionMask = new Uint8Array(HUANCAVELICA_IMAGE_WIDTH * HUANCAVELICA_IMAGE_HEIGHT);
    for (let index = 0, pixel = 0; index < cleanCollisionMask.length; index += 1, pixel += 4) cleanCollisionMask[index] = pixels[pixel + 3] >= HUANCAVELICA_ALPHA_THRESHOLD ? 1 : 0;
  };

  const resetDamageLayers = () => {
    if (!terrainImage || !decorImage) return;
    terrainCanvas = createLayerCanvas(terrainImage);
    decorCanvas = createLayerCanvas(decorImage);
    damageSignature = null;
  };

  backgroundImage = imageFor(ASSET_URLS.background, image => { backgroundImage = image; });
  maskImage = imageFor(ASSET_URLS.mask, image => { maskImage = image; });
  terrainImage = imageFor(ASSET_URLS.terrain, image => {
    terrainImage = image;
    initializeCollision(image);
    resetDamageLayers();
  });
  decorImage = imageFor(ASSET_URLS.decor, image => {
    decorImage = image;
    resetDamageLayers();
  });

  function clearCrater(layer, crater) {
    const center = huancavelicaWorldToImage(crater.x, crater.y);
    const radius = Math.max(0, Number(crater.radius));
    if (![center.x, center.y, radius].every(Number.isFinite) || radius <= 0) return;
    const radiusX = radius / HUANCAVELICA_WORLD_WIDTH * HUANCAVELICA_IMAGE_WIDTH;
    const radiusY = radius / HUANCAVELICA_WORLD_HEIGHT * HUANCAVELICA_IMAGE_HEIGHT;
    const layerCtx = layer.getContext('2d');
    layerCtx.save();
    layerCtx.globalCompositeOperation = 'destination-out';
    layerCtx.translate(center.x, center.y);
    layerCtx.scale(radiusX, radiusY);
    layerCtx.beginPath();
    layerCtx.arc(0, 0, 1, 0, Math.PI * 2);
    layerCtx.fill();
    layerCtx.restore();
  }

  function syncDamage(room) {
    if (!terrainCanvas || !decorCanvas) return;
    const craters = room?.arena?.craters ?? [];
    const signature = craters.map(crater => [crater.id ?? '', Number(crater.x), Number(crater.y), Number(crater.radius)].join(':')).join('|');
    if (signature === damageSignature) return;
    terrainCanvas = createLayerCanvas(terrainImage);
    decorCanvas = createLayerCanvas(decorImage);
    for (const crater of craters) {
      clearCrater(terrainCanvas, crater);
      clearCrater(decorCanvas, crater);
    }
    damageSignature = signature;
  }

  function sourceRect(view) {
    const current = view ?? { x: 0, y: 0, width: HUANCAVELICA_WORLD_WIDTH, height: HUANCAVELICA_WORLD_HEIGHT };
    return {
      x: current.x / HUANCAVELICA_WORLD_WIDTH * HUANCAVELICA_IMAGE_WIDTH,
      y: current.y / HUANCAVELICA_WORLD_HEIGHT * HUANCAVELICA_IMAGE_HEIGHT,
      width: current.width / HUANCAVELICA_WORLD_WIDTH * HUANCAVELICA_IMAGE_WIDTH,
      height: current.height / HUANCAVELICA_WORLD_HEIGHT * HUANCAVELICA_IMAGE_HEIGHT
    };
  }

  function drawLayer(layer, view) {
    if (!layer) return;
    const source = sourceRect(view);
    ctx.drawImage(layer, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  }

  function drawBackdrop(view) {
    if (backgroundImage?.complete && backgroundImage.naturalWidth === HUANCAVELICA_IMAGE_WIDTH && backgroundImage.naturalHeight === HUANCAVELICA_IMAGE_HEIGHT) drawLayer(backgroundImage, view);
    else {
      ctx.fillStyle = '#51b5ea';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawTerrain(room, view) {
    syncDamage(room);
    drawLayer(terrainCanvas, view);
    drawLayer(decorCanvas, view);
  }

  function getAssetState() {
    return Object.freeze({
      ready: Boolean(backgroundImage?.complete && terrainCanvas && maskImage?.complete && decorCanvas && cleanCollisionMask),
      width: HUANCAVELICA_IMAGE_WIDTH,
      height: HUANCAVELICA_IMAGE_HEIGHT,
      maskSource: 'terrain-alpha',
      damageSignature
    });
  }

  return Object.freeze({ drawBackdrop, drawTerrain, getAssetState });
}

export const huancavelicaBitmapTestHooks = Object.freeze({ ASSET_URLS, craterContains, surfaceNear });
