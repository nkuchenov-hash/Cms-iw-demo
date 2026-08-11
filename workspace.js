const wq = (selector, root = document) => root.querySelector(selector);
const wqa = (selector, root = document) => [...root.querySelectorAll(selector)];
const we = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const wn = (value) => Intl.NumberFormat('en-US', {
  notation: Number(value) > 99999 ? 'compact' : 'standard',
  maximumFractionDigits: 1
}).format(Number(value || 0));
const wd = (value) => value
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : '—';

const routeDefs = [
  ['dashboard', '⌂', 'Dashboard'],
  ['content', '▤', 'Content Library'],
  ['analytics', '⌁', 'Analytics'],
  ['calendar', '□', 'Calendar'],
  ['publisher', '↑', 'Publisher'],
  ['knowledge', '◇', 'Knowledge Base']
];
const routeLabels = Object.fromEntries(routeDefs.map(([route, , label]) => [route, label]));
routeLabels.hero = 'Hero Setup';
routeLabels.settings = 'Settings';

const formats = {
  post: 'Post', image_post: 'Image post', short: 'Short', reel: 'Reel', long_video: 'Long video'
};
const providerNames = {
  youtube: 'YouTube', linkedin: 'LinkedIn', telegram: 'Telegram', facebook: 'Facebook',
  instagram: 'Instagram', tiktok: 'TikTok', vk: 'VK', x: 'X'
};
const providerMarks = {
  youtube: '▶', linkedin: 'in', telegram: '➤', facebook: 'f',
  instagram: '◎', tiktok: '♪', vk: 'VK', x: 'X'
};

const ownedRoutes = new Set(['dashboard', 'content', 'hero', 'settings']);
const defaultWidgets = ['library', 'queue', 'views', 'knowledge', 'coverage', 'sources'];
let widgets = new Set(JSON.parse(localStorage.getItem('cms-iw-widgets') || JSON.stringify(defaultWidgets)));
let W = null;
let renderToken = 0;
let filters = { period: 'all', channel: 'all', theme: 'all', format: 'all', status: 'all', q: '' };

const route = () => location.hash.replace('#/', '') || 'dashboard';
const go = (value) => window.CMSIW.navigate(value);
const topic = (id) => W?.topics?.find((entry) => entry.id === id);
const channel = (id) => W?.channels?.find((entry) => entry.id === id);
const provider = (id) => channel(id)?.provider || 'unknown';
const badge = (value) => `<span class="provider-badge ${we(value)}">${we(providerMarks[value] || value.slice(0, 2).toUpperCase())} ${we(providerNames[value] || value)}</span>`;
const head = (title, text, meta = '') => `<div class="page-head"><div><h1>${we(title)}</h1><p>${we(text)}</p></div>${meta ? `<div class="page-meta">${meta}</div>` : ''}</div>`;

function updateNavigation() {
  const current = route();
  const side = wq('#sideNav');
  const rail = wq('#railNav');
  const entries = routeDefs.map(([name, icon, label]) => ({ name, icon, label, active: name === current }));
  if (side) {
    side.innerHTML = entries.map((entry) => `<button class="side-link ${entry.active ? 'active' : ''}" data-workspace-route="${entry.name}"><span class="nav-icon">${entry.icon}</span><span>${entry.label}</span></button>`).join('');
  }
  if (rail) {
    rail.innerHTML = entries.map((entry) => `<button class="rail-btn ${entry.active ? 'active' : ''}" data-workspace-route="${entry.name}" title="${entry.label}" aria-label="${entry.label}">${entry.icon}</button>`).join('');
  }
  wqa('[data-workspace-route]').forEach((button) => { button.onclick = () => go(button.dataset.workspaceRoute); });
  wq('#heroSetupLink')?.classList.toggle('active', current === 'hero');
  if (wq('#pageCrumb')) wq('#pageCrumb').textContent = routeLabels[current] || 'Dashboard';
}

function bindPersistentShell() {
  const hero = wq('#heroSetupLink');
  if (hero && !hero.dataset.workspaceBound) {
    hero.dataset.workspaceBound = '1';
    hero.onclick = () => go('hero');
  }
  const profile = wq('#profileButton');
  if (profile && !profile.dataset.workspaceBound) {
    profile.dataset.workspaceBound = '1';
    profile.onclick = () => go('settings');
  }
}

function itemDate(item) {
  return item.publishedAt || item.scheduledAt || item.updatedAt || item.createdAt;
}

function periodOk(item) {
  if (filters.period === 'all') return true;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - Number(filters.period));
  const when = new Date(itemDate(item));
  return when >= start && when <= end;
}

function filteredContent() {
  const query = filters.q.trim().toLowerCase();
  return (W?.content || []).filter((item) => {
    const text = `${item.title} ${item.body || ''} ${topic(item.topicId)?.name || ''}`.toLowerCase();
    return periodOk(item)
      && (filters.channel === 'all' || item.targetChannelIds?.includes(filters.channel))
      && (filters.theme === 'all' || item.topicId === filters.theme)
      && (filters.format === 'all' || item.type === filters.format)
      && (filters.status === 'all' || item.status === filters.status)
      && (!query || text.includes(query));
  });
}

function snapshots() {
  return W?.dashboard?.analytics?.snapshots || [];
}

function output(item) {
  return snapshots().filter((snapshot) => snapshot.contentId === item.id).reduce((totals, snapshot) => {
    const raw = snapshot.raw || {};
    const normalized = snapshot.normalized || {};
    totals.views += Number(normalized.views || raw.views || 0);
    totals.reach += Number(raw.reach || normalized.impressions || raw.impressions || 0);
    totals.likes += Number(raw.likes || raw.reactions || 0);
    totals.comments += Number(raw.comments || 0);
    totals.shares += Number(raw.shares || raw.reposts || 0);
    totals.watch += Number(normalized.watchMinutes || raw.watchMinutes || 0);
    return totals;
  }, { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, watch: 0 });
}

function publicationCard(item) {
  const metrics = output(item);
  const media = (item.media || []).filter((entry) => entry.url);
  return `<article class="publication-card"><div class="publication-main"><section class="publication-input"><div class="publication-kicker"><span class="status-badge ${we(item.status)}">${we(item.status)}</span><span class="format-tag">${we(formats[item.type] || item.type)}</span>${(item.targetChannelIds || []).map((id) => badge(provider(id))).join('')}</div><h3 class="publication-title">${we(item.title)}</h3><p class="publication-copy">${we(item.body || 'No canonical copy yet.')}</p><div class="meta-row"><span class="meta-chip">Theme · ${we(topic(item.topicId)?.name || 'None')}</span><span class="meta-chip">Date · ${we(wd(itemDate(item)))}</span><span class="meta-chip">Revision · ${Number(item.revision || 1)}</span><span class="meta-chip">Media · ${media.length ? 'linked' : 'no link'}</span></div>${media.length ? `<div class="linked-assets">${media.map((entry) => `<a href="${we(entry.url)}" target="_blank" rel="noreferrer">Preview ${we(entry.kind || 'asset')} ↗</a>`).join('')}</div>` : ''}</section><section class="publication-output">${item.status === 'published' ? `<div class="publication-kicker"><span class="eyebrow">LINKED RESULTS</span><span class="meta-chip">analytics snapshots</span></div><div class="output-grid">${[['Views', metrics.views], ['Reach', metrics.reach], ['Likes', metrics.likes], ['Comments', metrics.comments], ['Shares', metrics.shares], ['Watch min', metrics.watch]].map(([label, value]) => `<div class="output-metric"><span>${label}</span><b>${wn(value)}</b></div>`).join('')}</div>` : '<div class="empty" style="padding:30px 4px">Publication results are linked here after publishing. Detailed analysis lives in Analytics.</div>'}</section></div></article>`;
}

function renderContent() {
  const items = filteredContent();
  return `${head('Content Library', 'Canonical content history, revisions, linked media and publication-result references.', `<span class="pill accent">${items.length} matching records</span>`)}
    <div class="v3-filterbar">
      <label class="wide"><span>Search</span><input id="fQ" value="${we(filters.q)}" placeholder="Title, text, theme…"></label>
      <label><span>Period</span><select id="fPeriod"><option value="all">Any period</option>${[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '1 year']].map(([value, label]) => `<option value="${value}" ${filters.period === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>Channel</span><select id="fChannel"><option value="all">All channels</option>${(W.channels || []).map((entry) => `<option value="${entry.id}" ${filters.channel === entry.id ? 'selected' : ''}>${we(entry.label)}</option>`).join('')}</select></label>
      <label><span>Theme</span><select id="fTheme"><option value="all">All themes</option>${(W.topics || []).map((entry) => `<option value="${entry.id}" ${filters.theme === entry.id ? 'selected' : ''}>${we(entry.name)}</option>`).join('')}</select></label>
      <label><span>Format</span><select id="fFormat"><option value="all">All formats</option>${Object.entries(formats).map(([value, label]) => `<option value="${value}" ${filters.format === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label><span>Status</span><select id="fStatus"><option value="all">All statuses</option>${['idea', 'draft', 'review', 'scheduled', 'published', 'failed'].map((value) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
    </div>
    <div class="publication-list">${items.map(publicationCard).join('') || '<div class="empty">Nothing matches these filters.</div>'}</div>`;
}

const widgetNames = {
  library: 'Content library', queue: 'Publisher queue', views: 'Views synced',
  knowledge: 'Knowledge sources', coverage: 'Theme coverage', sources: 'Source activity'
};

function renderDashboard() {
  const cards = [];
  if (widgets.has('library')) cards.push(['Content library', W.content.length, `${W.content.filter((item) => item.status === 'published').length} published`]);
  if (widgets.has('queue')) cards.push(['Publisher queue', W.content.filter((item) => ['review', 'scheduled'].includes(item.status)).length, `${W.content.filter((item) => item.status === 'review').length} need review`]);
  if (widgets.has('views')) cards.push(['Views synced', W.dashboard?.analytics?.views || 0, 'analytics snapshots']);
  if (widgets.has('knowledge')) cards.push(['Knowledge sources', (W.references || []).length + (W.sources || []).length, 'Hero Setup + Knowledge Base']);
  if (widgets.has('sources')) cards.push(['Source activity', (W.sources || []).filter((source) => source.enabled).length, 'collectors enabled']);

  const coverage = widgets.has('coverage') ? `<div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Publisher queue</h2><p>Canonical records that need action next.</p></div><button class="text-link" data-go="publisher">Open Publisher →</button></div>${W.content.filter((item) => ['review', 'scheduled'].includes(item.status)).slice(0, 8).map((item) => `<div class="queue-row"><div class="queue-copy"><b>${we(item.title)}</b><small>${we(item.status)} · ${we(wd(item.scheduledAt))}</small></div><span class="format-tag">${we(formats[item.type] || item.type)}</span></div>`).join('') || '<div class="empty">Nothing waiting.</div>'}</section><section class="panel dark"><div class="panel-head"><div><h2>Theme coverage</h2><p>Coverage is shared taxonomy metadata; detailed analysis lives in Analytics.</p></div><button class="text-link" data-go="analytics">Open Analytics →</button></div>${W.topics.slice(0, 5).map((entry) => { const total = Number(entry.publishedCount || 0) + Number(entry.plannedCount || 0); const percent = total ? Math.round(Number(entry.publishedCount || 0) / total * 100) : 0; return `<div class="topic-health-row"><div><b>${we(entry.name)}</b><small>${entry.publishedCount || 0} published · ${entry.plannedCount || 0} planned</small></div><div class="progress"><i style="width:${percent}%"></i></div></div>`; }).join('')}</section></div>` : '';

  return `${head('Dashboard', 'A configurable overview assembled from the shared CMS IW modules.', '<button class="secondary-btn" data-go="settings">Configure dashboard</button>')}<div class="dashboard-widget-grid">${cards.map(([label, value, sub]) => `<div class="dashboard-widget"><span>${label}</span><b>${wn(value)}</b><small>${sub}</small></div>`).join('')}</div>${coverage}`;
}

function renderHero() {
  return `${head('Hero Setup', 'Workspace intelligence that teaches CMS IW what IntraWeb 17 is, how it speaks and what creation modules may use.', `<span class="pill accent">${(W.references || []).length + (W.sources || []).length} intelligence inputs</span>`)}<div class="hero-grid"><section class="hero-card"><span class="eyebrow">BRAND CORE</span><h2>Project knowledge</h2><p>Official facts, positioning, terminology, audience, allowed claims and prohibited wording.</p><div class="hero-list"><div><b>${we(W.project?.name || 'IntraWeb 17')}</b><small>${we(W.project?.description || 'Pilot workspace')}</small></div><div><b>Style memory</b><small>${W.styleProfile ? 'Profile built' : 'Learn from existing content, links and transcripts'}</small></div></div></section><section class="hero-card"><span class="eyebrow">OWNED CONTENT</span><h2>What we already published</h2><p>Existing references feed workspace context without creating another content database.</p><div class="hero-list">${(W.references || []).map((entry) => `<div><b>${we(entry.title)}</b><small>${we(entry.kind)} · ${we(entry.tags?.join(', ') || 'reference')}</small></div>`).join('') || '<div><b>No references yet</b><small>Add source material through the workspace intelligence flow.</small></div>'}</div></section><section class="hero-card"><span class="eyebrow">WATCHLIST</span><h2>Sources to learn from</h2><p>Own sites, external channels, news, competitors and future collectors.</p><div class="hero-list">${(W.sources || []).slice(0, 12).map((entry) => `<div><b>${we(entry.name)}</b><small>${we(entry.kind)} · priority ${Number(entry.priority || 0)}</small></div>`).join('')}</div></section><section class="hero-card"><span class="eyebrow">CONTENT DNA</span><h2>Creation defaults</h2><p>Shared structures and instructions consumed by text, image, audio, short and long-video creation modules.</p><div class="hero-list"><div><b>Short-form</b><small>Hook → proof → practical result → CTA</small></div><div><b>Long-form</b><small>Problem → workflow → explanation → caveats</small></div></div></section><section class="hero-card full"><span class="eyebrow">KNOWLEDGE</span><h2>Structured source intelligence</h2><div class="hero-drop">Knowledge Base owns reusable facts, ideas and provenance. Hero Setup owns workspace identity and style context. Both feed the same creation pipeline.</div></section></div>`;
}

function renderSettings() {
  return `${head('Workspace settings', 'Connections, dashboard composition, modules and workspace administration.')}<div class="settings-grid-v3"><section class="settings-card-v3"><h3>Connections</h3><p>Publishing and analytics accounts belong to Workspace Settings.</p>${W.channels.map((entry) => `<div class="connection-mini"><div>${badge(entry.provider)}<b>${we(entry.label)}</b><small>${we(entry.account || 'No account')}</small></div><span class="status-badge ${entry.connection?.configured ? 'published' : 'draft'}">${entry.connection?.configured ? 'connected' : 'setup'}</span></div>`).join('')}</section><section class="settings-card-v3"><h3>Dashboard widgets</h3><p>Choose which module summaries appear on Dashboard.</p><div class="dashboard-config">${Object.entries(widgetNames).map(([id, label]) => `<button data-widget="${id}" class="${widgets.has(id) ? 'active' : ''}">${label}</button>`).join('')}</div></section><section class="settings-card-v3"><h3>Modules</h3><p>Creation and collection engines remain independently replaceable behind shared contracts.</p><div class="hero-list"><div><b>Text & post creation</b><small>enabled</small></div><div><b>Short / Reel creation</b><small>module boundary ready</small></div><div><b>Long video creation</b><small>module boundary ready</small></div><div><b>Knowledge collectors</b><small>shared Knowledge Base contract</small></div></div></section><section class="settings-card-v3"><h3>Workspace profile</h3><p>Taxonomy, users and publishing safeguards remain shared across all modules.</p><div class="hero-list"><div><b>${we(W.project?.name || 'IntraWeb 17')}</b><small>Pilot workspace</small></div><div><b>Safe publishing</b><small>Destinations remain disabled until explicitly configured.</small></div></div></section></div>`;
}

function bindOwnedView() {
  const view = wq('#view');
  wqa('[data-go]', view).forEach((button) => { button.onclick = () => go(button.dataset.go); });
  const selectMap = { fPeriod: 'period', fChannel: 'channel', fTheme: 'theme', fFormat: 'format', fStatus: 'status' };
  for (const [id, key] of Object.entries(selectMap)) {
    wq(`#${id}`, view)?.addEventListener('change', (event) => {
      filters[key] = event.target.value;
      renderOwnedRoute();
    });
  }
  wq('#fQ', view)?.addEventListener('input', (event) => {
    filters.q = event.target.value;
    clearTimeout(window.__cmsWorkspaceSearch);
    window.__cmsWorkspaceSearch = setTimeout(renderOwnedRoute, 140);
  });
  wqa('[data-widget]', view).forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.widget;
      widgets.has(id) ? widgets.delete(id) : widgets.add(id);
      localStorage.setItem('cms-iw-widgets', JSON.stringify([...widgets]));
      renderOwnedRoute();
    };
  });
}

async function renderOwnedRoute() {
  const current = route();
  if (!ownedRoutes.has(current)) return;
  const token = ++renderToken;
  try {
    W = await window.CMSIW.loadState({ force: true });
    if (token !== renderToken || route() !== current) return;
    const view = wq('#view');
    if (!view) return;
    if (current === 'content') view.innerHTML = renderContent();
    else if (current === 'hero') view.innerHTML = renderHero();
    else if (current === 'settings') view.innerHTML = renderSettings();
    else view.innerHTML = renderDashboard();
    view.dataset.routeOwner = 'workspace';
    view.dataset.route = current;
    bindOwnedView();
  } catch (error) {
    window.CMSIW.toast(error.message, 'bad');
  }
}

function applyRoute() {
  updateNavigation();
  bindPersistentShell();
  renderOwnedRoute();
}

window.addEventListener('hashchange', applyRoute);
window.addEventListener('cmsiw:state-changed', () => { if (ownedRoutes.has(route())) renderOwnedRoute(); });
applyRoute();
