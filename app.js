const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const formatLabels = {
  post: 'Post',
  image_post: 'Image post',
  short: 'Short',
  reel: 'Reel',
  long_video: 'Long video'
};

const providerShort = {
  youtube: 'YT', linkedin: 'IN', telegram: 'TG', facebook: 'FB',
  instagram: 'IG', tiktok: 'TT', vk: 'VK', x: 'X'
};

let shellState = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok && response.status !== 207) throw new Error(data?.error || `Request failed: ${response.status}`);
  return data;
}

async function loadState({ force = false } = {}) {
  if (!shellState || force) shellState = await api('/api/state');
  return shellState;
}

function toast(message, kind = 'good') {
  const host = qs('#toastHost');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  host.append(node);
  setTimeout(() => node.remove(), 4200);
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function notifyStateChanged(detail = {}) {
  shellState = null;
  window.dispatchEvent(new CustomEvent('cmsiw:state-changed', { detail }));
}

function refreshApplication(route = null) {
  if (route) {
    const target = `${location.pathname}${location.search}#/${route}`;
    history.replaceState(null, '', target);
  }
  location.reload();
}

async function openComposer() {
  try {
    const state = await loadState({ force: true });
    qs('#cType').innerHTML = Object.entries(formatLabels)
      .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    qs('#cTopic').innerHTML = state.topics
      .map((topic) => `<option value="${topic.id}">${esc(topic.name)}</option>`).join('');
    qs('#cChannels').innerHTML = state.channels
      .map((channel) => `<label class="channel-check"><input type="checkbox" value="${channel.id}"><span>${providerShort[channel.provider] || channel.provider} · ${esc(channel.account || channel.label)}</span></label>`)
      .join('');
    qs('#composerForm').reset();
    qs('#composer').showModal();
    setTimeout(() => qs('#cTitle')?.focus(), 50);
  } catch (error) {
    toast(error.message, 'bad');
  }
}

function composerPayload(state, status = 'draft') {
  const type = qs('#cType').value;
  const mediaKind = ['short', 'reel', 'long_video'].includes(type) ? 'video' : type === 'image_post' ? 'image' : null;
  const url = qs('#cMediaUrl').value.trim();
  const localPath = qs('#cMediaPath').value.trim();
  const scheduleValue = qs('#cSchedule').value;
  return {
    projectId: state.project.id,
    topicId: qs('#cTopic').value,
    type,
    title: qs('#cTitle').value.trim(),
    body: qs('#cBody').value.trim(),
    status: scheduleValue && status !== 'draft' ? 'scheduled' : status,
    scheduledAt: scheduleValue ? new Date(scheduleValue).toISOString() : null,
    targetChannelIds: qsa('#cChannels input:checked').map((input) => input.value),
    media: mediaKind && (url || localPath)
      ? [{ kind: mediaKind, url, localPath, mimeType: mediaKind === 'video' ? 'video/mp4' : '' }]
      : []
  };
}

async function saveComposer(mode) {
  try {
    const state = await loadState({ force: true });
    const targetStatus = mode === 'publish' ? 'draft' : mode === 'draft' ? 'draft' : 'scheduled';
    const payload = composerPayload(state, targetStatus);
    if (!payload.title) throw new Error('Title is required');
    if (mode === 'publish' && !payload.targetChannelIds.length) throw new Error('Choose at least one destination before publishing');

    const item = await api('/api/content', { method: 'POST', body: payload });
    if (mode === 'publish') {
      const result = await api(`/api/content/${item.id}/publish`, {
        method: 'POST',
        body: { channelIds: payload.targetChannelIds }
      });
      const failed = result.results.filter((entry) => entry.status === 'failed');
      if (failed.length) toast(`Saved. Publishing failed on ${failed.length} destination(s): ${failed[0].message}`, 'bad');
    }

    qs('#composer').close();
    refreshApplication(mode === 'publish' ? 'publisher' : 'content');
  } catch (error) {
    toast(error.message, 'bad');
  }
}

function bindShellActions() {
  qs('#newContentBtn')?.addEventListener('click', openComposer);
  qs('#closeComposer')?.addEventListener('click', () => qs('#composer')?.close());
  qs('#saveDraftBtn')?.addEventListener('click', () => saveComposer('draft'));
  qs('#saveScheduleBtn')?.addEventListener('click', () => saveComposer('scheduled'));
  qs('#publishNowBtn')?.addEventListener('click', () => saveComposer('publish'));
  qs('#quickSearch')?.addEventListener('click', () => {
    navigate('content');
    setTimeout(() => qs('#fQ')?.focus(), 80);
  });
  qsa('[data-shell-route]').forEach((button) => {
    button.addEventListener('click', () => navigate(button.dataset.shellRoute));
  });
}

window.CMSIW = Object.freeze({
  api,
  loadState,
  toast,
  navigate,
  notifyStateChanged,
  refreshApplication,
  formatLabels,
  providerShort
});

bindShellActions();
