import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {LEGACY_MAP_ART,terrainArtProfile,artColumnForWorld} from '../legacy-map-art.js';
import {decodeRgbaPng} from './frontend-source-regressions.mjs';

export function runLegacyMapArtRegressions(){
 for(const [id,theme]of Object.entries(LEGACY_MAP_ART)){
  const png=decodeRgbaPng(readFileSync(new URL('../assets/map-themes/'+theme.folder+'/terrain.png',import.meta.url))),profile=terrainArtProfile(png.pixels,png.width,png.height);
  assert.equal(profile.sections.length,theme.sections.length,id+' transparent regions');
  for(let x=0;x<5000;x++){
   const sx=artColumnForWorld(x,theme.sections,profile.sections,theme.anchors,png.width);
   if(theme.sections.some(([a,b])=>x>=a&&x<b)){assert.ok(sx>=0&&sx<png.width);assert.ok(profile.tops[sx]>=0);}
   else assert.equal(sx,null,'never sample art across a void');
  }
 }
 // Compare the actual renderer's existing functions against snapshots exported
 // from the composed server, before and after an actual resolved attack.
 const source=readFileSync(new URL('../renderer.js',import.meta.url),'utf8'),lines=source.split(/\r?\n/);
 const statement=part=>lines.find(line=>line.includes(part)).trim();
 const functions=[statement('const TERRAIN_HOLES='),statement('const gaussian='),statement('const plateau='),statement('function baseTerrainY('),statement('function terrainY(')].join('\n');
 const sample=vm.runInNewContext(functions+'\nterrainY',{Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),isThemedBitmapRoom:()=>false,isHuancavelicaV2Room:()=>false,isHuancavelicaRoom:()=>false});
 const fixtures=JSON.parse(readFileSync(new URL('./map-art-authority.json',import.meta.url),'utf8'));
 let checks=0;
 for(const fixture of fixtures)for(const phase of ['before','after']){
  const {room,surface}=fixture[phase];for(let i=0;i<surface.length;i++){assert.equal(sample(i*10,room),surface[i]);checks++;}
 }
 console.log('Themed maps: real PNG alpha / four quarry sections / UV bounds / '+checks+' exact authority surface samples: PASS');
}
