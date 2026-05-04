const { readCustomCrawlers, writeCustomCrawlers } = require('./_lib/store');
const { sendJson, readJsonBody } = require('./_lib/http');

function makeId() {
  return `crawler_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isValidHttpUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getQueryId(req) {
  if (req.query && req.query.id) return String(req.query.id).trim();
  try {
    const url = new URL(req.url || '', 'https://local.vercel.app');
    return String(url.searchParams.get('id') || '').trim();
  } catch {
    return '';
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return sendJson(res, 200, { items: await readCustomCrawlers() });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : await readJsonBody(req);
    const name = String(body.name || '').trim();
    const url = String(body.url || '').trim();
    const type = String(body.type || 'rss').trim();
    const active = body.active !== false;

    if (!name || !url) return sendJson(res, 400, { error: 'Missing name or url' });
    if (!isValidHttpUrl(url)) return sendJson(res, 400, { error: 'Invalid URL' });
    if (type !== 'rss') return sendJson(res, 400, { error: 'Only RSS is supported in v4.0.2' });

    const now = new Date().toISOString();
    const items = await readCustomCrawlers();
    const item = {
      id: makeId(),
      name,
      url,
      type,
      active,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastSignalCount: 0,
      status: 'active'
    };
    items.push(item);
    await writeCustomCrawlers(items);
    return sendJson(res, 200, { ok: true, item });
  }

  if (req.method === 'DELETE') {
    const id = getQueryId(req);
    if (!id) return sendJson(res, 400, { error: 'Missing id' });
    const next = (await readCustomCrawlers()).filter((x) => x.id !== id);
    await writeCustomCrawlers(next);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
