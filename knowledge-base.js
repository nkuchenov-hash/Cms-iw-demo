const kq=(s,r=document)=>r.querySelector(s),kqa=(s,r=document)=>[...r.querySelectorAll(s)];
const ke=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let KB=null,kbTab='sources',kbGroup='all',kbTopic='all',kbSearch='';
const kbRoute=()=>location.hash.replace('#/','')||'dashboard';
const kbKinds={fact:'Fact',guide:'Guide',docs_section:'Docs section',comparison:'Comparison',community:'Community',idea:'Idea',watch:'Watch'};
const kbFormats={post:'Post',image_post:'Image post',short:'Short',reel:'Reel',long_video:'Long video'};

async function kbApi(path,options={}){
  const r=await fetch(path,{headers:{'content-type':'application/json',...(options.headers||{})},...options,body:options.body&&typeof options.body!=='string'?JSON.stringify(options.body):options.body,cache:'no-store'});
  let data=null;try{data=await r.json()}catch{}
  if(!r.ok)throw new Error(data?.error||`Request failed: ${r.status}`);
  return data;
}
async function kbLoad(){KB=await kbApi('/api/knowledge-base')}
function kbSource(id){return KB?.sources?.find(x=>x.id===id)}
function kbTopicById(id){return KB?.topics?.find(x=>x.id===id)}
function kbChildren(id){return (KB?.topics||[]).filter(t=>t.parentTopicId===id)}
function kbDescendants(id){const out=[id];for(const child of kbChildren(id))out.push(...kbDescendants(child.id));return out}
function kbTopicIdsForFilter(){return kbTopic==='all'?null:new Set(kbDescendants(kbTopic))}
function kbItemMatches(item){
  const source=kbSource(item.sourceId),topicSet=kbTopicIdsForFilter(),q=kbSearch.trim().toLowerCase();
  if(kbGroup!=='all'&&(source?.sourceGroup||'manual')!==kbGroup)return false;
  if(topicSet&&!item.topicIds?.some(id=>topicSet.has(id)))return false;
  if(q&&!`${item.title} ${item.summary} ${item.sourceSection||''} ${(item.tags||[]).join(' ')}`.toLowerCase().includes(q))return false;
  return item.status!=='archived';
}
function kbItems(){return (KB?.knowledgeItems||[]).filter(kbItemMatches)}
function kbItemCountForTopic(id){const ids=new Set(kbDescendants(id));return (KB?.knowledgeItems||[]).filter(item=>item.status!=='archived'&&item.topicIds?.some(t=>ids.has(t))).length}
function kbContentCountForTopic(id,status=null){const ids=new Set(kbDescendants(id));return (KB?.content||[]).filter(c=>ids.has(c.topicId)&&(!status||c.status===status)).length}
function kbSourceItemCount(sourceId){return (KB?.knowledgeItems||[]).filter(x=>x.sourceId===sourceId&&x.status!=='archived').length}
function kbSourceGroupItems(groupId){const ids=new Set((KB?.sources||[]).filter(s=>(s.sourceGroup||'manual')===groupId).map(s=>s.id));return (KB?.knowledgeItems||[]).filter(i=>ids.has(i.sourceId)&&i.status!=='archived').length}
function kbTopicOptions(selected=''){return (KB?.topics||[]).map(t=>`<option value="${ke(t.id)}" ${t.id===selected?'selected':''}>${ke(t.name)}</option>`).join('')}
function kbUsedItemIds(){const ids=new Set();for(const c of KB?.content||[])for(const id of c.metadata?.knowledgeItemIds||[])ids.add(id);return ids}

function kbSourceBlocks(){
  return (KB?.sourceGroups||[]).map(group=>{
    const sources=(KB.sources||[]).filter(s=>(s.sourceGroup||'manual')===group.id&&s.enabled!==false);
    const count=kbSourceGroupItems(group.id);
    return `<article class="kb-source-block"><div class="kb-source-block-head"><div><span class="source-class">${ke(group.id)}</span><h2>${ke(group.name)}</h2></div><span class="pill">${sources.length} sources · ${count} items</span></div><p>${ke(group.description)}</p><div class="kb-source-list">${sources.length?sources.map(source=>`<div class="kb-source-entry"><div><b>${ke(source.name)}</b><small>${ke(source.kind||'source')} · ${kbSourceItemCount(source.id)} knowledge items</small></div>${source.url?`<a href="${ke(source.url)}" target="_blank" rel="noopener">Open ↗</a>`:'<span class="meta-chip">manual</span>'}</div>`).join(''):'<div class="kb-source-entry"><span>No source connected yet.</span></div>'}</div></article>`;
  }).join('');
}

function kbInfoTreeNode(topic){
  const children=kbChildren(topic.id),knowledge=kbItemCountForTopic(topic.id);
  return `<div class="kb-topic"><div class="kb-topic-row ${kbTopic===topic.id?'active':''}" data-kb-topic="${ke(topic.id)}"><div class="kb-topic-copy"><b>${ke(topic.name)}</b><span>${knowledge} knowledge items</span></div><span class="pill">${knowledge}</span></div>${children.length?`<div class="kb-topic-children">${children.map(kbInfoTreeNode).join('')}</div>`:''}</div>`;
}
function kbTopicTree(){
  return (KB?.topicGroups||[]).map(group=>{
    const roots=(KB.topics||[]).filter(t=>t.groupId===group.id&&!t.parentTopicId);
    if(!roots.length)return '';
    return `<section class="kb-tree-group"><div class="kb-tree-group-title"><b>${ke(group.name)}</b></div>${roots.map(kbInfoTreeNode).join('')}</section>`;
  }).join('');
}

function kbPostingTreeNode(topic){
  const children=kbChildren(topic.id),published=kbContentCountForTopic(topic.id,'published'),total=kbContentCountForTopic(topic.id),planned=Math.max(0,total-published);
  return `<div class="kb-topic kb-posting-topic"><div class="kb-posting-row"><div class="kb-topic-copy"><b>${ke(topic.name)}</b><span>${published} published · ${planned} planned / in progress</span></div><div class="kb-topic-actions"><span class="pill">${published}/${total}</span><button class="secondary-btn" data-kb-content-topic="${ke(topic.id)}">Create content</button></div></div>${children.length?`<div class="kb-topic-children">${children.map(kbPostingTreeNode).join('')}</div>`:''}</div>`;
}
function kbPostingTree(){
  return (KB?.topicGroups||[]).map(group=>{
    const roots=(KB.topics||[]).filter(t=>t.groupId===group.id&&!t.parentTopicId);
    if(!roots.length)return '';
    return `<section class="kb-tree-group"><div class="kb-tree-group-title"><b>${ke(group.name)}</b><span>${roots.reduce((n,t)=>n+kbContentCountForTopic(t.id),0)} content records</span></div>${roots.map(kbPostingTreeNode).join('')}</section>`;
  }).join('');
}

function kbKnowledgeRows(){
  const used=kbUsedItemIds(),items=kbItems();
  if(!items.length)return '<div class="kb-empty">No knowledge matches the current filters.</div>';
  return items.map(item=>{
    const source=kbSource(item.sourceId),topics=(item.topicIds||[]).map(kbTopicById).filter(Boolean);
    return `<article class="kb-knowledge-row"><div class="kb-knowledge-copy"><div class="kb-knowledge-meta"><span class="source-class">${ke(source?.sourceGroup||item.sourceClass||'manual')}</span><span class="pill">${ke(kbKinds[item.kind]||item.kind)}</span>${used.has(item.id)?'<span class="pill accent">used in content</span>':''}</div><h3>${ke(item.title)}</h3><p>${ke(item.summary)}</p><div class="kb-knowledge-source"><b>${ke(source?.name||'Manual')}</b>${item.sourceSection?` · ${ke(item.sourceSection)}`:''}${item.sourceUrl?` · <a href="${ke(item.sourceUrl)}" target="_blank" rel="noopener">source ↗</a>`:''}</div><div class="kb-knowledge-meta">${topics.map(t=>`<span class="channel-chip">${ke(t.name)}</span>`).join('')}</div></div><div class="kb-row-actions"><button class="primary-btn" data-kb-content-item="${ke(item.id)}">Create content</button></div></article>`;
  }).join('');
}

function kbDialogs(){
  return `<dialog id="kbSourceDialog" class="kb-dialog"><form class="kb-dialog-form" data-kb-source-form><div class="kb-dialog-head"><h2>Add source</h2><button type="button" class="icon-action" data-kb-close="kbSourceDialog" aria-label="Close">×</button></div><div class="kb-form-grid"><label class="kb-field"><span>Block</span><select name="sourceGroup">${KB.sourceGroups.map(g=>`<option value="${ke(g.id)}">${ke(g.name)}</option>`).join('')}</select></label><label class="kb-field"><span>Source class</span><select name="sourceClass"><option value="internal">Internal parsing</option><option value="manual">Manual</option><option value="external">External parsing</option></select></label><label class="kb-field wide"><span>Name</span><input name="name" required></label><label class="kb-field wide"><span>URL</span><input name="url" type="url" placeholder="https://…"></label><label class="kb-field wide"><span>Description</span><textarea name="description"></textarea></label></div><div class="kb-dialog-actions"><button type="button" class="secondary-btn" data-kb-close="kbSourceDialog">Cancel</button><button class="primary-btn" type="submit">Add source</button></div></form></dialog>
  <dialog id="kbItemDialog" class="kb-dialog"><form class="kb-dialog-form" data-kb-item-form><div class="kb-dialog-head"><h2>Add knowledge</h2><button type="button" class="icon-action" data-kb-close="kbItemDialog" aria-label="Close">×</button></div><div class="kb-form-grid"><label class="kb-field"><span>Source</span><select name="sourceId">${KB.sources.map(s=>`<option value="${ke(s.id)}" ${s.id==='src-kb-manual'?'selected':''}>${ke(s.name)}</option>`).join('')}</select></label><label class="kb-field"><span>Type</span><select name="kind"><option value="idea">Idea</option><option value="fact">Fact</option><option value="guide">Guide</option><option value="community">Community signal</option><option value="comparison">Comparison</option><option value="watch">Watch</option></select></label><label class="kb-field wide"><span>Title</span><input name="title" required></label><label class="kb-field wide"><span>Summary / raw note</span><textarea name="summary" required></textarea></label><label class="kb-field"><span>Topic</span><select name="topicId"><option value="">Unassigned</option>${kbTopicOptions()}</select></label><label class="kb-field"><span>Source URL override</span><input name="sourceUrl" type="url" placeholder="Optional"></label></div><div class="kb-dialog-actions"><button type="button" class="secondary-btn" data-kb-close="kbItemDialog">Cancel</button><button class="primary-btn" type="submit">Save knowledge</button></div></form></dialog>
  <dialog id="kbContentDialog" class="kb-dialog"><form class="kb-dialog-form" data-kb-content-form><div class="kb-dialog-head"><h2>Create content idea</h2><button type="button" class="icon-action" data-kb-close="kbContentDialog" aria-label="Close">×</button></div><div class="kb-lineage" data-kb-lineage>Content will keep a traceable link to the selected topic and knowledge source.</div><input type="hidden" name="knowledgeItemId"><label class="kb-field"><span>Format</span><select name="type">${Object.entries(kbFormats).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label class="kb-field"><span>Topic</span><select name="topicId">${kbTopicOptions()}</select></label><label class="kb-field"><span>Title</span><input name="title" required></label><label class="kb-field"><span>Starting note</span><textarea name="body"></textarea></label><div class="kb-dialog-actions"><button type="button" class="secondary-btn" data-kb-close="kbContentDialog">Cancel</button><button class="primary-btn" type="submit">Create idea</button></div></form></dialog>`;
}

function kbTabBody(){
  if(kbTab==='sources')return `<section class="kb-tab-panel"><div class="kb-section-head"><div><h2>Information sources</h2><p>The source database: product site, docs, Telegram, YouTube, team input, competitors and market watchlists.</p></div><button class="primary-btn" data-kb-add-source>Add source</button></div><div class="kb-source-grid">${kbSourceBlocks()}</div></section>`;
  if(kbTab==='structure')return `<section class="kb-tab-panel"><div class="kb-section-head"><div><h2>Information structure</h2><p>The resulting knowledge tree and the facts, guides, comparisons and ideas attached to it.</p></div><button class="primary-btn" data-kb-add-item>Add knowledge / idea</button></div><div class="kb-filterbar"><input data-kb-search value="${ke(kbSearch)}" placeholder="Search knowledge"><select data-kb-group-filter><option value="all">All source blocks</option>${KB.sourceGroups.map(g=>`<option value="${ke(g.id)}" ${kbGroup===g.id?'selected':''}>${ke(g.name)}</option>`).join('')}</select><select data-kb-topic-filter><option value="all">All topics</option>${kbTopicOptions(kbTopic==='all'?'':kbTopic)}</select></div><div class="kb-workspace"><section class="kb-panel"><div class="kb-panel-head"><div><h2>Topic tree</h2><p>Structured result of collected knowledge.</p></div><span class="pill">${KB.topics.length} topics</span></div><div class="kb-tree">${kbTopicTree()}</div></section><section class="kb-panel"><div class="kb-panel-head"><div><h2>Knowledge records</h2><p>${kbItems().length} items match the current filters.</p></div></div><div class="kb-items">${kbKnowledgeRows()}</div></section></div></section>`;
  return `<section class="kb-tab-panel"><div class="kb-section-head"><div><h2>Posting topics</h2><p>The editorial topic structure for future posts, shorts and videos, with current publication coverage.</p></div></div><div class="kb-panel"><div class="kb-panel-head"><div><h2>Editorial topic tree</h2><p>Choose a theme and create the next content record directly from it.</p></div><span class="pill accent">${KB.content.length} content records</span></div><div class="kb-tree kb-posting-tree">${kbPostingTree()}</div></div></section>`;
}

function kbRender(){
  if(!KB||kbRoute()!=='knowledge')return;const view=kq('#view');if(!view)return;
  const leaves=(KB.topics||[]).filter(t=>!kbChildren(t.id).length),covered=leaves.filter(t=>kbItemCountForTopic(t.id)>0).length;
  kq('#pageCrumb').textContent='Knowledge Base';
  view.innerHTML=`<div class="kb-page"><div class="kb-compact-head"><div><h1>Knowledge Base</h1><span>${KB.sources.filter(s=>s.enabled!==false).length} sources · ${KB.knowledgeItems.length} knowledge items · ${covered}/${leaves.length} leaf topics covered</span></div></div><nav class="kb-tabs" aria-label="Knowledge Base sections"><button data-kb-tab="sources" class="${kbTab==='sources'?'active':''}">Information sources</button><button data-kb-tab="structure" class="${kbTab==='structure'?'active':''}">Information structure</button><button data-kb-tab="posting" class="${kbTab==='posting'?'active':''}">Posting topics</button></nav>${kbTabBody()}${kbDialogs()}</div>`;
  view.dataset.routeOwner='knowledge-base';view.dataset.route='knowledge';kbBind();
}

function kbOpenContent({itemId='',topicId=''}){
  const d=kq('#kbContentDialog'),f=kq('[data-kb-content-form]'),item=itemId?KB.knowledgeItems.find(x=>x.id===itemId):null;
  f.reset();f.elements.knowledgeItemId.value=item?.id||'';f.elements.topicId.value=topicId||item?.topicIds?.[0]||KB.topics[0]?.id||'';f.elements.title.value=item?.kind==='idea'?item.title.replace(/^Content idea:\s*/i,''):item?.title||'';f.elements.body.value=item?.summary||'';
  kq('[data-kb-lineage]').textContent=item?`Lineage: ${kbSource(item.sourceId)?.name||'source'} → ${(item.topicIds||[]).map(id=>kbTopicById(id)?.name).filter(Boolean).join(' / ')||'topic'} → content record.`:'This content idea will be linked to the selected posting topic.';
  d.showModal();
}

function kbBind(){
  kqa('[data-kb-tab]').forEach(b=>b.onclick=()=>{kbTab=b.dataset.kbTab;kbTopic='all';kbRender()});
  kqa('[data-kb-topic]').forEach(el=>el.onclick=()=>{kbTopic=kbTopic===el.dataset.kbTopic?'all':el.dataset.kbTopic;kbRender()});
  kqa('[data-kb-content-topic]').forEach(b=>b.onclick=e=>{e.stopPropagation();kbOpenContent({topicId:b.dataset.kbContentTopic})});
  kqa('[data-kb-content-item]').forEach(b=>b.onclick=()=>kbOpenContent({itemId:b.dataset.kbContentItem}));
  kq('[data-kb-search]')?.addEventListener('input',e=>{kbSearch=e.target.value;clearTimeout(window.__kbSearchTimer);window.__kbSearchTimer=setTimeout(kbRender,120)});
  kq('[data-kb-group-filter]')?.addEventListener('change',e=>{kbGroup=e.target.value;kbRender()});
  kq('[data-kb-topic-filter]')?.addEventListener('change',e=>{kbTopic=e.target.value;kbRender()});
  kq('[data-kb-add-source]')?.addEventListener('click',()=>kq('#kbSourceDialog').showModal());
  kq('[data-kb-add-item]')?.addEventListener('click',()=>kq('#kbItemDialog').showModal());
  kqa('[data-kb-close]').forEach(b=>b.onclick=()=>kq(`#${b.dataset.kbClose}`)?.close());
  kq('[data-kb-source-form]')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,o=Object.fromEntries(new FormData(f));try{await kbApi('/api/knowledge-base/sources',{method:'POST',body:o});f.closest('dialog').close();await kbLoad();kbRender()}catch(err){window.CMSIW?.toast?.(err.message,'bad')||alert(err.message)}});
  kq('[data-kb-item-form]')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,o=Object.fromEntries(new FormData(f));o.topicIds=o.topicId?[o.topicId]:[];delete o.topicId;try{await kbApi('/api/knowledge-base/items',{method:'POST',body:o});f.closest('dialog').close();await kbLoad();kbRender()}catch(err){window.CMSIW?.toast?.(err.message,'bad')||alert(err.message)}});
  kq('[data-kb-content-form]')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,o=Object.fromEntries(new FormData(f)),item=o.knowledgeItemId?KB.knowledgeItems.find(x=>x.id===o.knowledgeItemId):null,source=item?kbSource(item.sourceId):null;try{await kbApi('/api/content',{method:'POST',body:{projectId:'iw17',topicId:o.topicId,type:o.type,title:o.title,body:o.body,status:'idea',targetChannelIds:[],metadata:{knowledgeItemIds:item?[item.id]:[],sourceIds:source?[source.id]:[],knowledgeBase:true}}});f.closest('dialog').close();location.hash='#/content'}catch(err){window.CMSIW?.toast?.(err.message,'bad')||alert(err.message)}});
}

async function kbApply(){if(kbRoute()!=='knowledge')return;try{await kbLoad();if(kbRoute()==='knowledge')kbRender()}catch(err){const view=kq('#view');if(view)view.innerHTML=`<div class="kb-empty">Knowledge Base failed to load: ${ke(err.message)}</div>`}}
window.addEventListener('hashchange',()=>setTimeout(kbApply,70));
window.addEventListener('cmsiw:state-changed',kbApply);
setTimeout(kbApply,90);
