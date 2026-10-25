import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {decodeRgbaPng}from'./frontend-source-regressions.mjs';
const png=file=>decodeRgbaPng(readFileSync(new URL('../assets/'+file,import.meta.url)));
export function runSomberArtRegressions(){
 let pixels=0;
 for(const [folder,old,file]of [
  ['chacras','map-themes/chacras/terrain-bitmap.png','terrain.png'],
  ['cantera','map-themes/cantera/terrain-bitmap.png','terrain.png'],
  ['huancavelica','huancavelica-v2/terrain.png','terrain.png'],
  ['huancavelica','huancavelica-v2/decor.png','decor.png']
 ]){
  const a=png(old),b=png('somber-v1/'+folder+'/'+file);assert.equal(b.width,a.width);assert.equal(b.height,a.height);
  let mismatch=0,changed=0,solid=0;
  for(let i=0;i<a.pixels.length;i+=4){
   if(a.pixels[i+3]!==b.pixels[i+3])mismatch++;
   if(a.pixels[i+3]>=128){solid++;if(Math.abs(a.pixels[i]-b.pixels[i])+Math.abs(a.pixels[i+1]-b.pixels[i+1])+Math.abs(a.pixels[i+2]-b.pixels[i+2])>25)changed++;}
   pixels++;
  }
  assert.equal(mismatch,0,'new illustration preserves every authored terrain/decor alpha pixel');
  assert.ok(changed>solid*.65,'production layer actually uses the new authored RGB art');
 }
 for(const [folder,old]of [['chacras','map-themes/chacras'],['cantera','map-themes/cantera'],['huancavelica','huancavelica-v2']]){
  const a=png(old+'/background.png'),b=png('somber-v1/'+folder+'/background.png');assert.equal(b.width,a.width);assert.equal(b.height,a.height);
  const luminance=p=>{let total=0;for(let i=0;i<p.pixels.length;i+=4){assert.equal(p.pixels[i+3],255);total+=p.pixels[i]*.2126+p.pixels[i+1]*.7152+p.pixels[i+2]*.0722;}return total/(p.width*p.height);};
  const before=luminance(a),after=luminance(b);assert.ok(after<before*.85,'scenery has the approved darker treatment');assert.ok(after>25,'scenery retains readable midtones');
 }
 console.log('Somber art: '+pixels+' identical alpha pixels / three opaque darker backdrops / new production illustrations: PASS');
}
