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
assert.match(index, /CARABAYLLO SECRET WARS \/\/ VERSION 0\.9\.8 RELEASE CANDIDATE/, 'Footer must use the current game name and RC identity');
assert.match(index, /renderer10-huancavelica\.js\?v=phase10-huancavelica-production-2/, 'Public build must load the authored bitmap Huancavelica pass');
assert.match(phase10, /renderer7a-visual\.js\?v=v098-csw-runtime-clean-1/, 'Huancavelica renderer must continue wrapping the cleaned RC renderer instead of replacing stable presentation mechanics');
assert.doesNotMatch(phase10, /createElement\(['"]canvas['"]\)/, 'Huancavelica must not cover vehicles with an opaque post-gameplay canvas');
assert.match(renderer, /createHuancavelicaPainter/, 'The stable renderer must integrate Huancavelica into the world draw order');
assert.match(renderer, /drawBackground\(room,view\);drawTerrain\(room,view\)/, 'Bitmap scenery and terrain must share the gameplay camera transform');
assert.match(huancavelicaMap, /assets\/huancavelica\/background\.png/, 'Huancavelica must load the supplied authored background');
assert.match(huancavelicaMap, /assets\/huancavelica\/terrain\.png/, 'Huancavelica must load the supplied authored terrain');
assert.match(huancavelicaMap, /assets\/huancavelica\/decor\.png/, 'Huancavelica must load the supplied authored decor');
assert.match(huancavelicaMap, /getImageData\(/, 'Client collision sampling must be derived once from terrain alpha');
assert.match(huancavelicaMap, /globalCompositeOperation = 'destination-out'/, 'Crater replay must remove actual terrain pixels');
assert.match(huancavelicaMap, /drawLayer\(terrainCanvas, view\);\s*drawLayer\(decorCanvas, view\)/, 'Terrain and decor must retain the approved layer order');
assert.doesNotMatch(huancavelicaMap, /drawIsland\(|rockFacet\(|paintRockMass\(|function boulder\(/, 'The production map must not procedurally redraw supplied terrain art');
assert.doesNotMatch(huancavelicaMap, /RUTAS PRINCIPALES|PLATAFORMA CENTRAL|ALPINE RIDGE \/\//, 'Reference annotations must never be painted into the game map');

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

const bitmap = await import('../huancavelica-map.js');
const imagePoint = bitmap.huancavelicaWorldToImage(1875, 3125);
const worldPoint = bitmap.huancavelicaImageToWorld(imagePoint.x, imagePoint.y);
assert.ok(Math.abs(worldPoint.x - 1875) < 1e-9 && Math.abs(worldPoint.y - 3125) < 1e-9, 'World/image transforms must be exact inverses');

assert.match(readme, /wzzzodiac\/carabayllo-secret-wars/, 'README must reference the renamed frontend repository');
assert.match(readme, /wzzzodiac\.github\.io\/carabayllo-secret-wars\//, 'README must reference the renamed Pages URL');
assert.doesNotMatch(readme, /wzzzodiac\.github\.io\/orbital-artillery\//, 'README must not advertise the obsolete Pages URL');

console.log('frontend source regressions: PASS');
