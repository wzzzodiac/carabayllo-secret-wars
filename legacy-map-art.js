// Illustrated layers follow the existing heightfield. They never define physics.
export const LEGACY_MAP_ART=Object.freeze({
 rolling:Object.freeze({name:'Chacras del Chillón',folder:'chacras',sky:'#82c9ed',sections:[[0,5000]],anchors:[[0,0],[700,155],[1120,310],[1760,602],[2140,757],[2840,960],[3240,1116],[3890,1385],[4320,1552],[5000,1672]]}),
 brokenridge:Object.freeze({name:'Cantera de Carabayllo',folder:'cantera',sky:'#df9d79',sections:[[0,1010],[1140,2410],[2550,3860],[3980,5000]],anchors:[[0,0],[420,145],[900,273],[1010,325],[1140,359],[1260,366],[1720,487],[1900,631],[2320,763],[2410,822],[2550,858],[2700,915],[3160,1051],[3330,1125],[3770,1256],[3860,1326],[3980,1359],[4140,1398],[4620,1549],[5000,1672]]})
});
export const legacyMapId=room=>room?.terrainPreset??room?.arena?.terrainPreset;

// Find substantial opaque ground, ignoring isolated leaves/antialiasing above it.
// This is a texture UV guide, not a collision mask or a source of new platforms.
export function terrainArtProfile(pixels,width,height){
 const tops=new Int32Array(width).fill(-1),sections=[];
 for(let x=0;x<width;x++){
  let run=0;
  for(let y=0;y<height;y++){
   run=pixels[(y*width+x)*4+3]>=200?run+1:0;
   if(run>=24){tops[x]=y-run+1;break;}
  }
 }
 let start=-1;
 for(let x=0;x<=width;x++){
  if(x<width&&tops[x]>=0){if(start<0)start=x;}
  else if(start>=0){if(x-start>=width*.03)sections.push([start,x]);start=-1;}
 }
 return {tops,sections};
}

export function artColumnForWorld(x,worldSections,sourceSections,anchors=null,sourceWidth=1672){
 const i=worldSections.findIndex(([a,b])=>x>=a&&x<b);
 if(i<0)return null;
 const [a,b]=worldSections[i],[left,right]=sourceSections[i];
 if(anchors){
  const next=anchors.findIndex(([wx])=>wx>x),[wa,sa]=anchors[next-1],[wb,sb]=anchors[next];
  return Math.max(left,Math.min(right-1,Math.floor((sa+(x-wa)/(wb-wa)*(sb-sa))*sourceWidth/1672)));
 }
 return Math.min(right-1,Math.floor(left+(x-a)/(b-a)*(right-left)));
}

export function createLegacyMapPainter(ctx,canvas,{baseTerrainY,terrainY}){
 const assets=new Map();let disposed=false;
 function load(id){
  if(assets.has(id))return assets.get(id);
  const theme=LEGACY_MAP_ART[id];if(!theme)return null;
  const state={theme,background:null,terrain:null,profile:null,base:null,damaged:null,signature:null,error:null};assets.set(id,state);
  for(const kind of ['background','terrain']){
   const img=new Image();img.onload=()=>{
    if(disposed)return;state[kind]=img;
    if(kind==='terrain'){
     const scratch=document.createElement('canvas');scratch.width=img.naturalWidth;scratch.height=img.naturalHeight;
     const c=scratch.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);
     state.profile=terrainArtProfile(c.getImageData(0,0,scratch.width,scratch.height).data,scratch.width,scratch.height);
     if(state.profile.sections.length!==theme.sections.length){state.error='Unexpected terrain art sections: '+state.profile.sections.length;state.profile=null;console.error('[Map art]',id,state.error);}
    }
   };
   img.onerror=()=>{if(!disposed){state.error='Unable to load '+id+'/'+kind;console.error('[Map art]',state.error);}};
   img.src=new URL('./assets/map-themes/'+theme.folder+'/'+kind+'.png',import.meta.url).href;
  }
  return state;
 }
 function layerToScreen(layer,room,view){
  const scale=layer.width/room.arena.worldWidth;
  ctx.drawImage(layer,view.x*scale,view.y*scale,view.width*scale,view.height*scale,0,0,canvas.width,canvas.height);
 }
 function buildBase(state,room,id){
  const {worldWidth:w,worldHeight:h}=room.arena,scale=.5;
  const base=document.createElement('canvas');base.width=Math.ceil(w*scale);base.height=Math.ceil(h*scale);
  const c=base.getContext('2d'),img=state.terrain,{tops,sections}=state.profile;
  c.imageSmoothingEnabled=true;
  for(let x=0;x<base.width;x++){
   const wx=x/scale,sx=artColumnForWorld(wx,state.theme.sections,sections,state.theme.anchors,img.naturalWidth);if(sx==null)continue;
   const sy=tops[sx];if(sy<0)continue;
   const y=baseTerrainY(id,wx)*scale;
   c.drawImage(img,sx,sy,1,img.naturalHeight-sy,x,y,1,base.height-y);
  }
  state.base=base;state.damaged=document.createElement('canvas');state.damaged.width=base.width;state.damaged.height=base.height;
 }
 function drawBackdrop(room,view){
  const state=load(legacyMapId(room));if(!state)return false;
  ctx.fillStyle=state.theme.sky;ctx.fillRect(0,0,canvas.width,canvas.height);
  // The illustrated panorama is fixed to world space, including inside fissures.
  if(state.background){const img=state.background,w=room.arena.worldWidth,h=room.arena.worldHeight;ctx.drawImage(img,view.x/w*img.naturalWidth,view.y/h*img.naturalHeight,view.width/w*img.naturalWidth,view.height/h*img.naturalHeight,0,0,canvas.width,canvas.height);}
  // Depth haze belongs to the scenery, never to the destructible layer. Keep
  // the three open quarry fissures legible against the sunlit distant quarry.
  for(let i=1;i<state.theme.sections.length;i++){
   const left=state.theme.sections[i-1][1],right=state.theme.sections[i][0];
   const top=Math.min(baseTerrainY('brokenridge',left-2),baseTerrainY('brokenridge',right+2));
   const sx=(left-view.x)/view.width*canvas.width,sy=(top-view.y)/view.height*canvas.height,bottom=(room.arena.worldHeight-view.y)/view.height*canvas.height;
   const shade=ctx.createLinearGradient(0,sy,0,bottom);shade.addColorStop(0,'rgba(31,28,57,.30)');shade.addColorStop(1,'rgba(21,20,43,.86)');
   ctx.fillStyle=shade;ctx.fillRect(sx,sy,(right-left)/view.width*canvas.width,bottom-sy);
  }
  return true;
 }
 function drawTerrain(room,view){
  const id=legacyMapId(room),state=load(id);if(!state?.terrain||!state.profile)return false;
  if(!state.base)buildBase(state,room,id);
  // Rebuild only on map/damage changes. Shots expose the existing soil pixels;
  // grass is never pasted across a crater or an open fissure.
  const signature=JSON.stringify(room.arena.craters??[]);
  if(state.signature!==signature){
   const layer=state.damaged,c=layer.getContext('2d'),scale=layer.width/room.arena.worldWidth;
   c.clearRect(0,0,layer.width,layer.height);c.save();c.beginPath();
   for(let x=0;x<layer.width;x++){
    const y=terrainY(x/scale,room)*scale;
    if(y<layer.height)c.rect(x,Math.ceil(y),1,layer.height-Math.ceil(y));
   }
   c.clip();c.drawImage(state.base,0,0);c.restore();state.signature=signature;
  }
  layerToScreen(state.damaged,room,view);return true;
 }
 return Object.freeze({drawBackdrop,drawTerrain,getAssetState(id){const s=assets.get(id);return {ready:Boolean(s?.background&&s?.profile&&s?.damaged),error:s?.error??null,sections:s?.profile?.sections??[]};},destroy(){disposed=true;assets.clear();}});
}
