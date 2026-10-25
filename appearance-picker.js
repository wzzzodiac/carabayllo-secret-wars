import {ANIMALS,CARTS,normalizeAppearance} from './appearance.js?v=english-release-20261025';
import {drawAppearancePreview} from './mini-avatar.js?v=somber-v1-20261025';
const STORAGE_KEY='carabayllo-appearance-v1';
export function readAppearance(){
 try{return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY)));}catch{return normalizeAppearance(null);}
}
export function mountAppearancePicker(root,{compact=false,onChange=()=>{},signal}={}){
 let value=readAppearance(),disabled=false;
 const shortVehicleLabels={tico:'Tico',pnp:'PNP',donofrio:"D'Onofrio",triciclo:'Frutero'};
 const options=list=>list.map(item=>'<option value="'+item.id+'">'+(compact&&list===CARTS?(shortVehicleLabels[item.id]??item.label):item.label)+'</option>').join('');
 root.classList.add('appearance-picker');if(compact)root.classList.add('is-compact');
 root.innerHTML=(compact?'':'<canvas width="256" height="192" role="img" aria-label="Your character"></canvas>')+
 '<div class="appearance-fields"><label>ANIMAL<select aria-label="Animal">'+options(ANIMALS)+'</select></label>'+
 '<label>VEHICLE<select aria-label="Cart">'+options(CARTS)+'</select></label></div>';
 const animal=root.querySelector('[aria-label="Animal"]'),cart=root.querySelector('[aria-label="Cart"]'),preview=root.querySelector('canvas');
 function setValue(next,{persist=true}={}){
  value=normalizeAppearance(next);animal.value=value.animal;cart.value=value.cart;
  if(preview)drawAppearancePreview(preview,value);
  if(persist)try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}
 }
 for(const control of [animal,cart])control.addEventListener('change',()=>{
  if(disabled)return;
  setValue({animal:animal.value,cart:cart.value});
  Promise.resolve(onChange({...value})).catch(error=>console.error('Appearance change failed:',error.message));
 },{signal});
 setValue(value,{persist:false});
 return Object.freeze({getValue:()=>({...value}),setValue,setDisabled(next){disabled=Boolean(next);animal.disabled=cart.disabled=disabled;}});
}
