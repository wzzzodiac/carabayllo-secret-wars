import { createRenderer as createPhase9Renderer } from './renderer7a-visual.js?v=v098-csw-runtime-clean-1';

const HUANCAVELICA_ID = 'huancavelica';
const LEGACY_COLLISION_PRESET = 'islands';
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;
const HOLES = [[900,1040],[1920,2080],[2910,3070],[3960,4110]];

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const gaussian = (x,center,width,amplitude) => amplitude*Math.exp(-((x-center)**2)/width);

function isHuancavelica(room){
  return room?.terrainPreset===HUANCAVELICA_ID || room?.arena?.phase10Theme===HUANCAVELICA_ID;
}

function roomForLegacyRenderer(room){
  if(!isHuancavelica(room)) return room;
  return {
    ...room,
    terrainPreset:LEGACY_COLLISION_PRESET,
    arena:room.arena?{...room.arena,terrainPreset:LEGACY_COLLISION_PRESET,terrainName:'Huancavelica Simulator'}:room.arena
  };
}

function insideHole(x){return HOLES.some(([left,right])=>x>=left&&x<=right);}
function baseTerrainY(x){
  if(x<900)return 3100-gaussian(x,520,90000,260);
  if(x<1920)return 2840-gaussian(x,1470,125000,190);
  if(x<2910)return 3260-gaussian(x,2480,130000,320);
  if(x<3960)return 2760-gaussian(x,3470,135000,220);
  return 3160-gaussian(x,4540,100000,280);
}
function terrainY(room,x){
  const px=clamp(x,0,WORLD_WIDTH);
  if(insideHole(px))return WORLD_HEIGHT;
  let y=baseTerrainY(px);
  for(const crater of room?.arena?.craters??[]){
    const dx=Math.abs(px-crater.x);
    if(dx<crater.radius)y+=crater.depth*Math.sqrt(Math.max(0,1-(dx/crater.radius)**2));
  }
  return clamp(y,120,WORLD_HEIGHT);
}

export function createRenderer(canvas,config){
  const base=createPhase9Renderer(canvas,config);
  const overlay=document.createElement('canvas');
  overlay.width=canvas.width;
  overlay.height=canvas.height;
  overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let room=null,frameId=null;

  function worldToScreen(x,y,view){return{x:(x-view.x)/view.width*overlay.width,y:(y-view.y)/view.height*overlay.height};}

  function drawSky(){
    const g=ctx.createLinearGradient(0,0,0,overlay.height);
    g.addColorStop(0,'#159cf2');g.addColorStop(.52,'#70caf6');g.addColorStop(1,'#dff3ff');
    ctx.fillStyle=g;ctx.fillRect(0,0,overlay.width,overlay.height);
    const sunX=overlay.width*.84,sunY=overlay.height*.12;
    const sun=ctx.createRadialGradient(sunX,sunY,8,sunX,sunY,140);
    sun.addColorStop(0,'rgba(255,251,190,.98)');sun.addColorStop(.25,'rgba(255,238,130,.55)');sun.addColorStop(1,'rgba(255,238,130,0)');
    ctx.fillStyle=sun;ctx.fillRect(sunX-150,sunY-150,300,300);
    ctx.fillStyle='#fff9cf';ctx.beginPath();ctx.arc(sunX,sunY,38,0,Math.PI*2);ctx.fill();
  }

  function drawCloud(x,y,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='rgba(255,255,255,.93)';ctx.strokeStyle='rgba(80,132,184,.25)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(-46,9,24,0,Math.PI*2);ctx.arc(-18,-3,31,0,Math.PI*2);ctx.arc(18,1,27,0,Math.PI*2);ctx.arc(47,11,21,0,Math.PI*2);ctx.roundRect(-65,7,130,32,16);ctx.fill();ctx.stroke();ctx.restore();
  }

  function drawMountain(cx,base,width,height,near=false){
    const top=base-height;
    ctx.save();ctx.fillStyle=near?'rgba(55,112,142,.42)':'rgba(107,145,188,.42)';
    ctx.beginPath();ctx.moveTo(cx-width/2,base);ctx.lineTo(cx,top);ctx.lineTo(cx+width/2,base);ctx.closePath();ctx.fill();
    ctx.fillStyle=near?'rgba(226,239,244,.82)':'rgba(240,248,255,.88)';
    ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx-width*.12,top+height*.28);ctx.lineTo(cx-width*.02,top+height*.22);ctx.lineTo(cx+width*.08,top+height*.35);ctx.lineTo(cx+width*.18,top+height*.30);ctx.closePath();ctx.fill();ctx.restore();
  }

  function drawBackdrop(){
    drawSky();
    drawCloud(overlay.width*.23,overlay.height*.12,1.15);drawCloud(overlay.width*.58,overlay.height*.19,.82);drawCloud(overlay.width*.73,overlay.height*.10,.72);
    const base=overlay.height*.88;
    drawMountain(overlay.width*.17,base,520,390,false);drawMountain(overlay.width*.39,base,640,480,true);drawMountain(overlay.width*.62,base,560,410,false);drawMountain(overlay.width*.82,base,610,455,true);
    ctx.fillStyle='rgba(29,101,96,.42)';ctx.beginPath();ctx.moveTo(0,overlay.height*.78);for(let x=0;x<=overlay.width;x+=35){const y=overlay.height*.78-Math.abs(Math.sin(x*.035))*28;ctx.lineTo(x,y);}ctx.lineTo(overlay.width,overlay.height);ctx.lineTo(0,overlay.height);ctx.closePath();ctx.fill();
  }

  function drawRockColumn(sx,sy,width,bottom,seed){
    const body=ctx.createLinearGradient(sx,sy,sx,bottom);body.addColorStop(0,'#755234');body.addColorStop(.45,'#4e3a2b');body.addColorStop(1,'#2d2926');
    ctx.fillStyle=body;ctx.fillRect(sx,sy,width,Math.max(0,bottom-sy));
    ctx.globalAlpha=.45;ctx.fillStyle='#b28a55';
    for(let i=0;i<4;i+=1){const px=sx+((seed*37+i*53)%97)/97*width,py=sy+18+i*42;ctx.beginPath();ctx.arc(px,py,3+(i%2)*3,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
  }

  function drawTerrain(activeRoom,view){
    const step=5;
    for(let sx=0;sx<overlay.width;sx+=step){
      const wx=view.x+(sx/overlay.width)*view.width,wy=terrainY(activeRoom,wx);if(wy>=WORLD_HEIGHT-1)continue;
      const sy=worldToScreen(wx,wy,view).y;drawRockColumn(sx,sy,step+1,overlay.height,Math.floor(wx/25));
    }
    ctx.strokeStyle='#375f24';ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();let drawing=false;
    for(let sx=0;sx<=overlay.width;sx+=4){const wx=view.x+(sx/overlay.width)*view.width,wy=terrainY(activeRoom,wx);if(wy>=WORLD_HEIGHT-1){drawing=false;continue;}const sy=worldToScreen(wx,wy,view).y;if(!drawing){ctx.moveTo(sx,sy);drawing=true;}else ctx.lineTo(sx,sy);}ctx.stroke();
    ctx.strokeStyle='#83bb38';ctx.lineWidth=5;ctx.stroke();
  }

  function drawPine(screenX,screenY,scale=1){
    ctx.save();ctx.translate(screenX,screenY);ctx.scale(scale,scale);ctx.fillStyle='#70472b';ctx.fillRect(-3,-28,6,28);ctx.fillStyle='#1f6337';
    for(const [y,w] of [[-62,18],[-48,25],[-33,32]]){ctx.beginPath();ctx.moveTo(0,y-22);ctx.lineTo(-w,y+13);ctx.lineTo(w,y+13);ctx.closePath();ctx.fill();}ctx.fillStyle='#77a838';ctx.globalAlpha=.62;ctx.beginPath();ctx.moveTo(0,-82);ctx.lineTo(-9,-54);ctx.lineTo(9,-54);ctx.closePath();ctx.fill();ctx.restore();
  }

  function drawDecor(activeRoom,view){
    const trees=[520,1470,2480,3470,4540,760,1730,3710,4310];
    for(const x of trees){const y=terrainY(activeRoom,x);if(y>=WORLD_HEIGHT-1)continue;const p=worldToScreen(x,y,view);if(p.x<-80||p.x>overlay.width+80||p.y<-100||p.y>overlay.height+80)continue;const scale=clamp(5000/view.width*.52,.34,1.25);drawPine(p.x,p.y-3,scale);}
  }

  function drawPickups(activeRoom,view){
    for(const box of activeRoom?.pickups??[]){const p=worldToScreen(box.x,box.y,view);if(p.x<-40||p.x>overlay.width+40||p.y<-40||p.y>overlay.height+40)continue;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(48,31,18,.96)';ctx.strokeStyle='#e4b45f';ctx.lineWidth=2;ctx.fillRect(-11,-11,22,22);ctx.strokeRect(-11,-11,22,22);ctx.fillStyle='#fff4c0';ctx.font='900 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(String(box.label??box.type??'?').slice(0,1).toUpperCase(),0,4);ctx.restore();}
  }

  function drawAim(activeRoom,view){
    if(activeRoom?.status!=='started'||activeRoom.match?.projectile)return;
    const player=activeRoom.players?.find(p=>p.id===activeRoom.match?.activePlayerId);if(!player?.spawn)return;
    const angle=(activeRoom.match?.aimAngle??45)*Math.PI/180,facing=player.spawn.facing||1,power=activeRoom.match?.aimPower??55;
    const start=worldToScreen(player.spawn.x,player.spawn.y-24,view);ctx.save();ctx.fillStyle='rgba(255,247,183,.86)';
    for(let i=1;i<=9;i++){const d=(30+i*20)*(power/60),x=start.x+Math.cos(angle)*d*facing,y=start.y-Math.sin(angle)*d+i*i*.75;ctx.globalAlpha=1-i*.075;ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();}ctx.restore();
  }

  function drawMapTitle(activeRoom){
    if(!['lobby','countdown'].includes(activeRoom?.status))return;
    ctx.save();ctx.fillStyle='rgba(14,38,46,.82)';ctx.beginPath();ctx.roundRect(24,24,330,70,12);ctx.fill();ctx.fillStyle='#ffffff';ctx.font='900 21px ui-monospace,monospace';ctx.fillText('HUANCAVELICA SIMULATOR',42,54);ctx.fillStyle='#bfe9ff';ctx.font='800 12px ui-monospace,monospace';ctx.fillText('PHASE 10 // ALPINE VOID ARENA',42,78);ctx.restore();
  }

  function loop(){
    ctx.clearRect(0,0,overlay.width,overlay.height);
    if(room?.arena&&isHuancavelica(room)){
      const view=base.getViewSnapshot?.();if(view){drawBackdrop();drawTerrain(room,view);drawDecor(room,view);drawPickups(room,view);drawAim(room,view);drawMapTitle(room);}
    }
    frameId=requestAnimationFrame(loop);
  }
  frameId=requestAnimationFrame(loop);

  return Object.freeze({
    drawScaffold(){room=null;ctx.clearRect(0,0,overlay.width,overlay.height);base.drawScaffold();},
    drawArena(nextRoom,nextLocalPlayerId=null){room=nextRoom;base.drawArena(roomForLegacyRenderer(nextRoom),nextLocalPlayerId);},
    getViewSnapshot(){return base.getViewSnapshot?.()??null;},
    destroy(){if(frameId)cancelAnimationFrame(frameId);frameId=null;overlay.remove();base.destroy?.();}
  });
}

export const phase10HuancavelicaVisualTestHooks=Object.freeze({isHuancavelica,roomForLegacyRenderer,insideHole,baseTerrainY,terrainY});
