const pubq = (selector, root = document) => root.querySelector(selector);
const pubqa = (selector, root = document) => [...root.querySelectorAll(selector)];
const pube = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const pubProviders = {
  youtube: ['▶', 'YouTube'], linkedin: ['in', 'LinkedIn'], telegram: ['➤', 'Telegram'],
  facebook: ['f', 'Facebook'], instagram: ['◎', 'Instagram'], tiktok: ['♪', 'TikTok'],
  vk: ['VK', 'VK'], x: ['X', 'X'], unknown: ['•', 'Unassigned']
};
const pubFormats = {
  post: 'Post', image_post: 'Image post', short: 'Short', reel: 'Reel', long_video: 'Long video'
};

let PUB = null;
let pubSelected = null;
let pubProvider = 'all';
let pubStatus = 'all';
let pubSearch = '';
let pubPreviewTab = 'preview';

const pubRoute = () => location.hash.replace('#/', '') || 'dashboard';
const pubChannel = (id) => PUB?.channels?.find((entry) => entry.id === id);
const pubTopic = (id) => PUB?.topics?.find((entry) => entry.id === id);
const pubProviderFor = (channelId) => pubChannel(channelId)?.provider || 'unknown';
const pubBadge = (provider) => {
  const meta = pubProviders[provider] || [provider.slice(0, 2).toUpperCase(), provider];
  return `<span class="provider-badge ${pube(provider)}">${pube(meta[0])} ${pube(meta[1])}</span>`;
};
const pubWhen = (job) => job.publishedAt || job.scheduledAt || null;
const pubDate = (value) => value
  ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value))
  : 'Unscheduled';
const pubTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  : '—';
const pubDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const z = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
};
const pubTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const z = (number) => String(number).padStart(2, '0');
  return `${z(date.getHours())}:${z(date.getMinutes())}`;
};

function pubDestinationVariant(item, channelId) {
  return item.metadata?.destinationVariants?.[channelId] || {};
}

function pubJobs() {
  const rows = [];
  for (const item of PUB?.content || []) {
    const channelIds = item.targetChannelIds?.length ? item.targetChannelIds : [null];
    for (const channelId of channelIds) {
      const variant = channelId ? pubDestinationVariant(item, channelId) : {};
      const channel = channelId ? pubChannel(channelId) : null;
      rows.push({
        id: `${item.id}::${channelId || 'unassigned'}`,
        contentId: item.id,
        channelId,
        provider: channelId ? pubProviderFor(channelId) : 'unknown',
        status: item.status,
        type: item.type,
        theme: pubTopic(item.topicId)?.name || 'No theme',
        title: variant.title || item.title,
        copy: variant.body ?? item.body ?? '',
        scheduledAt: item.scheduledAt,
        publishedAt: item.publishedAt,
        revision: Number(item.revision || 1),
        account: channel?.account || channel?.label || 'No destination assigned',
        source: 'Canonical Content Library record',
        asset: (item.media || []).length ? `${item.media.length} linked asset${item.media.length === 1 ? '' : 's'}` : 'No linked asset',
        aspect: item.type === 'short' || item.type === 'reel' ? 'vertical' : item.type === 'image_post' ? 'square' : item.type === 'long_video' ? 'landscape' : 'text',
        duration: item.type === 'short' || item.type === 'reel' ? '≤ 60 sec' : item.type === 'long_video' ? 'Long form' : '—',
        media: item.media || [],
        metadata: item.metadata || {}
      });
    }
  }
  return rows;
}

function pubFiltered() {
  const query = pubSearch.trim().toLowerCase();
  return pubJobs().filter((job) =>
    (pubProvider === 'all' || job.provider === pubProvider)
    && (pubStatus === 'all' || job.status === pubStatus)
    && (!query || `${job.title} ${job.copy} ${job.theme} ${job.account}`.toLowerCase().includes(query))
  ).sort((a, b) => new Date(pubWhen(a) || '2999-12-31') - new Date(pubWhen(b) || '2999-12-31'));
}

function pubQueueGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = pubWhen(row) ? pubDate(pubWhen(row)) : 'Unscheduled';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()];
}

function pubThumb(job) {
  const cls = job.aspect === 'vertical' ? 'vertical' : job.aspect === 'square' ? 'image' : '';
  const icon = ['long_video', 'short', 'reel'].includes(job.type) ? '▶' : job.type === 'image_post' ? '▧' : 'Aa';
  return `<span class="publisher-v7-thumb ${cls}">${icon}</span>`;
}

function pubStatusLabel(status) {
  return ({ review: 'Needs review', scheduled: 'Scheduled', draft: 'Draft', published: 'Published', failed: 'Failed', idea: 'Idea' })[status] || status;
}

function pubQueueItem(job) {
  return `<button class="publisher-v7-queue-item ${job.id === pubSelected ? 'active' : ''}" data-pub-select="${pube(job.id)}">${pubThumb(job)}<span class="publisher-v7-queue-copy"><span class="publisher-v7-queue-meta">${pubBadge(job.provider)}<span class="status-badge ${pube(job.status)}">${pube(pubStatusLabel(job.status))}</span></span><b>${pube(job.title)}</b><span class="publisher-v7-queue-time">${pube(pubTime(pubWhen(job)))} · ${pube(pubFormats[job.type] || job.type)}</span></span></button>`;
}

function pubQueue(rows) {
  return `<section class="publisher-v7-queue"><div class="publisher-v7-panel-head"><div><h2>Queue</h2><p>Every row is a destination projection of one canonical Content Library record.</p></div><span class="pill">${rows.length}</span></div><div class="publisher-v7-queue-body">${pubQueueGroups(rows).map(([label, items]) => `<div class="publisher-v7-group"><div class="publisher-v7-group-title"><b>${pube(label)}</b><span>${items.length} item${items.length === 1 ? '' : 's'}</span></div>${items.map(pubQueueItem).join('')}</div>`).join('') || '<div class="publisher-v7-empty">No queue items match these filters.</div>'}</div></section>`;
}

function pubMedia(job) {
  if (job.aspect === 'text') return '';
  const cls = job.aspect === 'vertical' ? 'vertical' : job.aspect === 'square' ? 'square' : '';
  const linked = job.media.find((entry) => entry.url)?.url || '';
  return `<div class="publisher-v7-media ${cls}"><div class="publisher-v7-media-art"><span>INTRAWEB 17</span><strong>${pube(job.title)}</strong><span>${pube(job.theme)}</span></div>${['long_video', 'short', 'reel'].includes(job.type) ? '<button class="publisher-v7-play" data-pub-play aria-label="Play preview">▶</button>' : ''}${linked ? `<a class="publisher-v7-media-link" href="${pube(linked)}" target="_blank" rel="noreferrer">Open linked asset ↗</a>` : ''}</div>`;
}

function pubSocialPreview(job) {
  return `<article class="publisher-v7-social-card"><div class="publisher-v7-social-head"><span class="publisher-v7-avatar">IW</span><div class="publisher-v7-account"><b>${pube(job.account)}</b><span>${pubBadge(job.provider)} · ${pube(pubTime(pubWhen(job)))}</span></div></div><div class="publisher-v7-copy">${pube(job.copy || 'No destination copy yet.')}</div>${pubMedia(job)}<div class="publisher-v7-engagement"><span>Canonical content · rev ${job.revision}</span><span>${pube(job.asset)}</span></div></article>`;
}

function pubCenter(job) {
  let body = '';
  if (pubPreviewTab === 'copy') {
    body = `<div class="publisher-v7-copy-editor"><h2>Destination copy</h2><p>This variant is stored inside the canonical ContentItem metadata for ${pube(pubProviders[job.provider]?.[1] || job.provider)}.</p><input id="pubTitle" value="${pube(job.title)}" aria-label="Destination title"><textarea id="pubCopy">${pube(job.copy)}</textarea><button class="primary-btn" data-pub-save-copy ${job.channelId ? '' : 'disabled'}>Save destination variant</button></div>`;
  } else if (pubPreviewTab === 'assets') {
    body = `<div class="publisher-v7-assets"><h2>Assets</h2><p>CMS stores links/references; media binaries stay in their source storage.</p><div class="publisher-v7-assets-grid"><div class="publisher-v7-asset"><b>Primary asset</b><span>${pube(job.asset)}</span><span class="meta-chip">${pube(job.aspect)}</span></div><div class="publisher-v7-asset"><b>Content source</b><span>${pube(job.source)}</span><span class="meta-chip">Revision ${job.revision}</span></div><div class="publisher-v7-asset"><b>Destination</b><span>${pube(job.account)}</span><span class="meta-chip">${pube(job.provider)}</span></div><div class="publisher-v7-asset"><b>Data ownership</b><span>Content Library</span><span class="meta-chip">canonical</span></div></div></div>`;
  } else {
    body = pubSocialPreview(job);
  }
  return `<section class="publisher-v7-preview"><div class="publisher-v7-preview-head"><div class="publisher-v7-preview-tabs"><button data-pub-tab="preview" class="${pubPreviewTab === 'preview' ? 'active' : ''}">Preview</button><button data-pub-tab="copy" class="${pubPreviewTab === 'copy' ? 'active' : ''}">Copy</button><button data-pub-tab="assets" class="${pubPreviewTab === 'assets' ? 'active' : ''}">Assets</button></div>${pubBadge(job.provider)}</div><div class="publisher-v7-preview-stage">${body}</div></section>`;
}

function pubInspector(job) {
  const when = pubWhen(job);
  const configured = job.channelId ? Boolean(pubChannel(job.channelId)?.connection?.configured) : false;
  return `<aside class="publisher-v7-inspector"><div class="publisher-v7-panel-head"><div><h2>Publication</h2><p>Actions update the canonical record through the content API.</p></div><span class="status-badge ${pube(job.status)}">${pube(pubStatusLabel(job.status))}</span></div><div class="publisher-v7-inspector-body"><div class="publisher-v7-field"><span>Publication date</span><input id="pubDate" type="date" value="${pube(pubDateInput(when))}"></div><div class="publisher-v7-field"><span>Time</span><input id="pubTime" type="time" value="${pube(pubTimeInput(when))}"></div><div class="publisher-v7-info"><div class="publisher-v7-info-row"><span>Channel</span><b>${pube(pubProviders[job.provider]?.[1] || job.provider)}</b></div><div class="publisher-v7-info-row"><span>Theme</span><b>${pube(job.theme)}</b></div><div class="publisher-v7-info-row"><span>Format</span><b>${pube(pubFormats[job.type] || job.type)}</b></div><div class="publisher-v7-info-row"><span>Revision</span><b>${job.revision}</b></div><div class="publisher-v7-info-row"><span>Source</span><b>Content Library · ${pube(job.contentId)}</b></div></div><div class="publisher-v7-checklist"><h3>Readiness</h3><div class="publisher-v7-check"><i>✓</i><span>Canonical content record exists</span></div><div class="publisher-v7-check ${job.channelId ? '' : 'warn'}"><i>${job.channelId ? '✓' : '!'}</i><span>${job.channelId ? 'Destination assigned' : 'Assign a destination before publishing'}</span></div><div class="publisher-v7-check ${job.asset === 'No linked asset' && job.type !== 'post' ? 'warn' : ''}"><i>${job.asset === 'No linked asset' && job.type !== 'post' ? '!' : '✓'}</i><span>${job.asset === 'No linked asset' && job.type !== 'post' ? 'Media asset needs attention' : 'Asset requirement acceptable'}</span></div><div class="publisher-v7-check ${configured || !job.channelId ? '' : 'warn'}"><i>${configured ? '✓' : '!'}</i><span>${configured ? 'Provider connection configured' : job.channelId ? 'Provider connection not configured' : 'No provider connection selected'}</span></div></div><div class="publisher-v7-actions">${job.status === 'published' ? '<button class="secondary-btn" data-pub-action="duplicate">Duplicate as new draft</button>' : `<button class="primary-btn" data-pub-action="approve">Approve & schedule</button><div class="row"><button class="secondary-btn" data-pub-action="revise">Request revision</button><button class="dark-btn" data-pub-action="publish" ${job.channelId ? '' : 'disabled'}>Publish now</button></div>`}</div><div id="pubFeedback" aria-live="polite"></div></div></aside>`;
}

async function pubLoad() {
  PUB = await window.CMSIW.loadState({ force: true });
}

function pubRender() {
  if (!PUB || pubRoute() !== 'publisher') return;
  const view = pubq('#view');
  if (!view) return;
  const all = pubJobs();
  const rows = pubFiltered();
  if (!pubSelected || !rows.some((job) => job.id === pubSelected)) pubSelected = rows[0]?.id || null;
  const selected = rows.find((job) => job.id === pubSelected) || rows[0];
  const providerCounts = Object.fromEntries(Object.keys(pubProviders).map((provider) => [provider, all.filter((job) => job.provider === provider).length]));

  view.innerHTML = `<div class="publisher-v7-shell"><div class="publisher-v7-filters"><div class="publisher-v7-provider-tabs"><button data-pub-provider="all" class="${pubProvider === 'all' ? 'active' : ''}">All <span class="count">${all.length}</span></button>${Object.keys(pubProviders).filter((provider) => provider !== 'unknown' || providerCounts.unknown).map((provider) => `<button data-pub-provider="${pube(provider)}" class="${pubProvider === provider ? 'active' : ''}">${pubBadge(provider)} <span class="count">${providerCounts[provider] || 0}</span></button>`).join('')}</div><div class="publisher-v7-searchrow"><input id="pubSearch" value="${pube(pubSearch)}" placeholder="Search title, theme or copy…"><div class="publisher-v7-status-tabs">${[['all', 'All'], ['review', 'Needs review'], ['scheduled', 'Scheduled'], ['draft', 'Drafts'], ['idea', 'Ideas'], ['published', 'Published'], ['failed', 'Failed']].map(([status, label]) => `<button data-pub-status="${status}" class="${pubStatus === status ? 'active' : ''}">${label} <span class="count">${status === 'all' ? all.length : all.filter((job) => job.status === status).length}</span></button>`).join('')}</div></div></div>${selected ? `<div class="publisher-v7-workbench">${pubQueue(rows)}${pubCenter(selected)}${pubInspector(selected)}</div>` : '<div class="publisher-v7-empty">No canonical content matches this queue.</div>'}</div>`;
  view.dataset.routeOwner = 'publisher';
  view.dataset.route = 'publisher';
  pubBind();
}

function pubSelectedJob() {
  return pubJobs().find((job) => job.id === pubSelected) || null;
}

function pubScheduleFromInputs() {
  const date = pubq('#pubDate')?.value;
  const time = pubq('#pubTime')?.value;
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
}

async function pubPatch(contentId, patch) {
  await window.CMSIW.api(`/api/content/${contentId}`, { method: 'PATCH', body: patch });
}

async function pubSaveVariant() {
  const job = pubSelectedJob();
  if (!job?.channelId) return;
  const content = PUB.content.find((item) => item.id === job.contentId);
  if (!content) return;
  const current = content.metadata?.destinationVariants || {};
  const variants = {
    ...current,
    [job.channelId]: {
      ...(current[job.channelId] || {}),
      title: pubq('#pubTitle')?.value.trim() || content.title,
      body: pubq('#pubCopy')?.value ?? content.body,
      updatedAt: new Date().toISOString()
    }
  };
  await pubPatch(job.contentId, { metadata: { destinationVariants: variants } });
  window.CMSIW.refreshApplication('publisher');
}

async function pubAction(action) {
  const job = pubSelectedJob();
  if (!job) return;
  try {
    const scheduledAt = pubScheduleFromInputs();
    if (action === 'approve') {
      await pubPatch(job.contentId, { status: 'scheduled', scheduledAt: scheduledAt || job.scheduledAt || new Date(Date.now() + 3600000).toISOString() });
    } else if (action === 'revise') {
      await pubPatch(job.contentId, { status: 'review', ...(scheduledAt ? { scheduledAt } : {}) });
    } else if (action === 'publish') {
      if (!job.channelId) throw new Error('Assign a destination before publishing');
      await window.CMSIW.api(`/api/content/${job.contentId}/publish`, { method: 'POST', body: { channelIds: [job.channelId] } });
    } else if (action === 'duplicate') {
      const source = PUB.content.find((item) => item.id === job.contentId);
      if (!source) throw new Error('Canonical content record not found');
      await window.CMSIW.api('/api/content', {
        method: 'POST',
        body: {
          projectId: source.projectId,
          topicId: source.topicId,
          type: source.type,
          title: `${source.title} — new version`,
          body: source.body,
          status: 'draft',
          scheduledAt: null,
          targetChannelIds: source.targetChannelIds || [],
          media: source.media || [],
          metadata: { duplicatedFromContentId: source.id }
        }
      });
    }
    window.CMSIW.refreshApplication('publisher');
  } catch (error) {
    window.CMSIW.toast(error.message, 'bad');
  }
}

function pubBind() {
  pubqa('[data-pub-select]').forEach((button) => { button.onclick = () => { pubSelected = button.dataset.pubSelect; pubPreviewTab = 'preview'; pubRender(); }; });
  pubqa('[data-pub-provider]').forEach((button) => { button.onclick = () => { pubProvider = button.dataset.pubProvider; pubRender(); }; });
  pubqa('[data-pub-status]').forEach((button) => { button.onclick = () => { pubStatus = button.dataset.pubStatus; pubRender(); }; });
  pubq('#pubSearch')?.addEventListener('input', (event) => {
    pubSearch = event.target.value;
    clearTimeout(window.__publisherSearch);
    window.__publisherSearch = setTimeout(pubRender, 120);
  });
  pubqa('[data-pub-tab]').forEach((button) => { button.onclick = () => { pubPreviewTab = button.dataset.pubTab; pubRender(); }; });
  pubq('[data-pub-save-copy]')?.addEventListener('click', () => pubSaveVariant().catch((error) => window.CMSIW.toast(error.message, 'bad')));
  pubq('[data-pub-play]')?.addEventListener('click', (event) => { event.currentTarget.textContent = event.currentTarget.textContent === '▶' ? 'Ⅱ' : '▶'; });
  pubqa('[data-pub-action]').forEach((button) => { button.onclick = () => pubAction(button.dataset.pubAction); });
}

async function pubApply() {
  if (pubRoute() !== 'publisher') return;
  try {
    await pubLoad();
    if (pubRoute() === 'publisher') pubRender();
  } catch (error) {
    window.CMSIW.toast(error.message, 'bad');
  }
}

window.addEventListener('hashchange', pubApply);
window.addEventListener('cmsiw:state-changed', pubApply);
pubApply();
