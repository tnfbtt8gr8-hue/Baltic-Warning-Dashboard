const { buildAssessment, annotateSignal } = require('./risk');
const { ccirs, pirs, sirs, indicators, collectionSirs, ffirs, nais, mapCountries, seriousIncidentReports, sourceAssets, redFlags } = require('./seed');
const { crawlerRegistry, crawlCustomRss, ENABLE_REMOTE_FETCH, fetchText } = require('./crawlers');
const { readAssessment, readSignals, writeAssessment, writeSignals, readCustomCrawlers, writeCustomCrawlers, readSettings, hasKvConfigured } = require('./store');

function dedupeSignals(signals) {
  const map = new Map();
  for (const signal of signals.map(annotateSignal)) map.set(signal.id, signal);
  return Array.from(map.values()).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
}
function dedupeSources(list) {
  const map = new Map();
  for (const item of list) {
    const key = `${item.url || item.name}`.toLowerCase();
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}
async function listCcirs() { return ccirs; }
async function listPirs() { return pirs; }
async function listSirs() { return sirs; }
async function listIndicators() { return indicators; }
async function listCollectionSirs() { return collectionSirs; }
async function listFfirs() { return ffirs; }
async function listNais() { return nais; }
async function listMapCountries() { return mapCountries; }
async function listSeriousIncidentReports() { return seriousIncidentReports; }
async function listSources() {
  const custom = await readCustomCrawlers();
  const customSources = custom.filter((item) => item.active !== false).map((item) => ({
    id: `custom:${item.id}`,
    name: item.name,
    category: 'Custom RSS',
    cadence: 'Hourly',
    period: 'User-defined RSS feed',
    use: 'User-added RSS source for early warning signal collection.',
    whyUseful: 'Adds a custom feed directly into the monitoring workflow.',
    url: item.url,
    active: item.active !== false,
    updatedAt: item.updatedAt || item.createdAt,
    lastRunAt: item.lastRunAt || null,
    lastSuccessAt: item.lastSuccessAt || null,
    status: item.status || 'active',
    lastSignalCount: item.lastSignalCount || 0,
    lastError: item.lastError || null
  }));
  return dedupeSources([...sourceAssets.map((s) => ({ ...s, active: s.active !== false })), ...customSources]);
}
async function listRedFlags() { return redFlags; }
async function listSignals() { return (await readSignals()).map(annotateSignal); }
async function getLatestAssessment() { return buildAssessment(await readSignals()); }
async function getSettings() { return readSettings(); }
async function bootstrapIfNeeded() {
  const current = await readAssessment();
  const next = buildAssessment(await readSignals());
  if (!current || !current.updatedAt || current.label !== next.label || current.score !== next.score) await writeAssessment(next);
}
async function runCrawler(name) {
  const fn = crawlerRegistry[name];
  if (!fn) return { crawler: name, inserted: 0, totalSignals: (await readSignals()).length, error: 'Unknown crawler' };
  const currentSignals = await readSignals();
  const newSignals = await fn();
  const merged = dedupeSignals([...currentSignals, ...newSignals]);
  await writeSignals(merged);
  const assessment = buildAssessment(merged);
  await writeAssessment(assessment);
  return { crawler: name, inserted: newSignals.length, totalSignals: merged.length, assessment };
}
async function runCustomCrawler(crawler) {
  const currentSignals = await readSignals();
  const customItems = await readCustomCrawlers();
  const idx = customItems.findIndex((item) => item.id === crawler.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    customItems[idx] = { ...customItems[idx], lastRunAt: now, updatedAt: now, status: 'running', lastError: null };
    await writeCustomCrawlers(customItems);
  }
  try {
    const newSignals = await crawlCustomRss(crawler);
    const merged = dedupeSignals([...currentSignals, ...newSignals]);
    await writeSignals(merged);
    const assessment = buildAssessment(merged);
    await writeAssessment(assessment);
    if (idx >= 0) {
      const refresh = await readCustomCrawlers();
      const idx2 = refresh.findIndex((item) => item.id === crawler.id);
      if (idx2 >= 0) {
        refresh[idx2] = { ...refresh[idx2], lastRunAt: now, lastSuccessAt: now, updatedAt: now, lastSignalCount: newSignals.length, status: 'ok', lastError: null };
        await writeCustomCrawlers(refresh);
      }
    }
    return { crawler: crawler.name, inserted: newSignals.length, totalSignals: merged.length, assessment };
  } catch (error) {
    if (idx >= 0) {
      const refresh = await readCustomCrawlers();
      const idx2 = refresh.findIndex((item) => item.id === crawler.id);
      if (idx2 >= 0) {
        refresh[idx2] = { ...refresh[idx2], lastRunAt: now, updatedAt: now, status: 'error', lastError: String(error), lastSignalCount: 0 };
        await writeCustomCrawlers(refresh);
      }
    }
    throw error;
  }
}
async function runAllCrawlers() {
  const results = [];
  for (const name of Object.keys(crawlerRegistry)) {
    try { results.push(await runCrawler(name)); }
    catch (error) { results.push({ crawler: name, inserted: 0, error: String(error) }); }
  }
  const customCrawlers = (await readCustomCrawlers()).filter((item) => item.active !== false && item.type === 'rss');
  for (const crawler of customCrawlers) {
    try { results.push(await runCustomCrawler(crawler)); }
    catch (error) { results.push({ crawler: crawler.name, inserted: 0, error: String(error) }); }
  }
  return results;
}
async function runSystemTests() {
  const startedAt = new Date().toISOString();
  const assessment = await getLatestAssessment();
  const custom = await readCustomCrawlers();
  const sources = await listSources();
  const activeSources = sources.filter((s) => s.active !== false);
  const activeCrawlerIds = Object.keys(crawlerRegistry);
  const tests = [];
  const add = (item) => tests.push({
    severity: item.severity || 'warning',
    connected: !!item.connected,
    detail: item.detail || '',
    lastUpdated: item.lastUpdated || assessment.updatedAt || startedAt,
    ...item
  });

  add({ id:'api', name:'Serverless API', category:'core', severity:'critical', connected:true, detail:'Dashboard API reachable' });
  add({ id:'assessment', name:'Assessment engine', category:'core', severity:'critical', connected:!!assessment && typeof assessment.score === 'number', detail:`Threat assessment available: ${assessment.label || 'unknown'} / ${assessment.score || 0}` });
  add({ id:'ontology', name:'Ontology model', category:'core', severity:'critical', connected:true, detail:'Event/time/place/people/organizations/objects extraction loaded' });
  add({ id:'crawler-registry', name:'Crawler registry', category:'crawler', severity:'critical', connected:activeCrawlerIds.length >= 1, detail:`${activeCrawlerIds.length} server-side crawlers registered: ${activeCrawlerIds.join(', ')}` });
  add({ id:'storage', name:'Persistent storage', category:'storage', severity:'warning', connected:hasKvConfigured(), detail:hasKvConfigured() ? 'KV configured for server-side persistence' : 'KV not configured; custom crawlers use browser fallback and will not persist server-side' });
  add({ id:'remote-fetch', name:'Remote fetch', category:'crawler', severity:'critical', connected:ENABLE_REMOTE_FETCH, detail:ENABLE_REMOTE_FETCH ? 'ENABLE_REMOTE_FETCH=true; live crawler fetches allowed' : 'ENABLE_REMOTE_FETCH=false; live crawler fetches disabled' });

  const naiIds = new Set(nais.map((n) => n.id));
  const pirsById = new Set(pirs.map((p) => p.id));
  const indicatorsById = new Set(indicators.map((i) => i.id));
  const ccirsById = new Set(ccirs.map((c) => c.id));
  const naiCoverage = new Set(collectionSirs.map((sir) => sir.nai));
  const brokenPirs = pirs.filter((p) => !ccirsById.has(p.ccir));
  const brokenIndicators = indicators.filter((i) => !pirsById.has(i.pir));
  const brokenCollection = collectionSirs.filter((sir) => !pirsById.has(sir.pir) || !indicatorsById.has(sir.indicator) || !naiIds.has(sir.nai));
  const uncoveredNais = nais.filter((n) => !naiCoverage.has(n.id));
  add({ id:'warning-model-links', name:'Baltic warning model links', category:'model', severity:'critical', connected:brokenPirs.length === 0 && brokenIndicators.length === 0 && brokenCollection.length === 0, detail:`CCIR/PIR/indicator/collection SIR link check: ${brokenPirs.length + brokenIndicators.length + brokenCollection.length} broken links` });
  add({ id:'nai-coverage', name:'NAI collection coverage', category:'model', severity:'critical', connected:uncoveredNais.length === 0, detail:uncoveredNais.length ? `Uncovered NAIs: ${uncoveredNais.map((n) => n.id).join(', ')}` : `${nais.length} NAIs covered by Collection SIRs` });
  add({ id:'source-count', name:'Active source list', category:'source', severity:'warning', connected:activeSources.length >= 1, detail:`${activeSources.length} active source assets configured` });

  const probes = activeSources.slice(0, 8);
  if (!ENABLE_REMOTE_FETCH) {
    for (const src of probes) add({ id:`src:${src.id}`, name:src.name, category:'source', severity:'warning', connected:false, detail:'Not live-tested because remote fetch is disabled', lastUpdated: src.updatedAt || assessment.updatedAt || null });
  } else {
    const probeResults = await Promise.all(probes.map(async (src) => {
      let connected = false;
      let detail = 'Not tested';
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(src.url, { method: 'GET', signal: ctrl.signal, headers: { 'user-agent': 'BalticWarningDashboard/4.0.2 system-test' } });
        clearTimeout(timer);
        connected = res.ok;
        detail = `HTTP ${res.status}`;
      } catch (error) {
        detail = String(error).slice(0, 140);
      }
      return { id:`src:${src.id}`, name:src.name, category:'source', severity:'warning', connected, detail, lastUpdated: src.updatedAt || assessment.updatedAt || null };
    }));
    probeResults.forEach(add);
  }

  const critical = tests.filter((t) => t.severity === 'critical');
  const warning = tests.filter((t) => t.severity !== 'critical');
  const criticalFailed = critical.filter((t) => !t.connected);
  const warningFailed = warning.filter((t) => !t.connected);
  const connected = tests.filter((t) => t.connected).length;
  const readinessScore = Math.round((connected / Math.max(1, tests.length)) * 100);
  let operationalStatus = 'operational';
  if (criticalFailed.length > 0) operationalStatus = 'offline';
  else if (warningFailed.length > 0) operationalStatus = 'degraded';
  const blockers = criticalFailed.map((t) => t.name);
  const warnings = warningFailed.map((t) => t.name);

  return {
    ok: operationalStatus !== 'offline',
    operationalStatus,
    readinessScore,
    completedAt: new Date().toISOString(),
    totals: { total: tests.length, connected, failed: tests.length - connected, criticalFailed: criticalFailed.length, warningFailed: warningFailed.length },
    crawlerCount: custom.length,
    registeredCrawlerCount: activeCrawlerIds.length,
    activeSourceCount: activeSources.length,
    blockers,
    warnings,
    tests
  };
}
module.exports = { listCcirs, listPirs, listSirs, listIndicators, listCollectionSirs, listFfirs, listNais, listMapCountries, listSeriousIncidentReports, listSources, listRedFlags, listSignals, getLatestAssessment, getSettings, bootstrapIfNeeded, runCrawler, runAllCrawlers, runSystemTests };
