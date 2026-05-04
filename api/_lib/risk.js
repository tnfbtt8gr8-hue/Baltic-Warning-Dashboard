const { pirs, indicators, collectionSirs, ffirs, ccirs, redFlags, nais, mapCountries } = require('./seed');

function normalizeText(value) { return String(value || '').toLowerCase(); }
function uniq(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function translateText(value) { return value; }

const ontologyLexicon = {
  event: [
    ['force_deployment', ['deployment','redeploy','brigade','division','battalion','troop','unit','posture','exercise','mobilisation','mobilization']],
    ['logistics_build_up', ['fuel','ammunition','ammo','depot','rail','bridge','medical','hospital','logistics','supply','maintenance']],
    ['hybrid_incident', ['cyber','sabotage','gps','jamming','drone','uav','airspace','maritime','vessel','cable','pipeline']],
    ['pretext_narrative', ['pretext','provocation','false flag','narrative','minorities','nato aggression','russian speakers']],
    ['political_enabling', ['belarus','union state','access','base','airfield','border','joint exercise']]
  ],
  objects: [
    ['artillery', ['artillery','152','155','howitzer','mlrs','rocket']],
    ['air_defence', ['air defence','air defense','s-300','s-400','sam','radar']],
    ['ew_cyber', ['ew','electronic warfare','gps','jamming','cyber','telecom']],
    ['uav_drone', ['drone','uav','isr','surveillance']],
    ['logistics_asset', ['fuel','ammunition','depot','bridge','rail','supply','maintenance','hospital']],
    ['naval_air_asset', ['aircraft','ship','vessel','maritime','airspace']]
  ],
  organizations: [
    ['Russia / Russian forces', ['russia','russian','kremlin','western military district','north-western']],
    ['Belarus state / forces', ['belarus','belarusian','minsk']],
    ['NATO / allies', ['nato','shape','allied','allies']],
    ['Baltic states', ['estonia','latvia','lithuania','baltic states']]
  ],
  people: [
    ['political leadership', ['president','minister','kremlin','leadership','commander']],
    ['military personnel', ['soldiers','troops','personnel','conscripts','recruits']]
  ],
  time: [
    ['near_term', ['today','yesterday','tomorrow','hour','daily','overnight','immediate','within']],
    ['exercise_window', ['exercise','drill','rotation','window','phase']]
  ]
};

function findMatches(text, entries) {
  const found = [];
  for (const [label, words] of entries) {
    if (words.some((word) => text.includes(word))) found.push(label);
  }
  return found;
}

function extractPlaces(text) {
  const places = [];
  const aliases = [
    ['Kola / Murmansk / Northern Fleet', ['kola','murmansk','northern fleet']],
    ['St Petersburg / Gulf of Finland', ['st petersburg','saint petersburg','petersburg','gulf of finland','leningrad oblast']],
    ['Narva / Ivangorod / Estonia NE border', ['narva','ivangorod','ida-viru','north-east estonia']],
    ['Pskov / Luga approach', ['pskov','pihkva','luga']],
    ['Latvia eastern border / Daugavpils axis', ['daugavpils','latvia eastern','eastern latvia']],
    ['Suwałki / Grodno / Brest corridor', ['suwalki','suwałki','grodno','brest']],
    ['Kaliningrad / Baltiysk / Chernyakhovsk', ['kaliningrad','baltiysk','chernyakhovsk']],
    ['Baltic Sea / Gulf of Riga / maritime axis', ['baltic sea','gulf of riga','liivi laht','maritime axis']],
    ['Belarus staging / Minsk-Baranovichi-Brest', ['belarus','minsk','baranovichi','grodno','brest']],
    ['Baltic capitals / cyber-information nodes', ['tallinn','riga','vilnius','baltic capitals','baltic states','estonia','latvia','lithuania']],
    ['Baltic axis', ['baltic axis','baltic region','baltics']],
    ['Moscow / Russia', ['moscow','russia','russian']]
  ];
  for (const [label, words] of aliases) if (words.some((word) => text.includes(word))) places.push(label);
  for (const n of nais) {
    if (text.includes(normalizeText(n.name))) places.push(n.name);
  }
  for (const c of mapCountries) {
    if (text.includes(normalizeText(c.capital)) || (c.country !== 'Russia' && text.includes(normalizeText(c.country)))) places.push(`${c.country} / ${c.capital}`);
  }
  return uniq(places).slice(0, 8);
}

function extractModel(signal) {
  const text = normalizeText([signal.title, signal.summary, signal.sourceName, signal.sourceId, ...(signal.tags || [])].join(' '));
  return {
    event: findMatches(text, ontologyLexicon.event),
    time: findMatches(text, ontologyLexicon.time),
    place: extractPlaces(text),
    people: findMatches(text, ontologyLexicon.people),
    organizations: findMatches(text, ontologyLexicon.organizations),
    objects: findMatches(text, ontologyLexicon.objects)
  };
}

function sourceBaseReliability(signal) {
  const source = normalizeText(`${signal.sourceId || ''} ${signal.sourceName || ''}`);
  if (/nato|shape|vla|official|vm|ministry|government/.test(source)) return 5;
  if (/isw|acled|cisa|ooni|gdelt/.test(source)) return 4;
  if (/postimees|delfi|rss|media/.test(source)) return 3;
  return 2;
}

function reliabilityScore(signal, model) {
  const dimensions = Object.values(model || {}).reduce((sum, arr) => sum + (arr && arr.length ? 1 : 0), 0);
  const titleSummary = normalizeText(`${signal.title || ''} ${signal.summary || ''}`);
  const evidenceDensity = titleSummary.length > 220 ? 1 : titleSummary.length > 80 ? 0.5 : 0;
  const score = Math.round((sourceBaseReliability(signal) + Math.min(5, dimensions) + evidenceDensity) / 2);
  return clamp(score, 1, 5);
}

function matchIndicators(model, signal) {
  const text = normalizeText([signal.title, signal.summary, signal.sourceName, signal.sourceId, ...(signal.tags || [])].join(' '));
  const matches = [];
  for (const indicator of indicators) {
    const hits = (indicator.keywords || []).filter((word) => text.includes(normalizeText(word))).length;
    let ontologyBonus = 0;
    if ((model.place || []).length && (indicator.id.includes('1') || indicator.id.includes('5') || indicator.id.includes('6'))) ontologyBonus += 1;
    if ((model.objects || []).length && ['PIR-1','PIR-2','PIR-5'].includes(indicator.pir)) ontologyBonus += 1;
    if ((model.event || []).length) ontologyBonus += 1;
    const score = hits + ontologyBonus;
    if (score >= 2 || hits >= 1) matches.push({ id: indicator.id, score });
  }
  return matches.sort((a,b) => b.score - a.score).slice(0, 6);
}

function matchPirsFromIndicatorIds(indicatorIds) {
  return uniq(indicatorIds.map((id) => indicators.find((i) => i.id === id)?.pir));
}
function matchSirsFromIndicatorIds(indicatorIds) {
  return collectionSirs.filter((sir) => indicatorIds.includes(sir.indicator)).map((sir) => sir.id);
}
function matchCcirsFromPirIds(pirIds) {
  return uniq(pirIds.map((id) => pirs.find((p) => p.id === id)?.ccir));
}
function matchPirsFromModel(model, signal = {}) {
  return matchPirsFromIndicatorIds(matchIndicators(model, signal).map((m) => m.id));
}
function matchSirsFromPirIds(pirIds) {
  return collectionSirs.filter((sir) => pirIds.includes(sir.pir)).map((sir) => sir.id);
}

function annotateSignal(signal) {
  const model = signal.model || extractModel(signal);
  const indicatorMatchesDetailed = matchIndicators(model, signal);
  const indicatorMatches = indicatorMatchesDetailed.map((m) => m.id);
  const pirMatches = matchPirsFromIndicatorIds(indicatorMatches);
  const sirMatches = matchSirsFromIndicatorIds(indicatorMatches);
  const ccirMatches = matchCcirsFromPirIds(pirMatches);
  const confidenceScore = signal.confidenceScore || reliabilityScore(signal, model);
  const primaryPlace = model.place && model.place.length ? model.place[0] : null;
  const location = resolveLocation(primaryPlace || signal.locationName);
  return {
    ...signal,
    model,
    ontology: model,
    confidenceScore,
    reliability: confidenceScore,
    indicatorMatches,
    indicatorMatchesDetailed,
    pirMatches,
    matchedPIRs: pirMatches,
    sirMatches,
    matchedSIRs: sirMatches,
    ccirMatches,
    matchedCCIRs: ccirMatches,
    location,
    engineScore: indicatorMatches.length + pirMatches.length + ccirMatches.length + Math.max(0, confidenceScore - 2)
  };
}

function resolveLocation(name) {
  const raw = normalizeText(name);
  if (!raw) return null;
  const nai = nais.find((n) => raw.includes(normalizeText(n.name)));
  if (nai) return { name: nai.name, lat: nai.lat, lon: nai.lon, type:'NAI', id:nai.id };
  const country = mapCountries.find((c) => raw.includes(normalizeText(c.country)) || raw.includes(normalizeText(c.capital)));
  if (country) return { name: `${country.country} / ${country.capital}`, lat: country.lat, lon: country.lon, type:'country-capital', id:country.country };
  if (/kola|murmansk|northern fleet/.test(raw)) return { name:'Kola / Murmansk / Northern Fleet', lat:68.97, lon:33.08, type:'NAI', id:'NAI-01' };
  if (/st petersburg|saint petersburg|gulf of finland/.test(raw)) return { name:'St Petersburg / Gulf of Finland', lat:59.93, lon:30.36, type:'NAI', id:'NAI-02' };
  if (/narva|ivangorod/.test(raw)) return { name:'Narva / Ivangorod / Estonia NE border', lat:59.38, lon:28.20, type:'NAI', id:'NAI-03' };
  if (/pskov|pihkva|luga/.test(raw)) return { name:'Pskov / Luga approach', lat:57.82, lon:28.33, type:'NAI', id:'NAI-04' };
  if (/daugavpils/.test(raw)) return { name:'Latvia eastern border / Daugavpils axis', lat:55.87, lon:26.54, type:'NAI', id:'NAI-05' };
  if (/suwalki|suwałki|grodno|brest/.test(raw)) return { name:'Suwałki / Grodno / Brest corridor', lat:54.10, lon:22.93, type:'NAI', id:'NAI-06' };
  if (/kaliningrad|baltiysk|chernyakhovsk/.test(raw)) return { name:'Kaliningrad / Baltiysk / Chernyakhovsk', lat:54.71, lon:20.45, type:'NAI', id:'NAI-07' };
  if (/baltic sea|gulf of riga|maritime/.test(raw)) return { name:'Baltic Sea / Gulf of Riga / maritime axis', lat:57.20, lon:21.70, type:'NAI', id:'NAI-08' };
  if (/belarus|minsk|baranovichi/.test(raw)) return { name:'Belarus staging / Minsk-Baranovichi-Brest', lat:53.90, lon:27.56, type:'NAI', id:'NAI-09' };
  if (/tallinn|riga|vilnius|baltic capitals/.test(raw)) return { name:'Baltic capitals / cyber-information nodes', lat:56.95, lon:24.11, type:'NAI', id:'NAI-10' };
  if (/baltic/.test(raw)) return { name:'Baltic region', lat:57.0, lon:24.5, type:'region', id:'baltic' };
  if (/russia|moscow/.test(raw)) return { name:'Russia / Moscow', lat:55.76, lon:37.62, type:'country-capital', id:'russia' };
  return null;
}

function deriveStatus(count, avgReliability) {
  if (!count) return 'unanswered';
  if (count >= 3 && avgReliability >= 4) return 'answered';
  if (count >= 2 || avgReliability >= 3) return 'partial';
  return 'partial';
}
function average(nums) { return nums.length ? Math.round((nums.reduce((a,b)=>a+b,0) / nums.length) * 10) / 10 : 1; }

function buildIndicatorAssessments(signals) {
  const annotated = signals.map(annotateSignal);
  return indicators.map((indicator) => {
    const evidence = annotated.filter((sig) => (sig.indicatorMatches || []).includes(indicator.id));
    const avgReliability = average(evidence.map((sig) => sig.confidenceScore || 1));
    return { ...indicator, evidenceIds: evidence.map((e) => e.id), evidenceCount: evidence.length, confidenceScore: clamp(Math.round(avgReliability), 1, 5), status: deriveStatus(evidence.length, avgReliability) };
  });
}

function buildPirAssessments(indicatorAssessments) {
  return pirs.map((pir) => {
    const inds = indicatorAssessments.filter((i) => i.pir === pir.id);
    const evidenceCount = inds.reduce((sum, i) => sum + i.evidenceCount, 0);
    const avgReliability = average(inds.flatMap((i) => Array(i.evidenceCount || 0).fill(i.confidenceScore || 1)));
    const status = inds.some((i) => i.status === 'answered') ? 'answered' : inds.some((i) => i.status === 'partial') ? 'partial' : 'unanswered';
    return { ...pir, status, evidenceCount, confidenceScore: clamp(Math.round(avgReliability), 1, 5), assessment: status === 'unanswered' ? 'No observed indicator evidence yet.' : status === 'partial' ? 'Some indicator evidence is present, but the PIR is not fully answered.' : 'Indicator evidence is sufficient to answer the PIR.' };
  });
}

function buildCollectionSirAssessments(indicatorAssessments) {
  return collectionSirs.map((sir) => {
    const ind = indicatorAssessments.find((i) => i.id === sir.indicator);
    return { ...sir, status: ind?.status || 'unanswered', confidenceScore: ind?.confidenceScore || 1, evidenceCount: ind?.evidenceCount || 0, evidenceIds: ind?.evidenceIds || [] };
  });
}

function buildCcirAssessments(pirAssessments) {
  return ccirs.map((ccir) => {
    const ccirPirs = pirAssessments.filter((p) => p.ccir === ccir.id);
    const evidenceCount = ccirPirs.reduce((sum, p) => sum + p.evidenceCount, 0);
    const avgReliability = average(ccirPirs.flatMap((p) => Array(p.evidenceCount || 0).fill(p.confidenceScore || 1)));
    const status = ccirPirs.some((p) => p.status === 'answered') ? 'partial' : ccirPirs.some((p) => p.status === 'partial') ? 'partial' : 'not assessed';
    const pirCoverage = ccirPirs.map((p) => ({ id:p.id, title:p.title, status:p.status, confidenceScore:p.confidenceScore, evidenceCount:p.evidenceCount }));
    return { ...ccir, status, evidenceCount, confidenceScore: clamp(Math.round(avgReliability), 1, 5), pirCoverage };
  });
}

function deriveFlags(signals) {
  const annotated = signals.map(annotateSignal);
  const active = new Set();
  const hasPir = (id) => annotated.some((sig) => (sig.pirMatches || []).includes(id));
  const hasEvent = (event) => annotated.some((sig) => (sig.model?.event || []).includes(event));
  if (hasPir('PIR-1')) active.add('RF-1');
  if (hasPir('PIR-2')) active.add('RF-2');
  if (hasPir('PIR-4')) active.add('RF-3');
  if (hasPir('PIR-5')) active.add('RF-4');
  if (hasPir('PIR-6')) active.add('RF-5');
  if (hasPir('PIR-3')) active.add('RF-6');
  if (hasEvent('hybrid_incident')) active.add('RF-7');
  if (annotated.some((sig) => (sig.model?.objects || []).includes('uav_drone'))) active.add('RF-8');
  return Array.from(active);
}

function labelFromScore(score) {
  if (score >= 70) return 'RED';
  if (score >= 45) return 'ORANGE';
  if (score >= 20) return 'YELLOW';
  return 'GREEN';
}

function buildAssessment(signals) {
  const annotated = signals.map(annotateSignal);
  const activeFlagIds = deriveFlags(annotated);
  const indicatorAssessments = buildIndicatorAssessments(annotated);
  const pirAssessments = buildPirAssessments(indicatorAssessments);
  const collectionSirAssessments = buildCollectionSirAssessments(indicatorAssessments);
  const ccirAssessments = buildCcirAssessments(pirAssessments);
  const ffirAssessments = ffirs.map((f) => ({ ...f, confidenceScore: 1, evidenceCount: 0 }));
  const score = Math.min(activeFlagIds.reduce((sum, id) => sum + (redFlags.find((f) => f.id === id)?.weight || 0), 0), 100);
  const label = labelFromScore(score);
  const confidenceScore = clamp(Math.round(average(annotated.map((sig) => sig.confidenceScore || 1))), 1, 5);
  let summary = 'Baseline: no active red flags are currently derived from collected signals.';
  let summaryEt = 'Baasjoon: kogutud signaalidest ei tuletata praegu aktiivseid punaseid lippe.';
  if (label === 'YELLOW') { summary = 'Early warning: individual indicators are visible and require closer monitoring.'; summaryEt = 'Varajane hoiatus: üksikud näitajad on nähtavad ja vajavad lähemat jälgimist.'; }
  if (label === 'ORANGE') { summary = 'Elevated risk: multiple warning strands are overlapping across the ontology model.'; summaryEt = 'Tõusnud risk: mitu hoiatusmustrit kattuvad ontoloogiamudelis.'; }
  if (label === 'RED') { summary = 'High risk: force, logistics, narrative and regional enabling indicators overlap in a concentrated way.'; summaryEt = 'Kõrge risk: jõu-, logistika-, narratiivi- ja regionaalse võimaldamise näitajad kattuvad koondunult.'; }
  return {
    score, label, confidenceScore, summary, summaryEt, updatedAt: new Date().toISOString(), activeFlagIds,
    rationale: activeFlagIds.length ? activeFlagIds.map((id) => redFlags.find((f) => f.id === id)?.name || id) : ['No active red flags derived from current signals.'],
    rationaleEt: activeFlagIds.length ? activeFlagIds.map((id) => redFlags.find((f) => f.id === id)?.nameEt || id) : ['Kogutud signaalidest ei tuletata praegu aktiivseid punaseid lippe.'],
    ccirAssessments, pirAssessments, indicatorAssessments, collectionSirAssessments, ffirAssessments
  };
}

module.exports = { translateText, extractModel, matchIndicators, matchPirsFromModel, matchPirsFromIndicatorIds, matchSirsFromPirIds, matchCcirsFromPirIds, annotateSignal, deriveFlags, buildAssessment, reliabilityScore, resolveLocation };
