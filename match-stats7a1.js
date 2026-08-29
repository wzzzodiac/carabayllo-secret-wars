export function createMatchStatsPanel({ onRematch } = {}) {
  const anchor=document.querySelector('.battle-layout');
  const root=document.createElement('section');
  root.className='panel';
  root.hidden=true;
  root.style.marginTop='16px';
  anchor?.insertAdjacentElement('afterend',root);

  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  function resultText(room){const r=room?.matchSummary?.result??room?.match?.result;if(!r)return'MATCH COMPLETE';if(r.draw)return'DRAW';if(r.type==='team')return`TEAM ${esc(r.winnerTeam)} WINS`;return`${esc(r.winnerName??'PLAYER')} WINS`;}
  function table(stats){return `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font:700 12px ui-monospace,monospace"><thead><tr style="text-align:left;opacity:.7"><th>PLAYER</th><th>DMG</th><th>K</th><th>A</th><th>TAKEN</th><th>PICKUPS</th><th>USES</th><th>BIGGEST</th></tr></thead><tbody>${stats.map((s,i)=>`<tr style="border-top:1px solid rgba(140,180,255,.14)"><td style="padding:8px 8px 8px 0">${i+1}. ${esc(s.name)}</td><td>${number(s.damageDealt)}</td><td>${number(s.kills)}</td><td>${number(s.assists)}</td><td>${number(s.damageReceived)}</td><td>${number(s.pickups)}</td><td>${number(s.shotsFired)}</td><td>${number(s.biggestHit)}</td></tr>`).join('')}</tbody></table></div>`;}
  function feed(events){const recent=[...(events??[])].slice(-7).reverse();return `<div style="margin-top:12px"><div class="section-label">MATCH FEED</div>${recent.length?recent.map(e=>`<div style="padding:5px 0;border-top:1px solid rgba(140,180,255,.1);font:700 11px ui-monospace,monospace;opacity:.86">T${number(e.turn)} // ${esc(e.text)}</div>`).join(''):'<div style="opacity:.6;padding-top:6px">No combat events yet.</div>'}</div>`;}
  function update(room,playerId){
    const show=['started','finished'].includes(room?.status)&&Array.isArray(room?.matchStats);root.hidden=!show;if(!show)return;
    const stats=[...room.matchStats].sort((a,b)=>number(b.damageDealt)-number(a.damageDealt)||number(b.kills)-number(a.kills));
    const me=room.players?.find(p=>p.id===playerId),summary=room.matchSummary;
    const details=summary?`${number(summary.turns)} turns // ${(number(summary.durationMs)/60000).toFixed(1)} min // top damage ${esc(summary.topDamage?.name??'—')} ${number(summary.topDamage?.value)} // most used ${esc(summary.mostUsedWeapon?.type??'—').toUpperCase()} ${number(summary.mostUsedWeapon?.uses)}`:'';
    const top=`<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap"><div><div class="section-label">VERSION 0.9 BETA // MATCH STATS</div><strong>${room.status==='finished'?resultText(room):'LIVE SCOREBOARD'}</strong>${summary?`<div style="margin-top:5px;opacity:.7;font:700 11px ui-monospace,monospace">${details}</div>`:''}</div>${room.status==='finished'&&me?.isHost?'<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-rematch="same">REMATCH // SAME MAP</button><button type="button" data-rematch="random">REMATCH // RANDOM MAP</button></div>':''}</div>`;
    root.innerHTML=top+table(stats)+feed(room.eventFeed);
  }
  root.addEventListener('click',async event=>{const button=event.target.closest?.('[data-rematch]');if(!button)return;button.disabled=true;try{await onRematch?.(button.dataset.rematch==='random');}finally{if(button.isConnected)button.disabled=false;}});
  return Object.freeze({update,destroy(){root.remove();}});
}
