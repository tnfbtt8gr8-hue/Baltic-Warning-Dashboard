const { getSourceName } = require('./store');
const { annotateSignal } = require('./risk');
const ENABLE_REMOTE_FETCH = process.env.ENABLE_REMOTE_FETCH !== 'false';

function normalizeSignal(sourceId, item) {
  return annotateSignal({
    id: `${sourceId}-${Buffer.from(item.url).toString('base64').slice(0, 18)}`,
    sourceId,
    sourceName: item.sourceName || getSourceName(sourceId),
    title: item.title,
    summary: item.summary || '',
    url: item.url,
    publishedAt: item.publishedAt || new Date().toISOString(),
    tags: item.tags || [],
    confidence: item.confidence || 'medium'
  });
}
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'BalticWarningDashboard/4.0.2 (+public research use)' } });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  return response.text();
}
function stripTags(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function readTagBlock(xml, tag) {
  const cdata = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdata) return cdata[1].trim();
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return plain ? stripTags(plain[1]) : '';
}
function parseRssItems(xml) {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const itemXml of matches.slice(0, 20)) {
    const title = readTagBlock(itemXml, 'title');
    const link = readTagBlock(itemXml, 'link');
    const pubDate = readTagBlock(itemXml, 'pubDate') || readTagBlock(itemXml, 'dc:date');
    const description = readTagBlock(itemXml, 'description') || readTagBlock(itemXml, 'content:encoded');
    if (title && link) items.push({ title, link, pubDate, description });
  }
  return items;
}
async function crawlRss(sourceId, url, sourceName, extraTags = []) {
  if (!ENABLE_REMOTE_FETCH) return [];
  const xml = await fetchText(url);
  return parseRssItems(xml).map((item) => normalizeSignal(sourceId, {
    sourceName,
    title: item.title,
    url: item.link,
    summary: item.description,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    tags: ['rss', sourceName, ...extraTags]
  }));
}
async function crawlIsw() { return crawlRss('isw', 'https://www.understandingwar.org/rss.xml', 'ISW daily assessments', ['isw','campaign']); }
async function crawlPostimees() { return crawlRss('postimees', 'https://www.postimees.ee/rss', 'Postimees.ee', ['estonia','media']); }
async function crawlDelfi() { return crawlRss('delfi', 'https://www.delfi.ee/rss', 'Delfi.ee', ['estonia','media']); }
async function crawlNato() {
  if (!ENABLE_REMOTE_FETCH) return [];
  const html = await fetchText('https://www.nato.int/cps/en/natohq/news.htm');
  const cards = [...html.matchAll(/href="([^"]+)"[^>]*>([^<]{20,200})<\/a>/gi)].slice(0, 12);
  return cards.map((m) => normalizeSignal('nato', { title: stripTags(m[2]), url: m[1].startsWith('http') ? m[1] : `https://www.nato.int${m[1]}`, summary: 'NATO news or posture-related update fetched from public news page.', publishedAt: new Date().toISOString(), tags: ['nato','deterrence'] }));
}
async function crawlVla() {
  if (!ENABLE_REMOTE_FETCH) return [];
  const html = await fetchText('https://www.valisluureamet.ee/en.html');
  const entries = [...html.matchAll(/href="([^"]+)"[^>]*>([^<]{15,180})<\/a>/gi)].slice(0, 10);
  return entries.map((m) => normalizeSignal('vla', { title: stripTags(m[2]), url: m[1].startsWith('http') ? m[1] : `https://www.valisluureamet.ee${m[1]}`, summary: 'Public Estonian foreign intelligence or national security related item.', publishedAt: new Date().toISOString(), tags: ['estonia','intelligence'] }));
}
async function crawlOoni() {
  if (!ENABLE_REMOTE_FETCH) return [];
  const html = await fetchText('https://explorer.ooni.org/');
  const snippets = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{15,180})<\/a>/gi)].slice(0, 10);
  return snippets.map((m) => normalizeSignal('ooni', { title: stripTags(m[2]), url: m[1].startsWith('http') ? m[1] : `https://explorer.ooni.org${m[1]}`, summary: 'Public network measurement or censorship related item.', publishedAt: new Date().toISOString(), tags: ['ooni','network'] }));
}

async function crawlVm() {
  if (!ENABLE_REMOTE_FETCH) return [];
  const html = await fetchText('https://www.vm.ee/en/news');
  const entries = [...html.matchAll(/href="([^"]+)"[^>]*>([^<]{15,180})<\/a>/gi)].slice(0, 10);
  return entries.map((m) => normalizeSignal('vm', { title: stripTags(m[2]), url: m[1].startsWith('http') ? m[1] : `https://www.vm.ee${m[1]}`, summary: 'Official Estonian foreign policy or diplomatic statement relevant to regional warning.', publishedAt: new Date().toISOString(), tags: ['estonia','official','diplomacy','baltic'] }));
}

async function crawlCustomRss(crawler) { return crawlRss(`custom:${crawler.id}`, crawler.url, crawler.name, ['custom-rss']); }
const crawlerRegistry = { isw: crawlIsw, nato: crawlNato, vla: crawlVla, ooni: crawlOoni, postimees: crawlPostimees, delfi: crawlDelfi, vm: crawlVm };
module.exports = { crawlerRegistry, normalizeSignal, parseRssItems, stripTags, crawlCustomRss, crawlRss, ENABLE_REMOTE_FETCH, fetchText };
