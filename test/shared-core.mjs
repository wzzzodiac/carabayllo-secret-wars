import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeRgbaPng} from './frontend-source-regressions.mjs';
import {runCoreScenario} from './core-scenario.js';
const {pixels}=decodeRgbaPng(readFileSync(new URL('../assets/huancavelica-v2/mask.png',import.meta.url)));
const mask=new Uint8Array(Math.ceil(1448*1086/8));for(let i=0;i<1448*1086;i++)if(pixels[i*4+3]>=128)mask[i>>3]|=1<<(i&7);
const cases=runCoreScenario(mask),digest=createHash('sha256').update(JSON.stringify(cases)).digest('hex');
assert.equal(digest,'58169e4bfa7e91a342eac12069fbac955e87d033ebe41f7e4fdf1198d9cd964b','paired Node authority fixture equivalence, 1e-6 world tolerance');
console.log('G08 browser-distributed pure core vs authority fixture: PASS '+digest);
if(process.argv.includes('--practice')){
 const {runPracticeRegressions}=await import('./practice-regressions.mjs');runPracticeRegressions(mask);
 const {runFeelLabScenario}=await import('./feel-lab-scenario.js');console.log('Local feel lab: PASS '+JSON.stringify(runFeelLabScenario(mask)));
 const {runDesktopUiRegressions}=await import('./desktop-ui-regressions.mjs');runDesktopUiRegressions(mask);
 const {runAppearanceRegressions}=await import('./appearance-regressions.mjs');runAppearanceRegressions();
 const {runAvatarWorldRegressions}=await import('./avatar-world-regressions.mjs');runAvatarWorldRegressions();
}

const {runLegacyMapArtRegressions}=await import('./legacy-map-art-regressions.mjs');runLegacyMapArtRegressions();

const {runThemedBitmapRegressions}=await import('./themed-bitmap-regressions.mjs');runThemedBitmapRegressions();
const {runSomberArtRegressions}=await import('./somber-art-regressions.mjs');runSomberArtRegressions();
const {runArsenalRegressions}=await import('./arsenal-regressions.mjs');runArsenalRegressions();
