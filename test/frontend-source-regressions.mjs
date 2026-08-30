import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

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
assert.match(index, /renderer10-huancavelica\.js\?v=phase10-huancavelica-production-1/, 'Public build must load the production Huancavelica pass');
assert.match(phase10, /renderer7a-visual\.js\?v=v098-csw-runtime-clean-1/, 'Huancavelica renderer must continue wrapping the cleaned RC renderer instead of replacing stable presentation mechanics');
assert.doesNotMatch(phase10, /createElement\(['"]canvas['"]\)/, 'Huancavelica must not cover vehicles with an opaque post-gameplay canvas');
assert.match(renderer, /createHuancavelicaPainter/, 'The stable renderer must integrate Huancavelica into the world draw order');
assert.match(renderer, /drawBackground\(room\);drawTerrain\(room,view\)/, 'Scenery and terrain must render before gameplay entities');
assert.match(huancavelicaMap, /arena\?\.platforms/, 'Huancavelica visuals must render server-provided multilayer platform geometry');
assert.match(huancavelicaMap, /drawIsland\(/, 'Huancavelica must use organic island silhouettes rather than flat terrain strips');
assert.match(huancavelicaMap, /grassCap\(/, 'Huancavelica must render a layered grassy rim');
assert.match(huancavelicaMap, /boulder\(/, 'Huancavelica terrain must be built from visible rock clusters instead of flat brown slabs');
assert.match(huancavelicaMap, /timberFrame\(/, 'Huancavelica cliffs must support wooden structural detail like the approved concept');
assert.match(huancavelicaMap, /phase10PlatformId/, 'Visual crater deformation must stay bound to the impacted platform');
assert.doesNotMatch(huancavelicaMap, /RUTAS PRINCIPALES|PLATAFORMA CENTRAL|ALPINE RIDGE \/\//, 'Reference annotations must never be painted into the game map');

assert.match(readme, /wzzzodiac\/carabayllo-secret-wars/, 'README must reference the renamed frontend repository');
assert.match(readme, /wzzzodiac\.github\.io\/carabayllo-secret-wars\//, 'README must reference the renamed Pages URL');
assert.doesNotMatch(readme, /wzzzodiac\.github\.io\/orbital-artillery\//, 'README must not advertise the obsolete Pages URL');

console.log('frontend source regressions: PASS');

