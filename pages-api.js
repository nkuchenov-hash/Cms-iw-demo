(() => {
  if (!location.hostname.endsWith('github.io')) return;

  const nativeFetch = window.fetch.bind(window);
  const STORAGE_KEY = `cms-iw-pages-v1:${location.pathname.split('/').filter(Boolean)[0] || 'root'}`;
  const providerCapabilities = {
    youtube: { oauth: true, text: false, image: false, video: true, shorts: true },
    linkedin: { oauth: true, text: true, image: true, video: true, shorts: false },
    telegram: { oauth: false, text: true, image: true, video: true, shorts: false },
    facebook: { oauth: false, text: true, image: true, video: true, shorts: false },
    instagram: { oauth: false, text: false, image: true, video: true, shorts: true },
    tiktok: { oauth: true, text: false, image: false, video: true, shorts: true }
  };

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const nowIso = () => new Date().toISOString();
  const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const bodyOf = async (options) => !options?.body ? {} : typeof options.body === 'string' ? JSON.parse(options.body || '{}') : options.body;

  async function freshSeed() {
    const response = await nativeFetch('./pages-seed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Pages seed unavailable: ${response.status}`);
    return response.json();
  }
  async function load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    const data = await freshSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  let dbPromise = load();
  const db = () => dbPromise;
  async function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    dbPromise = Promise.resolve(data);
    return data;
  }

  function analyticsSummary(data) {
    const snapshots = data.analyticsSnapshots || [];
    const totals = snapshots.reduce((acc, s) => {
      const n = s.normalized || {};
      acc.impressions += Number(n.impressions || 0);
      acc.engagements += Number(n.engagements || 0);
      acc.views += Number(n.views || 0);
      acc.watchMinutes += Number(n.watchMinutes || 0);
      return acc;
    }, { impressions: 0, engagements: 0, views: 0, watchMinutes: 0 });
    return { ...totals, snapshots: clone(snapshots) };
  }

  function dashboard(data) {
    const content = data.content || [];
    const now = Date.now();
    return {
      counts: {
        published: content.filter(x => x.status === 'published').length,
        scheduled: content.filter(x => x.status === 'scheduled').length,
        inProgress: content.filter(x => ['idea', 'draft', 'review'].includes(x.status)).length,
        failed: (data.publicationAttempts || []).filter(x => x.status === 'failed').length,
        total: content.length
      },
      analytics: analyticsSummary(data),
      upcoming: content.filter(x => x.scheduledAt && new Date(x.scheduledAt).getTime() >= now).sort((a,b) => new Date(a.scheduledAt)-new Date(b.scheduledAt)).slice(0,8),
      recentAttempts: clone((data.publicationAttempts || []).slice(0,8))
    };
  }

  function appState(data) {
    return {
      project: clone(data.projects?.[0] || {}),
      topicGroups: clone(data.topicGroups || []),
      topics: clone(data.topics || []),
      content: clone(data.content || []),
      channels: (data.channels || []).map(ch => ({
        ...clone(ch),
        capabilities: providerCapabilities[ch.provider] || {},
        connection: { configured: false, detail: 'Static GitHub Pages preview — provider credentials are not exposed.' }
      })),
      references: clone(data.references || []),
      sources: clone(data.sources || []),
      styleProfile: clone(data.styleProfiles?.[0] || null),
      publicationAttempts: clone(data.publicationAttempts || []),
      dashboard: dashboard(data),
      system: { vaultAvailable: false, baseUrl: location.href.split('#')[0] }
    };
  }

  function knowledgeState(data, projectId = 'iw17') {
    return {
      projectId,
      sourceGroups: clone(data.sourceGroups || []),
      sources: clone((data.sources || []).filter(x => x.projectId === projectId)),
      knowledgeItems: clone((data.knowledgeItems || []).filter(x => x.projectId === projectId)),
      topics: clone((data.topics || []).filter(x => x.projectId === projectId)),
      topicGroups: clone((data.topicGroups || []).filter(x => x.projectId === projectId)),
      content: clone((data.content || []).filter(x => x.projectId === projectId).map(x => ({
        id: x.id, title: x.title, topicId: x.topicId, type: x.type, status: x.status,
        scheduledAt: x.scheduledAt, publishedAt: x.publishedAt, metadata: x.metadata || {}
      })))
    };
  }

  window.fetch = async (input, options = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, options);

    const method = (options.method || 'GET').toUpperCase();
    let data = await db();

    if (method === 'GET' && url.pathname === '/api/state') return json(appState(data));
    if (method === 'GET' && url.pathname === '/api/knowledge-base') return json(knowledgeState(data, url.searchParams.get('projectId') || 'iw17'));

    if (method === 'POST' && url.pathname === '/api/content') {
      const body = await bodyOf(options);
      const record = {
        id: makeId('cnt'), projectId: body.projectId || 'iw17', topicId: body.topicId || null,
        type: body.type || 'post', title: String(body.title || '').trim(), body: String(body.body || ''),
        status: body.status || (body.scheduledAt ? 'scheduled' : 'draft'), revision: 1,
        targetChannelIds: Array.isArray(body.targetChannelIds) ? body.targetChannelIds : [],
        scheduledAt: body.scheduledAt || null, publishedAt: null,
        media: Array.isArray(body.media) ? body.media : [], metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        createdAt: nowIso(), updatedAt: nowIso(), revisionHistory: []
      };
      if (!record.title) return json({ error: 'Title is required' }, 400);
      data.content ||= []; data.content.unshift(record); await save(data); return json(record, 201);
    }

    const contentMatch = url.pathname.match(/^\/api\/content\/([^/]+)$/);
    if (contentMatch && method === 'PATCH') {
      const body = await bodyOf(options); const item = (data.content || []).find(x => x.id === contentMatch[1]);
      if (!item) return json({ error: 'Content not found' }, 404);
      item.revisionHistory ||= []; item.revisionHistory.unshift({ revision: item.revision || 1, title: item.title, body: item.body, status: item.status, capturedAt: nowIso() });
      item.revision = Number(item.revision || 1) + 1;
      for (const key of ['title','body','topicId','type','status','scheduledAt','targetChannelIds','media']) if (key in body) item[key] = body[key];
      if (body.metadata && typeof body.metadata === 'object') item.metadata = { ...(item.metadata || {}), ...body.metadata };
      item.updatedAt = nowIso(); await save(data); return json(item);
    }

    const publish = url.pathname.match(/^\/api\/content\/([^/]+)\/publish$/);
    if (publish && method === 'POST') {
      const body = await bodyOf(options); const item = (data.content || []).find(x => x.id === publish[1]);
      if (!item) return json({ error: 'Content not found' }, 404);
      const channelIds = Array.isArray(body.channelIds) ? body.channelIds : (item.targetChannelIds || []);
      const results = channelIds.map(channelId => {
        const channel = (data.channels || []).find(c => c.id === channelId);
        const attempt = { id: makeId('pub'), contentId: item.id, revision: item.revision, channelId, provider: channel?.provider || channelId,
          idempotencyKey: makeId('preview'), status: 'success', externalId: 'pages-preview', startedAt: nowIso(), finishedAt: nowIso(),
          message: 'GitHub Pages simulation — no external publication occurred.' };
        data.publicationAttempts ||= []; data.publicationAttempts.unshift(attempt); return attempt;
      });
      item.status = 'published'; item.publishedAt = nowIso(); item.updatedAt = nowIso(); await save(data); return json({ results });
    }

    const channelMatch = url.pathname.match(/^\/api\/channels\/([^/]+)$/);
    if (channelMatch && method === 'PATCH') {
      const body = await bodyOf(options); const channel = (data.channels || []).find(x => x.id === channelMatch[1]);
      if (!channel) return json({ error: 'Channel not found' }, 404);
      if ('enabled' in body) channel.enabled = Boolean(body.enabled); if (body.config) channel.config = { ...(channel.config || {}), ...body.config };
      await save(data); return json(channel);
    }

    if (method === 'POST' && (url.pathname === '/api/sources' || url.pathname === '/api/knowledge/sources')) {
      const body = await bodyOf(options); const source = {
        id: makeId('src'), projectId: body.projectId || 'iw17', name: String(body.name || '').trim(), kind: body.kind || (body.url ? 'website' : 'manual'),
        url: body.url || '', sourceClass: body.sourceClass || 'manual', sourceGroup: body.sourceGroup || 'manual', description: body.description || '',
        topicIds: Array.isArray(body.topicIds) ? body.topicIds : [], priority: Number(body.priority ?? 50), enabled: body.enabled !== false,
        createdAt: nowIso(), updatedAt: nowIso()
      };
      if (!source.name) return json({ error: 'Source name is required' }, 400);
      data.sources ||= []; data.sources.unshift(source); await save(data); return json(source, 201);
    }

    if (method === 'POST' && url.pathname === '/api/knowledge/items') {
      const body = await bodyOf(options); const source = (data.sources || []).find(x => x.id === body.sourceId);
      const item = { id: makeId('kb'), projectId: body.projectId || 'iw17', sourceId: body.sourceId || '', sourceClass: source?.sourceClass || body.sourceClass || 'manual',
        kind: body.kind || 'idea', title: String(body.title || '').trim(), summary: String(body.summary || '').trim(), details: body.details || '', sourceSection: body.sourceSection || '',
        sourceUrl: body.sourceUrl || source?.url || '', topicIds: Array.isArray(body.topicIds) ? body.topicIds : [], tags: Array.isArray(body.tags) ? body.tags : [],
        status: body.status || 'ready', collectedAt: body.collectedAt || nowIso(), createdAt: nowIso(), updatedAt: nowIso() };
      if (!item.title || !item.summary) return json({ error: 'Knowledge title and summary are required' }, 400);
      data.knowledgeItems ||= []; data.knowledgeItems.unshift(item); await save(data); return json(item, 201);
    }

    const knowledgeMatch = url.pathname.match(/^\/api\/knowledge\/items\/([^/]+)$/);
    if (knowledgeMatch && method === 'PATCH') {
      const body = await bodyOf(options); const item = (data.knowledgeItems || []).find(x => x.id === knowledgeMatch[1]);
      if (!item) return json({ error: 'Knowledge item not found' }, 404);
      for (const key of ['title','summary','details','sourceSection','sourceUrl','kind','status','topicIds','tags']) if (key in body) item[key] = body[key];
      item.updatedAt = nowIso(); await save(data); return json(item);
    }

    if (method === 'POST' && url.pathname === '/api/references') {
      const body = await bodyOf(options); const ref = { id: makeId('ref'), projectId: body.projectId || 'iw17', kind: body.kind || 'text', title: body.title || 'Reference sample', sourceUrl: body.sourceUrl || '', text: body.text || '', tags: body.tags || [], createdAt: nowIso() };
      data.references ||= []; data.references.unshift(ref); await save(data); return json(ref, 201);
    }

    if (method === 'POST' && url.pathname === '/api/style/rebuild') {
      const samples = (data.references || []).filter(r => r.text); const words = samples.flatMap(r => r.text.trim().split(/\s+/).filter(Boolean));
      const sentences = samples.flatMap(r => r.text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean)); const countWords = arr => arr.reduce((n,s) => n + s.split(/\s+/).filter(Boolean).length, 0);
      const profile = { id: 'style-iw17', projectId: 'iw17', name: 'IntraWeb voice', updatedAt: nowIso(), fingerprint: { sampleCount: samples.length, averageSentenceWords: sentences.length ? Math.round(countWords(sentences)/sentences.length) : 0, vocabularySize: new Set(words.map(w => w.toLowerCase())).size } };
      data.styleProfiles = [profile]; await save(data); return json(profile);
    }

    if (method === 'POST' && url.pathname === '/api/dev/reset') {
      localStorage.removeItem(STORAGE_KEY); dbPromise = freshSeed(); const reset = await dbPromise; localStorage.setItem(STORAGE_KEY, JSON.stringify(reset)); return json({ ok: true });
    }

    return json({ error: 'This operation requires the server-backed CMS. GitHub Pages runs the same UI with a local preview data adapter.' }, 400);
  };
})();
