import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const visual = read('renderer7a-visual.js');
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
assert.match(index, /renderer7a-visual\.js\?v=v098-csw-runtime-clean-1/, 'Active renderer cache key must point to the cleaned RC renderer');

assert.match(readme, /wzzzodiac\/carabayllo-secret-wars/, 'README must reference the renamed frontend repository');
assert.match(readme, /wzzzodiac\.github\.io\/carabayllo-secret-wars\//, 'README must reference the renamed Pages URL');
assert.doesNotMatch(readme, /wzzzodiac\.github\.io\/orbital-artillery\//, 'README must not advertise the obsolete Pages URL');

console.log('frontend source regressions: PASS');
