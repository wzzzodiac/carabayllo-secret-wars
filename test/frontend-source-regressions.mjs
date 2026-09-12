import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bytes = path => fs.readFileSync(new URL(`../${path}`, import.meta.url));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
const pngDimensions = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

function decodeRgbaPng(buffer) {
  assert.equal(buffer.toString('hex', 0, 8), '89504e470d0a1a0a');
  let offset = 8, width = 0, height = 0, colorType = 0, bitDepth = 0;
  const compressed = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8), data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    if (type === 'IDAT') compressed.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * 4, pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0, source = 0; y < height; y += 1) {
    const filter = raw[source++], row = y * stride, previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[source++], left = x >= 4 ? pixels[row + x - 4] : 0, above = y ? pixels[previous + x] : 0, upperLeft = y && x >= 4 ? pixels[previous + x - 4] : 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[row + x] = (encoded + prediction) & 255;
    }
  }
  return { width, height, pixels };
}

const visual = read('renderer7a-visual.js');
const phase10 = read('renderer10-huancavelica.js');
const huancavelicaMap = read('huancavelica-map.js');
const huancavelicaV2Map = read('huancavelica-v2-map.js');
const renderer = read('renderer.js');
const hud = read('renderer6f.js');
const index = read('index.html');
const readme = read('README.md');

assert.doesNotMatch(visual, /ctx\.moveTo\(tail\.x,t\.y\)/, 'Air Strike trail must not reference an undefined t variable');
assert.match(visual, /ctx\.moveTo\(tail\.x,tail\.y\)/, 'Air Strike trail must use the tail y coordinate');

assert.doesNotMatch(hud, /remaining\s*<=\s*20000/, 'Spectator F1 visibility must not depend on remaining turn time');
assert.match(hud, /voteWindow=Boolean\(vote&&now>=eligibleAt\)/, 'Spectator F1 visibility must follow AFK inactivity eligibility');
assert.match(hud, /AFK SKIP AFTER 20s INACTIVITY/, 'Spectator HUD must describe the inactivity rule');

assert.match(index, /<title>Carabayllo Secret Wars<\/title>/, 'Public title must use the current game name');
assert.match(index, /CARABAYLLO SECRET WARS \/\/ HUANCAVELICA V2/, 'Footer must identify the authored Huancavelica v2 build');
assert.match(index, /renderer10-huancavelica\.js\?v=huancavelica-v2-bitmap-1/, 'Public build must load the strict Huancavelica v2 revision');
assert.match(phase10, /renderer7a-visual\.js\?v=v098-csw-runtime-clean-1/, 'Huancavelica renderer must continue wrapping the cleaned RC renderer instead of replacing stable presentation mechanics');
assert.doesNotMatch(phase10, /createElement\(['"]canvas['"]\)/, 'Huancavelica must not cover vehicles with an opaque post-gameplay canvas');
assert.match(renderer, /createHuancavelicaPainter/, 'The stable renderer must integrate Huancavelica into the world draw order');
assert.match(renderer, /drawBackground\(room,view\);[\s\S]{0,180}drawTerrain\(room,view\)/, 'Bitmap scenery and terrain must share the gameplay camera transform');
assert.match(huancavelicaMap, /assets\/huancavelica\/background\.png/, 'Huancavelica must load the supplied authored background');
assert.match(huancavelicaMap, /assets\/huancavelica\/terrain\.png/, 'Huancavelica must load the supplied authored terrain');
assert.match(huancavelicaMap, /assets\/huancavelica\/decor\.png/, 'Huancavelica must load the supplied authored decor');
assert.match(huancavelicaMap, /getImageData\(/, 'Client collision sampling must be derived once from terrain alpha');
assert.match(huancavelicaMap, /globalCompositeOperation = 'destination-out'/, 'Crater replay must remove actual terrain pixels');
assert.match(huancavelicaMap, /drawLayer\(terrainCanvas, view\);\s*drawLayer\(decorCanvas, view\)/, 'Terrain and decor must retain the approved layer order');
assert.doesNotMatch(huancavelicaMap, /drawIsland\(|rockFacet\(|paintRockMass\(|function boulder\(/, 'The production map must not procedurally redraw supplied terrain art');
assert.doesNotMatch(huancavelicaMap, /RUTAS PRINCIPALES|PLATAFORMA CENTRAL|ALPINE RIDGE \/\//, 'Reference annotations must never be painted into the game map');

assert.match(huancavelicaV2Map, /HUANCAVELICA_V2_REVISION='huancavelica-v2-bitmap-1'/, 'Frontend must publish the strict v2 terrain revision');
assert.match(huancavelicaV2Map, /HUANCAVELICA_V2_COLLISION_MODEL='bitmap-terrain-mask-v2'/, 'Frontend must publish the v2 collision model');
assert.match(huancavelicaV2Map, /Math\.min\(canvas\.width\/current\.width,canvas\.height\/current\.height\)/, 'V2 destination rendering must letterbox with one uniform scale');
assert.match(huancavelicaV2Map, /globalCompositeOperation='destination-out'/, 'V2 crater replay must remove pixels from the authored terrain and decor layers');
assert.match(huancavelicaV2Map, /layerCtx\.arc\(center\.x,center\.y,radius/, 'Uniform world/image scaling must keep v2 crater cuts circular');
assert.doesNotMatch(huancavelicaV2Map, /drawIsland\(|rockFacet\(|paintRockMass\(|function boulder\(/, 'V2 must never procedurally approximate the supplied terrain art');
assert.match(renderer, /huancavelicaV2RevisionCompatible/, 'Renderer must stop on frontend/backend terrain revision mismatch');

const assets = {
  background: bytes('assets/huancavelica/background.png'),
  terrain: bytes('assets/huancavelica/terrain.png'),
  mask: bytes('assets/huancavelica/mask.png'),
  decor: bytes('assets/huancavelica/decor.png')
};
assert.deepEqual(Object.fromEntries(Object.entries(assets).map(([name, value]) => [name, sha256(value)])), {
  background: '0D72A5A9EF1DB09CA684DD1690A3A888A993B91105474AFD3552B7B5804F588E',
  terrain: 'F45060D6FA3F33F7EB1944F58B5ADF458C4CADA3DBE8994C05AA13B3C52167E8',
  mask: '40707D2BDFCC8456DDF5E6F5097B0CD441B6B7DC56ADECDBCFBEF98CCF480A2C',
  decor: 'E0FB9EFA91B0014F0FBC9C179D1BF079005C26F2BBFEBA0B5C2F85636636036D'
});
for (const image of Object.values(assets)) assert.deepEqual(Object.values(pngDimensions(image)), [1448, 1086]);
const decoded = { terrain: decodeRgbaPng(assets.terrain), mask: decodeRgbaPng(assets.mask) };
for (let pixel = 0; pixel < 1448 * 1086; pixel += 1) assert.equal(decoded.mask.pixels[pixel * 4 + 3] === 255, decoded.terrain.pixels[pixel * 4 + 3] >= 16, `terrain/mask mismatch at pixel ${pixel}`);

const v2Assets = {
  background: bytes('assets/huancavelica-v2/background.png'),
  terrain: bytes('assets/huancavelica-v2/terrain.png'),
  mask: bytes('assets/huancavelica-v2/mask.png'),
  decor: bytes('assets/huancavelica-v2/decor.png')
};
assert.deepEqual(Object.fromEntries(Object.entries(v2Assets).map(([name, value]) => [name, sha256(value)])), {
  background: '3E4ED2285EB387A8D738CA5F1E282B78F73CBC597EE3469C807995A38084CDCA',
  terrain: '7765A17148F961046ABFCA4B9203E45DE239FF07A518216EA6F6106C16A776F4',
  mask: 'D6916AB8A2953F87CC664B84C25488222E7AD0845D691E594A0E2C68C892B97B',
  decor: 'BC57D1AA3AAE91766D5883785470FBC50590721CC94AD906B60B2DD925D1699D'
});
for (const image of Object.values(v2Assets)) assert.deepEqual(Object.values(pngDimensions(image)), [1448, 1086]);
const v2Mask = decodeRgbaPng(v2Assets.mask);
let v2SolidPixels = 0;
for (let pixel = 0; pixel < 1448 * 1086; pixel += 1) {
  const alpha = v2Mask.pixels[pixel * 4 + 3];
  assert.ok(alpha === 0 || alpha === 255, `v2 mask alpha must be binary at pixel ${pixel}`);
  if (alpha === 255) v2SolidPixels += 1;
}
assert.equal(v2SolidPixels, 380492, 'Clean v2 mask must keep the audited authored island mass');

const bitmap = await import('../huancavelica-map.js');
const imagePoint = bitmap.huancavelicaWorldToImage(1875, 3125);
const worldPoint = bitmap.huancavelicaImageToWorld(imagePoint.x, imagePoint.y);
assert.ok(Math.abs(worldPoint.x - 1875) < 1e-9 && Math.abs(worldPoint.y - 3125) < 1e-9, 'World/image transforms must be exact inverses');
const bitmapV2 = await import('../huancavelica-v2-map.js');
const v2ImagePoint = bitmapV2.huancavelicaV2WorldToImage(1875, 2812.5);
const v2WorldPoint = bitmapV2.huancavelicaV2ImageToWorld(v2ImagePoint.x, v2ImagePoint.y);
assert.ok(Math.abs(v2WorldPoint.x - 1875) < 1e-9 && Math.abs(v2WorldPoint.y - 2812.5) < 1e-9, 'V2 world/image transforms must be exact uniform inverses');
assert.equal(bitmapV2.HUANCAVELICA_V2_WORLD_HEIGHT, 3750, 'A 4:3 authored image must map to a 4:3 world without stretching');

assert.match(readme, /wzzzodiac\/carabayllo-secret-wars/, 'README must reference the renamed frontend repository');
assert.match(readme, /wzzzodiac\.github\.io\/carabayllo-secret-wars\//, 'README must reference the renamed Pages URL');
assert.doesNotMatch(readme, /wzzzodiac\.github\.io\/orbital-artillery\//, 'README must not advertise the obsolete Pages URL');

console.log('frontend source regressions: PASS');
