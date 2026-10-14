// The approved mask PNG supplies collision bits; terrain/decor remain untouched.
let maskPromise;
export function loadBrowserTerrainMask(){
 return maskPromise??=(async()=>{
  const image=new Image();image.src=new URL('../assets/huancavelica-v2/mask.png',import.meta.url).href;await image.decode();
  if(image.naturalWidth!==1448||image.naturalHeight!==1086)throw new Error('Invalid terrain mask dimensions');
  const canvas=document.createElement('canvas');canvas.width=1448;canvas.height=1086;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,1448,1086).data,bits=new Uint8Array(Math.ceil(1448*1086/8));
  for(let i=0;i<1448*1086;i++)if(rgba[i*4+3]>=128)bits[i>>3]|=1<<(i&7);
  return bits;
 })().catch(error=>{maskPromise=null;throw error;});
}
