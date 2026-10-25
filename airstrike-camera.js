// Frame the whole sky-to-impact corridor, not the firing player's close-up.
export function airStrikeCameraView(arena,shot){
 const width=arena.worldWidth,height=arena.worldHeight;
 const shells=shot.cameraAirStrikeShells??shot.airStrikeShells??[];
 const finite=values=>values.filter(Number.isFinite);
 const xs=finite([shot.targetX,shot.impactX,...shells.flatMap(s=>[s.startX,s.x,s.impactX])]);
 const ys=finite([shot.impactY,...shells.flatMap(s=>[s.y,s.impactY])]);
 const left=Math.max(0,Math.min(...(xs.length?xs:[width/2]))-180);
 const right=Math.min(width,Math.max(...(xs.length?xs:[width/2]))+180);
 const bottom=Math.min(height,Math.max(...(ys.length?ys:[height]))+180);
 const units=Math.min(5,Math.max(1.45,(right-left)/width*5,bottom/height*5));
 const viewWidth=width*units/5,viewHeight=height*units/5;
 const centerX=Math.max(viewWidth/2,Math.min(width-viewWidth/2,(left+right)/2));
 return {centerX,centerY:viewHeight/2,units};
}
