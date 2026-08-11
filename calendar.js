const c6=(s,r=document)=>r.querySelector(s),c6a=(s,r=document)=>[...r.querySelectorAll(s)];
const c6esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const c6Providers={youtube:['▶','YouTube'],linkedin:['in','LinkedIn'],telegram:['➤','Telegram'],facebook:['f','Facebook'],instagram:['◎','Instagram'],tiktok:['♪','TikTok'],vk:['VK','VK'],x:['X','X']};
const c6ProviderOrder=['youtube','linkedin','tiktok','instagram','facebook','telegram','vk','x'];
const c6Formats={post:'Post',image_post:'Image post',short:'Short',reel:'Reel',long_video:'Long video'};
const c6Weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
let C6=null,c6View='month',c6Cursor=new Date(),c6ProviderSet=new Set();
const c6Route=()=>location.hash.replace('#/','')||'dashboard';

async function c6Load(){try{const r=await fetch('/api/state',{cache:'no-store'});if(r.ok)C6=await r.json()}catch{}}
function c6Channel(id){return C6?.channels?.find(x=>x.id===id)}
function c6Provider(id){return c6Channel(id)?.provider||'unknown'}
function c6Badge(p){const d=c6Providers[p]||[p.slice(0,2).toUpperCase(),p];return `<span class="provider-badge ${c6esc(p)}">${c6esc(d[0])} ${c6esc(d[1])}</span>`}
function c6ProviderLabel(p){const d=c6Providers[p]||[p.slice(0,2).toUpperCase(),p];return `<span class="calendar-v6-provider-mark">${c6esc(d[0])}</span><span>${c6esc(d[1])}</span>`}
function c6Time(v){return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(v))}
function c6DateKey(v){const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function c6Monday(v){const d=new Date(v),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);d.setHours(0,0,0,0);return d}
function c6DayLabel(v){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(v)}
function c6PeriodLabel(){if(c6View==='month')return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(c6Cursor);if(c6View==='week'){const s=c6Monday(c6Cursor),e=new Date(s);e.setDate(s.getDate()+6);return `${c6DayLabel(s)} – ${c6DayLabel(e)}`;}return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(c6Cursor)}
function c6Entries(){
  const rows=[];
  for(const item of C6?.content||[]){
    const when=item.publishedAt||item.scheduledAt;
    if(!when)continue;
    const ids=item.targetChannelIds?.length?item.targetChannelIds:[null];
    for(const id of ids){
      const provider=id?c6Provider(id):'unknown';
      const status=item.publishedAt||item.status==='published'?'published':item.status;
      rows.push({item,channelId:id,provider,status,when:new Date(when)});
    }
  }
  return rows.filter(x=>!c6ProviderSet.size||c6ProviderSet.has(x.provider)).sort((a,b)=>a.when-b.when);
}
function c6Card(x){return `<article class="calendar-v6-card ${c6esc(x.provider)} ${c6esc(x.status)}"><div class="calendar-v6-card-top">${c6Badge(x.provider)}<span class="status-badge ${c6esc(x.status)}">${c6esc(x.status)}</span></div><div class="calendar-v6-card-title">${c6esc(x.item.title)}</div><div class="calendar-v6-card-meta"><span class="calendar-v6-card-time">${c6esc(c6Time(x.when))}</span><span class="format-tag">${c6esc(c6Formats[x.item.type]||x.item.type)}</span></div></article>`}
function c6ProviderFilters(){
  const configured=new Set((C6?.channels||[]).map(x=>x.provider));
  const available=c6ProviderOrder.filter(p=>configured.has(p)||p==='vk'||p==='x');
  const allActive=!c6ProviderSet.size;
  return `<div class="calendar-v6-provider-filter" aria-label="Content channels"><button class="all ${allActive?'active':''}" data-c6-provider="all">All channels</button>${available.map(p=>`<button class="${c6ProviderSet.has(p)?'active':''}" data-c6-provider="${c6esc(p)}">${c6ProviderLabel(p)}</button>`).join('')}</div>`;
}
function c6Month(entries){
  const first=new Date(c6Cursor.getFullYear(),c6Cursor.getMonth(),1),start=c6Monday(first),days=[];
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d)}
  const today=c6DateKey(new Date());
  return `<div class="calendar-v6-frame"><div class="calendar-v6-weekdays">${c6Weekdays.map(x=>`<div class="calendar-v6-weekday">${x}</div>`).join('')}</div><div class="calendar-v6-month">${days.map(day=>{const dayRows=entries.filter(x=>c6DateKey(x.when)===c6DateKey(day));const cls=[day.getMonth()!==c6Cursor.getMonth()?'other-month':'',c6DateKey(day)===today?'today':''].filter(Boolean).join(' ');return `<section class="calendar-v6-day ${cls}"><div class="calendar-v6-day-head"><span class="calendar-v6-day-number">${day.getDate()}</span>${dayRows.length>1?`<span class="calendar-v6-day-count">${dayRows.length}</span>`:''}</div><div class="calendar-v6-stack">${dayRows.map(c6Card).join('')}</div></section>`}).join('')}</div></div>`;
}
function c6Week(entries){
  const start=c6Monday(c6Cursor),days=[];for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d)}
  return `<div class="calendar-v6-week">${days.map((day,i)=>{const rows=entries.filter(x=>c6DateKey(x.when)===c6DateKey(day));return `<section class="calendar-v6-week-column"><div class="calendar-v6-week-head"><b>${c6Weekdays[i]}</b><span>${c6DayLabel(day)}</span></div><div class="calendar-v6-week-stack">${rows.length?rows.map(c6Card).join(''):'<div class="calendar-v6-empty">No posts</div>'}</div></section>`}).join('')}</div>`;
}
function c6Day(entries){
  const rows=entries.filter(x=>c6DateKey(x.when)===c6DateKey(c6Cursor));
  return `<div class="calendar-v6-dayview">${rows.length?rows.map(x=>`<div class="calendar-v6-dayview-row"><div class="calendar-v6-dayview-time">${c6esc(c6Time(x.when))}</div>${c6Card(x)}</div>`).join(''):'<div class="calendar-v6-empty">No published or scheduled posts for this day.</div>'}</div>`;
}
function c6Move(dir){if(c6View==='month')c6Cursor=new Date(c6Cursor.getFullYear(),c6Cursor.getMonth()+dir,1);else if(c6View==='week'){const d=new Date(c6Cursor);d.setDate(d.getDate()+7*dir);c6Cursor=d}else{const d=new Date(c6Cursor);d.setDate(d.getDate()+dir);c6Cursor=d}c6Render()}
function c6Render(){
  if(!C6||c6Route()!=='calendar')return;
  const view=c6('#view');if(!view)return;
  const entries=c6Entries();
  view.innerHTML=`<div class="calendar-v6-commandbar"><div class="calendar-v6-command-left">${c6ProviderFilters()}</div><div class="calendar-v6-command-right"><div class="calendar-v6-nav"><button data-c6-move="-1" aria-label="Previous period">‹</button><span class="calendar-v6-period">${c6esc(c6PeriodLabel())}</span><button data-c6-move="1" aria-label="Next period">›</button><button data-c6-today>Today</button></div><div class="calendar-v6-view">${['month','week','day'].map(v=>`<button data-c6-view="${v}" class="${c6View===v?'active':''}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></div></div>${c6View==='month'?c6Month(entries):c6View==='week'?c6Week(entries):c6Day(entries)}`;
  view.dataset.routeOwner='calendar';view.dataset.route='calendar';
  c6Bind();
}
function c6Bind(){
  c6a('[data-c6-view]').forEach(b=>b.onclick=()=>{c6View=b.dataset.c6View;c6Render()});
  c6a('[data-c6-move]').forEach(b=>b.onclick=()=>c6Move(Number(b.dataset.c6Move)));
  c6('[data-c6-today]')?.addEventListener('click',()=>{c6Cursor=new Date();c6Render()});
  c6a('[data-c6-provider]').forEach(b=>b.onclick=()=>{const p=b.dataset.c6Provider;if(p==='all'){c6ProviderSet.clear()}else if(!c6ProviderSet.size){c6ProviderSet.add(p)}else if(c6ProviderSet.has(p)){c6ProviderSet.delete(p)}else{c6ProviderSet.add(p)}c6Render()});
}
async function c6Apply(){if(!C6)await c6Load();if(c6Route()==='calendar')c6Render()}
window.addEventListener('hashchange',()=>setTimeout(c6Apply,60));
const c6Observer=new MutationObserver(()=>queueMicrotask(()=>{if(c6Route()==='calendar'&&C6&&!c6('#view .calendar-v6-frame, #view .calendar-v6-week, #view .calendar-v6-dayview'))c6Render()}));
c6Observer.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(c6Apply,90);
