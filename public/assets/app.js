const LS_LAYOUT = 'bwd40_layout';
const LS_CRAWLERS = 'bwd40_local_crawlers';
const LS_SECRET = 'bwd_admin_secret';
let lang = localStorage.getItem('bwd_lang') || 'en';
let data = { ccirs:[], pirs:[], indicators:[], collectionSirs:[], ffirs:[], nais:[], mapCountries:[], seriousIncidentReports:[], sources:[], signals:[], redFlags:[], assessment:null, crawlers:[], systemTests:null };
let mapZoom = 1;
let mapCenter = { x: 500, y: 270 };

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (o, f) => lang === 'et' && o?.[`${f}Et`] ? o[`${f}Et`] : o?.[f];
const statusLabel = (s) => String(s || 'not assessed').replace(/-/g,' ');
const statusClass = (s) => `status-${String(s || 'not assessed').replace(/ /g,'-')}`;
function helpButton(key){ return `<button class="help" data-help="${esc(key)}">?</button>`; }

const termHelp = {
  app: ['Dashboard logic', 'This dashboard is built as a decision-support system: CCIR answers a commander decision need; PIR answers the intelligence side of the CCIR; Indicator defines what phenomenon confirms/denies a course of action; Collection SIR defines exactly what to collect, where, when and by whom.'],
  decisionBoard: ['Decision Board', 'Shows CCIRs as decision cards. A CCIR should support a decision point, not merely list interesting questions. Each card shows supported decision, PIR coverage, FFIR context, confidence and recommendation.'],
  collectionWorkshop: ['Collection Workshop', 'Shows the staff collection chain: PIR → Indicator → Collection SIR → NAI → LTIOV → Collector → Reporting criteria → Evidence. This is the working view for analysts and collection managers.'],
  mapLayer: ['Map Layer', 'Base operational map covering EU states, nearby countries and Russia. It shows approximate country/capital points, NAI areas and latest signal locations when the incoming feed contains a place. Clicking an event opens the source feed/article.'],
  timeline: ['Timeline / LTIOV', 'Shows collection time windows and LTIOV. LTIOV means Latest Time Information Is Of Value: the last moment when the information still supports the decision.'],
  signals: ['Signals / Evidence', 'Signals are incoming items from crawlers/RSS/manual feeds. The ontology engine extracts event, time, place, people, organizations and objects, then matches them to indicators, PIRs and CCIRs.'],
  sources: ['Sources', 'Source assets are public or custom feeds used by the crawler layer. Sources feed signals; signals feed the ontology model; ontology matches support PIR and CCIR assessment.'],
  seriousReports: ['Serious Incident Reports', 'Separate from Collection SIRs. These are event-based wake-up or reporting criteria such as casualties, civilian harm, facility attack, MIA or major outage. They may require command-chain notification, but they are not PIR sub-requirements.'],
  crawlers: ['Crawlers / RSS assets', 'Crawler assets are RSS feeds or source fetchers. Custom crawler names and URLs are shown locally immediately; persistent server-side hourly cron for custom feeds requires Vercel KV/Redis environment variables.'],
  systemTests: ['System test / operational readiness', 'Runs API, assessment, crawler registry, storage, remote fetch, CCIR/PIR/Indicator/Collection SIR link, NAI coverage and source probe checks. The status is operational when critical tests pass, degraded when warnings remain, and offline when critical tests fail.'],
  ccir: ['CCIR', 'Commander Critical Information Requirement: critical information linked to a commander decision point. A good CCIR ends in a decision or recommended action.'],
  pir: ['PIR', 'Priority Intelligence Requirement: the intelligence side of a CCIR. A PIR asks what must be known about the enemy or operating environment. A PIR should end in an assessment.'],
  ffir: ['FFIR', 'Friendly Force Information Requirement: what must be known about friendly force status/capacity before the commander can decide.'],
  indicator: ['Indicator', 'A detectable phenomenon that confirms or denies an enemy course of action. Indicators sit between PIRs and Collection SIRs.'],
  collectionSir: ['Collection SIR', 'Specific Information Requirement in collection logic. It is a concrete collectible/observable fact. It is not a Serious Incident Report.'],
  nai: ['NAI', 'Named Area of Interest: a geographic area where observation helps answer a PIR or Collection SIR.'],
  ltiov: ['LTIOV', 'Latest Time Information Is Of Value: the deadline after which collected information no longer supports the decision in time.'],
  collector: ['Collector', 'The source, sensor, feed, team or asset responsible for collecting the Collection SIR.'],
  confidence: ['Confidence 1–5', 'Reliability/confidence score: 1 = low confidence, 5 = high confidence. The score combines source type, ontology richness and evidence density.'],
  ontology: ['Ontology Engine', 'Extracts six categories from each signal: Event, Time, Place, People, Organizations and Objects. These categories are matched to indicators and then to PIRs/CCIRs.']
};
const termHelpEt = {
  ccir: ['CCIR', 'Ülema kriitiline infovajadus: otsustuspunktiga seotud info. Hea CCIR lõppeb otsuse või soovitatud tegevusega.'],
  pir: ['PIR', 'Prioriteetne luurevajadus: CCIR-i luurepoolne osa. PIR küsib, mida peab teadma vastase või tegevuskeskkonna kohta.'],
  ffir: ['FFIR', 'Oma jõudude infovajadus: mida peab teadma oma võimekuse/valmiduse kohta enne otsust.'],
  indicator: ['Indicator', 'Tuvastatav nähtus, mis kinnitab või lükkab ümber vastase tegevusvariandi.'],
  collectionSir: ['Collection SIR', 'Konkreetne kogutav/vaadeldav infokild. See ei tähenda siin Serious Incident Reporti.'],
  nai: ['NAI', 'Named Area of Interest: ala, kus vaatlus aitab PIR-ile või Collection SIR-ile vastata.'],
  ltiov: ['LTIOV', 'Viimane aeg, mil info on otsuse jaoks veel väärtuslik.'],
  collector: ['Collector', 'Allikas, sensor, feed, meeskond või vahend, mis kogub Collection SIR-i.'],
  confidence: ['Usaldusväärsus 1–5', '1 = madal, 5 = kõrge. Skoor seob allikatüübi, ontoloogilise rikkuse ja tõenditiheduse.'],
  systemTests: ['Süsteemi test / operatiivsus', 'Kontrollib API, hinnangu, crawlerite, salvestuse, remote fetchi, CCIR/PIR/Indicator/Collection SIR seoste, NAI katvuse ja allikaproovide seisu.']
};
function openHelp(key){ const h = (lang === 'et' && termHelpEt[key]) || termHelp[key] || ['Help','No description available.']; $('helpTitle').textContent = h[0]; $('helpText').textContent = h[1]; $('helpOverlay').classList.remove('hidden'); }
function wireHelp(){ document.querySelectorAll('.help[data-help]').forEach((b)=>{ if(b.dataset.wired) return; b.dataset.wired='1'; b.addEventListener('click',(e)=>{ e.stopPropagation(); openHelp(b.dataset.help); }); }); }

function confidenceDots(score){ const n = Math.max(1, Math.min(5, Math.round(score || 1))); return `<span class="confidence" title="Confidence ${n}/5">${Array.from({length:5},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span> <span class="small">${n}/5</span>`; }
function formatTime(v){ if(!v) return '—'; try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Tallinn',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));}catch{return String(v);} }
function apiHeaders(extra={}){ const h={Accept:'application/json',...extra}; const s=localStorage.getItem(LS_SECRET); if(s) h['x-admin-secret']=s; return h; }
async function getJson(url, options={}){ const r=await fetch(url,{...options,headers:apiHeaders(options.headers)}); if(!r.ok) throw new Error(await r.text() || String(r.status)); return r.json(); }
async function postJson(url, body){ return getJson(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }

function getLocalCrawlers(){ try{return JSON.parse(localStorage.getItem(LS_CRAWLERS)||'[]');}catch{return [];} }
function saveLocalCrawlers(items){ localStorage.setItem(LS_CRAWLERS, JSON.stringify(items)); }
function mergeCrawlers(serverItems){ const local=getLocalCrawlers(); const byUrl=new Map(); [...local,...(serverItems||[])].forEach((c)=>byUrl.set(String(c.url||c.id),c)); return Array.from(byUrl.values()).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))); }

async function loadAll(){
  const [ccirs,pirs,indicators,collectionSirs,ffirs,nais,mapCountries,seriousIncidentReports,sources,signals,redFlags,assessment,crawlers] = await Promise.all([
    getJson('/api/ccir'), getJson('/api/pirs'), getJson('/api/indicators'), getJson('/api/collection-sirs'), getJson('/api/ffirs'), getJson('/api/nais'), getJson('/api/map-countries'), getJson('/api/serious-incident-reports'), getJson('/api/sources'), getJson('/api/signals'), getJson('/api/red-flags'), getJson('/api/assessments/latest'), getJson('/api/custom-crawlers').catch(()=>({items:[]}))
  ]);
  data = { ccirs,pirs,indicators,collectionSirs,ffirs,nais,mapCountries,seriousIncidentReports,sources,signals,redFlags,assessment,crawlers:mergeCrawlers(crawlers.items||[]),systemTests:data.systemTests };
  renderAll();
  loadSystemTests(false);
}
async function loadSystemTests(showAlert=true){
  const btn=$('testSystemsBtn'); if(btn){btn.disabled=true; btn.textContent='Testing...';}
  try{ data.systemTests=await getJson('/api/test-systems'); renderSystemKpi(); renderSystemPanel(); wireHelp(); }
  catch(e){ data.systemTests={ok:false,operationalStatus:'offline',readinessScore:0,completedAt:new Date().toISOString(),totals:{total:1,connected:0,failed:1,criticalFailed:1,warningFailed:0},blockers:['System test API unreachable'],warnings:[],tests:[{id:'system-test-api',name:'System test API',category:'core',severity:'critical',connected:false,detail:e.message,lastUpdated:new Date().toISOString()}]}; renderSystemKpi(); renderSystemPanel(); if(showAlert) alert('System test failed: '+e.message); }
  finally{ if(btn){btn.disabled=false; btn.textContent='Test systems';} }
}


function systemStatusInfo(){
  const st=data.systemTests;
  if(!st) return {label:'testing',cls:'op-testing',sub:'System tests are loading',score:'--',summary:'Waiting for operational readiness test results.'};
  const status=st.operationalStatus || (st.ok?'operational':'offline');
  const cls=status==='operational'?'op-operational':status==='degraded'?'op-degraded':'op-offline';
  const score=Number.isFinite(st.readinessScore)?st.readinessScore:'--';
  const failed=st.totals?.failed ?? 0;
  const total=st.totals?.total ?? 0;
  const sub=`Readiness ${score}% · failed ${failed}/${total}`;
  const summary=status==='operational'?'Critical checks pass. System is operational.':status==='degraded'?'Critical checks pass, but warnings remain.':'One or more critical checks failed. System is not operational.';
  return {label:status,cls,sub,score,summary};
}
function renderSystemKpi(){
  const el=$('systemKpi'); if(!el) return;
  const x=systemStatusInfo();
  el.innerHTML=`<div class="kpi-title">System status ${helpButton('systemTests')}</div><div class="operational-value ${x.cls}">${esc(x.label)}</div><div class="kpi-sub">${esc(x.sub)}<br>${esc(x.summary)}</div>`;
}

function renderKpis(){
  const a=data.assessment||{}; const label=a.label||'GREEN'; const riskClass=label==='RED'?'risk-red':label==='ORANGE'?'risk-orange':label==='YELLOW'?'risk-yellow':'risk-green';
  const ccirPartial=(a.ccirAssessments||[]).filter(x=>x.status==='partial'||x.status==='answered').length;
  const pirUnanswered=(a.pirAssessments||[]).filter(x=>x.status==='unanswered').length;
  const nextLtiov=(data.collectionSirs||[])[0]?.ltiov||'—';
  $('threatKpi').innerHTML=`<div class="kpi-title">Threat Level ${helpButton('confidence')}</div><div class="kpi-value ${riskClass}">${esc(label)}</div><div class="kpi-sub">Score ${a.score||0}/100 · confidence ${confidenceDots(a.confidenceScore||1)}</div>`;
  $('ccirKpi').innerHTML=`<div class="kpi-title">CCIR status ${helpButton('ccir')}</div><div class="kpi-value">${ccirPartial}/${data.ccirs.length}</div><div class="kpi-sub">CCIRs partial or active</div>`;
  $('pirKpi').innerHTML=`<div class="kpi-title">PIR coverage ${helpButton('pir')}</div><div class="kpi-value">${data.pirs.length-pirUnanswered}/${data.pirs.length}</div><div class="kpi-sub">Answered or partially answered PIRs</div>`;
  $('ltiovKpi').innerHTML=`<div class="kpi-title">Next LTIOV ${helpButton('ltiov')}</div><div class="kpi-value" style="font-size:28px">${esc(nextLtiov)}</div><div class="kpi-sub">Latest time information is of value</div>`;
  $('assessmentKpi').innerHTML=`<div class="kpi-title">Assessment ${helpButton('confidence')}</div><p style="margin:10px 0 4px;font-weight:750">${esc(pick(a,'summary')||'')}</p><div class="kpi-sub">Updated ${formatTime(a.updatedAt)} · active red flags ${(a.activeFlagIds||[]).length}</div>`;
  renderSystemKpi();
  $('ontologyKpi').innerHTML=`<div class="kpi-title">Ontology Engine ${helpButton('ontology')}</div><div class="ontology-list"><div class="ontology-chip"><strong>Event</strong><br>What happened?</div><div class="ontology-chip"><strong>Time</strong><br>When?</div><div class="ontology-chip"><strong>Place</strong><br>Where?</div><div class="ontology-chip"><strong>People</strong><br>Who?</div><div class="ontology-chip"><strong>Organizations</strong><br>Which orgs?</div><div class="ontology-chip"><strong>Objects</strong><br>Assets/systems?</div></div>`;
}

function getFfir(ccirId){ return data.ffirs.find(f=>f.ccir===ccirId); }
function getCcirAssessment(id){ return (data.assessment?.ccirAssessments||[]).find(x=>x.id===id) || data.ccirs.find(x=>x.id===id) || {}; }
function getPirAssessment(id){ return (data.assessment?.pirAssessments||[]).find(x=>x.id===id) || data.pirs.find(x=>x.id===id) || {}; }
function renderDecisionBoard(){
  $('decisionBoardContent').innerHTML = data.ccirs.map((ccir)=>{
    const ca=getCcirAssessment(ccir.id); const ffir=getFfir(ccir.id); const pirs=data.pirs.filter(p=>p.ccir===ccir.id).map(p=>getPirAssessment(p.id));
    return `<section class="decision-card"><div class="decision-card-head"><div><div class="decision-title">${esc(ccir.id)} · ${esc(pick(ccir,'title'))}</div><div class="muted small">${esc(ccir.decisionPoint)} · ${esc(ccir.owner)}</div></div><div><span class="status-pill ${statusClass(ca.status)}">${esc(statusLabel(ca.status))}</span><br>${confidenceDots(ca.confidenceScore||1)}</div></div>
    <div class="field-grid"><strong>Supported decision ${helpButton('ccir')}</strong><span>${esc(pick(ccir,'supportedDecision'))}</span><strong>If / And / Then</strong><span><b>If</b> ${esc(ccir.ifAndThen?.if)} · <b>And</b> ${esc(ccir.ifAndThen?.and)} · <b>Then</b> ${esc(ccir.ifAndThen?.then)}</span><strong>FFIR ${helpButton('ffir')}</strong><span>${esc(ffir?.id||'')} · ${esc(ffir?.question||'')} · <span class="status-pill ${statusClass(ffir?.status)}">${esc(statusLabel(ffir?.status))}</span></span></div>
    <div class="pir-grid">${pirs.map(p=>`<div class="pir-mini"><strong>${esc(p.id)} ${helpButton('pir')}</strong><span class="status-pill ${statusClass(p.status)}">${esc(statusLabel(p.status))}</span> ${confidenceDots(p.confidenceScore||1)}<div class="muted small">Evidence ${p.evidenceCount||0} · LTIOV ${esc(p.ltiov||'—')}</div></div>`).join('')}</div>
    <div class="recommendation"><b>Recommendation:</b> ${esc(pick(ccir,'recommendation'))}</div></section>`;
  }).join('');
}

function renderCollectionWorkshop(){
  const rows = data.collectionSirs.map((sir)=>{
    const pir=getPirAssessment(sir.pir); const ind=(data.assessment?.indicatorAssessments||[]).find(i=>i.id===sir.indicator) || data.indicators.find(i=>i.id===sir.indicator) || {}; const cs=(data.assessment?.collectionSirAssessments||[]).find(s=>s.id===sir.id)||sir;
    return `<tr><td><b>${esc(pir.id)}</b><br>${esc(pir.title||'')}</td><td><b>${esc(ind.id)}</b><br>${esc(pick(ind,'description')||'')}<br><span class="muted">Confirms: ${esc(ind.confirms||'')}</span></td><td><b>${esc(sir.id)}</b> ${helpButton('collectionSir')}<br>${esc(pick(sir,'requirement')||sir.requirement)}</td><td>${esc(sir.nai)} ${helpButton('nai')}</td><td>${esc(sir.timeWindow)}<br>LTIOV ${helpButton('ltiov')}: <b>${esc(sir.ltiov)}</b></td><td>${esc(sir.collector)} ${helpButton('collector')}</td><td>${esc(sir.reportingCriteria)}</td><td><span class="status-pill ${statusClass(cs.status)}">${esc(statusLabel(cs.status))}</span><br>${confidenceDots(cs.confidenceScore||1)}<br><span class="muted">Evidence ${cs.evidenceCount||0}</span></td></tr>`;
  }).join('');
  $('collectionWorkshopContent').innerHTML=`<div class="scroll-x"><table class="collection-table"><thead><tr><th>PIR ${helpButton('pir')}</th><th>Indicator ${helpButton('indicator')}</th><th>Collection SIR ${helpButton('collectionSir')}</th><th>NAI ${helpButton('nai')}</th><th>Time / LTIOV ${helpButton('ltiov')}</th><th>Collector ${helpButton('collector')}</th><th>Reporting criteria</th><th>Status / confidence ${helpButton('confidence')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderTimeline(){
  const max=24;
  $('timelineContent').innerHTML=data.collectionSirs.map((sir,idx)=>{ const hrs=parseInt(String(sir.ltiov).match(/\d+/)?.[0]||'12',10); const width=Math.min(95,Math.max(18,(hrs/max)*100)); const left=Math.min(82,idx*7%45); return `<div class="timeline-row"><div><b>${esc(sir.id)}</b><br><span class="muted">${esc(sir.nai)} · ${esc(sir.collector)}</span></div><div class="timeline-bar"><div class="timeline-fill" style="left:${left}%;width:${width}%"></div><div class="timeline-ltiov" style="left:${Math.min(96,left+width)}%"></div></div></div>`; }).join('');
}

const mapBounds={lonMin:-12,lonMax:65,latMin:34,latMax:72};
function project(lon,lat){ const x=(lon-mapBounds.lonMin)/(mapBounds.lonMax-mapBounds.lonMin)*1000; const y=(mapBounds.latMax-lat)/(mapBounds.latMax-mapBounds.latMin)*540; return {x,y}; }
function updateMapViewBox(svg){ const w=1000/mapZoom,h=540/mapZoom; svg.setAttribute('viewBox',`${mapCenter.x-w/2} ${mapCenter.y-h/2} ${w} ${h}`); }
function renderMap(){
  const svg=$('opsMap'); if(!svg) return; svg.innerHTML=''; updateMapViewBox(svg);
  const ns='http://www.w3.org/2000/svg';
  function add(tag,attrs,text){ const el=document.createElementNS(ns,tag); Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,v)); if(text) el.textContent=text; svg.appendChild(el); return el; }
  for(let lon=-10;lon<=65;lon+=10){ const a=project(lon,34),b=project(lon,72); add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#182840','stroke-width':'1'}); }
  for(let lat=35;lat<=70;lat+=5){ const a=project(-12,lat),b=project(65,lat); add('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#182840','stroke-width':'1'}); }
  data.mapCountries.forEach(c=>{ const p=project(c.lon,c.lat); add('circle',{cx:p.x,cy:p.y,r:7,class:'country-point'}); add('circle',{cx:p.x,cy:p.y,r:2.7,class:'capital-point'}); add('text',{x:p.x+7,y:p.y-3,class:'country-label'},c.country); add('text',{x:p.x+7,y:p.y+9,class:'capital-label'},c.capital); });
  data.nais.forEach(n=>{ const p=project(n.lon,n.lat); add('circle',{cx:p.x,cy:p.y,r:Math.max(18,Math.min(58,n.radiusKm/8)),class:'nai-circle'}); add('text',{x:p.x+10,y:p.y-10,class:'nai-label'},n.id); add('text',{x:p.x+10,y:p.y+5,class:'capital-label'},n.name); });
  const events=data.signals.filter(s=>s.location).slice(0,12);
  events.forEach((s,i)=>{ const p=project(s.location.lon,s.location.lat); const m=add('circle',{cx:p.x,cy:p.y,r:7,class:'event-marker'}); m.addEventListener('click',()=>{ if(s.url) window.open(s.url,'_blank','noopener'); }); add('text',{x:p.x+9,y:p.y+4,class:'capital-label'},`${i+1}`); });
  $('mapHint').textContent = events.length ? `${events.length} event locations detected` : 'Plain base layer loaded: EU, nearby states and Russia with approximate capitals.';
  $('mapEventList').innerHTML = events.length ? events.map((s,i)=>`<div class="map-event" data-url="${esc(s.url||'')}"><b>${i+1}. ${esc(s.location.name)}</b><br>${esc(s.title||'Untitled')}</div>`).join('') : `<div class="map-event"><b>Base layer active.</b><br>No incoming event location has been detected yet.</div>`;
  document.querySelectorAll('.map-event[data-url]').forEach(el=>el.addEventListener('click',()=>{ const u=el.dataset.url; if(u) window.open(u,'_blank','noopener'); }));
}

function renderSignals(){
  const rows=data.signals.slice(0,30).map(s=>`<tr><td><b>${esc(s.title||s.id)}</b><br><span class="muted">${esc(s.sourceName||s.sourceId||'')}</span></td><td>${esc(s.summary||'').slice(0,220)}</td><td>${Object.entries(s.ontology||s.model||{}).map(([k,v])=>v?.length?`<span class="tag">${esc(k)}: ${esc(v.slice(0,2).join(', '))}</span>`:'').join('')}</td><td>${(s.pirMatches||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')} ${(s.indicatorMatches||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</td><td>${confidenceDots(s.confidenceScore||1)}</td><td>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">Open</a>`:'—'}</td></tr>`).join('');
  $('signalsContent').innerHTML = data.signals.length ? `<div class="scroll-x"><table class="signal-table"><thead><tr><th>Signal</th><th>Summary</th><th>Ontology ${helpButton('ontology')}</th><th>Matches</th><th>Confidence ${helpButton('confidence')}</th><th>Feed</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No signals collected yet.</p>';
}


function renderSystemPanel(){
  const el=$('systemTestsContent'); if(!el) return;
  const st=data.systemTests;
  if(!st){ el.innerHTML='<p class="muted">System tests are loading...</p>'; return; }
  const info=systemStatusInfo();
  const blockers=(st.blockers||[]).length?`<div class="system-summary-card"><span class="muted">Critical blockers</span><b class="op-offline">${esc((st.blockers||[]).length)}</b><span class="small">${esc((st.blockers||[]).join(', '))}</span></div>`:'';
  const warnings=(st.warnings||[]).length?`<div class="system-summary-card"><span class="muted">Warnings</span><b class="op-degraded">${esc((st.warnings||[]).length)}</b><span class="small">${esc((st.warnings||[]).join(', '))}</span></div>`:'';
  const rows=(st.tests||[]).map(t=>{ const cls=t.connected?'test-ok':(t.severity==='critical'?'test-fail':'test-warn'); const verdict=t.connected?'OK':(t.severity==='critical'?'FAIL':'WARN'); return `<tr><td><span class="${cls}">${verdict}</span></td><td><b>${esc(t.name)}</b><br><span class="muted">${esc(t.id)} · ${esc(t.category||'')}</span></td><td>${esc(t.severity||'warning')}</td><td>${esc(t.detail||'')}</td><td>${formatTime(t.lastUpdated)}</td></tr>`; }).join('');
  el.innerHTML=`<div class="system-summary"><div class="system-summary-card"><span class="muted">Operational status</span><b class="${info.cls}">${esc(info.label)}</b><span class="small">${esc(info.summary)}</span></div><div class="system-summary-card"><span class="muted">Readiness score</span><b>${esc(info.score)}%</b><span class="small">Completed ${formatTime(st.completedAt)}</span></div><div class="system-summary-card"><span class="muted">Crawler assets</span><b>${esc(st.registeredCrawlerCount||0)} + ${esc(st.crawlerCount||0)}</b><span class="small">registered + custom</span></div><div class="system-summary-card"><span class="muted">Active sources</span><b>${esc(st.activeSourceCount||0)}</b><span class="small">configured source assets</span></div>${blockers}${warnings}</div><div class="scroll-x"><table class="system-tests-table"><thead><tr><th>Status</th><th>Test</th><th>Severity</th><th>Detail</th><th>Updated</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSeriousReports(){
  const el=$('seriousReportsContent'); if(!el) return;
  el.innerHTML = `<p class="muted">These are Serious Incident Reports, not Collection SIRs under PIRs.</p><div class="scroll-x"><table class="sources-table"><thead><tr><th>ID</th><th>Type</th><th>Trigger</th><th>Action</th></tr></thead><tbody>${data.seriousIncidentReports.map(r=>`<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.type)}</td><td>${esc(r.trigger)}</td><td>${esc(r.action)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderSources(){
  $('sourcesContent').innerHTML=`<div class="scroll-x"><table class="sources-table"><thead><tr><th>Source</th><th>Category</th><th>Cadence</th><th>Why useful</th><th>Link</th></tr></thead><tbody>${data.sources.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.category||'')}</td><td>${esc(s.cadence||'')}</td><td>${esc(s.whyUseful||s.use||'')}</td><td>${s.url?`<a href="${esc(s.url)}" target="_blank">Open</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderCrawlers(){
  $('customCrawlerList').innerHTML = data.crawlers.length ? `<div class="scroll-x"><table class="crawler-table"><thead><tr><th>Name</th><th>URL</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${data.crawlers.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td><a href="${esc(c.url)}" target="_blank">${esc(c.url)}</a></td><td>${esc(c.status||'active')}</td><td>${formatTime(c.createdAt)}</td><td><button class="button small" data-del-crawler="${esc(c.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No custom crawlers yet.</p>';
  document.querySelectorAll('[data-del-crawler]').forEach(b=>b.addEventListener('click',()=>{ const id=b.dataset.delCrawler; const next=data.crawlers.filter(c=>c.id!==id); saveLocalCrawlers(next.filter(c=>String(c.id).startsWith('local_'))); data.crawlers=next; renderCrawlers(); }));
}
function renderAll(){ renderKpis(); renderDecisionBoard(); renderCollectionWorkshop(); renderTimeline(); renderMap(); renderSignals(); renderSources(); renderCrawlers(); renderSystemPanel(); renderSeriousReports(); wireHelp(); }

const defaultLayout={ decisionBoard:{x:10,y:10,w:690,h:430}, collectionWorkshop:{x:710,y:10,w:980,h:430}, mapPanel:{x:10,y:455,w:770,h:590}, timelinePanel:{x:790,y:455,w:500,h:280}, signalsPanel:{x:1300,y:455,w:390,h:590}, sourcesPanel:{x:790,y:745,w:500,h:300}, crawlersPanel:{x:10,y:1060,w:840,h:300}, systemPanel:{x:860,y:1060,w:830,h:300}, seriousReportsPanel:{x:10,y:1375,w:1680,h:260} };
function applyLayout(){ const saved=JSON.parse(localStorage.getItem(LS_LAYOUT)||'{}'); document.querySelectorAll('.tile').forEach(tile=>{ const l={...defaultLayout[tile.id],...(saved[tile.id]||{})}; if(!l) return; Object.assign(tile.style,{left:l.x+'px',top:l.y+'px',width:l.w+'px',height:l.h+'px'}); tile.classList.toggle('collapsed',!!l.collapsed); }); }
function saveLayout(){ const out={}; document.querySelectorAll('.tile').forEach(t=>out[t.id]={x:parseInt(t.style.left)||0,y:parseInt(t.style.top)||0,w:parseInt(t.style.width)||t.offsetWidth,h:parseInt(t.style.height)||t.offsetHeight,collapsed:t.classList.contains('collapsed')}); localStorage.setItem(LS_LAYOUT,JSON.stringify(out)); }
function wireTiles(){
  document.querySelectorAll('.tile').forEach(tile=>{
    const header=tile.querySelector('.tile-header'); const corner=tile.querySelector('.resize-corner'); const collapse=tile.querySelector('.collapse-btn');
    header.addEventListener('mousedown',(e)=>{ if(e.target.closest('button')) return; const sx=e.clientX,sy=e.clientY,ox=parseInt(tile.style.left)||0,oy=parseInt(tile.style.top)||0; const move=(ev)=>{ tile.style.left=Math.max(0,ox+ev.clientX-sx)+'px'; tile.style.top=Math.max(0,oy+ev.clientY-sy)+'px'; }; const up=()=>{ window.removeEventListener('mousemove',move); saveLayout(); }; window.addEventListener('mousemove',move); window.addEventListener('mouseup',up,{once:true}); });
    corner?.addEventListener('mousedown',(e)=>{ e.preventDefault(); const sx=e.clientX,sy=e.clientY,ow=tile.offsetWidth,oh=tile.offsetHeight; const move=(ev)=>{ tile.style.width=Math.max(300,ow+ev.clientX-sx)+'px'; tile.style.height=Math.max(120,oh+ev.clientY-sy)+'px'; if(tile.id==='mapPanel') renderMap(); }; const up=()=>{ window.removeEventListener('mousemove',move); saveLayout(); }; window.addEventListener('mousemove',move); window.addEventListener('mouseup',up,{once:true}); });
    collapse?.addEventListener('click',()=>{ tile.classList.toggle('collapsed'); collapse.textContent=tile.classList.contains('collapsed')?'+':'−'; saveLayout(); });
  });
}
function wireControls(){
  $('refreshBtn').addEventListener('click',loadAll);
  $('resetLayoutBtn').addEventListener('click',()=>{ localStorage.removeItem(LS_LAYOUT); applyLayout(); });
  $('runBtn').addEventListener('click',async()=>{ const b=$('runBtn'); b.disabled=true; b.textContent='Running...'; try{ await getJson('/api/crawlers/run-all',{method:'POST'}); await loadAll(); }catch(e){ alert(e.message); } finally{ b.disabled=false; b.textContent='Run crawlers'; }});
  $('testSystemsBtn').addEventListener('click',()=>loadSystemTests(true));
  $('secretBtn').addEventListener('click',()=>{ const v=prompt('Paste CRON_SECRET / admin secret. It is stored locally in this browser.',localStorage.getItem(LS_SECRET)||''); if(v!==null){ if(v.trim()) localStorage.setItem(LS_SECRET,v.trim()); else localStorage.removeItem(LS_SECRET); }});
  $('addCrawlerBtn').addEventListener('click',async()=>{ const name=$('crawlerName').value.trim(),url=$('crawlerUrl').value.trim(); if(!name||!url) return alert('Enter crawler name and RSS URL.'); const item={id:'local_'+Date.now(),name,url,type:'rss',active:true,status:'active',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastSignalCount:0}; const local=[item,...getLocalCrawlers()]; saveLocalCrawlers(local); data.crawlers=mergeCrawlers(data.crawlers); data.sources=[{id:'custom:'+item.id,name:item.name,category:'Custom RSS',cadence:'Hourly',whyUseful:'User-added RSS source.',url:item.url,active:true},...data.sources]; $('crawlerName').value=''; $('crawlerUrl').value=''; renderCrawlers(); renderSources(); try{ await postJson('/api/custom-crawlers',item); }catch{} });
  $('zoomInBtn').addEventListener('click',()=>{ mapZoom=Math.min(5,mapZoom*1.25); renderMap(); });
  $('zoomOutBtn').addEventListener('click',()=>{ mapZoom=Math.max(1,mapZoom/1.25); renderMap(); });
  $('zoomResetBtn').addEventListener('click',()=>{ mapZoom=1; mapCenter={x:500,y:270}; renderMap(); });
  $('opsMap').addEventListener('mousedown',(e)=>{ const svg=$('opsMap'); const vb=svg.viewBox.baseVal; const sx=e.clientX,sy=e.clientY; const ox=mapCenter.x,oy=mapCenter.y; const move=(ev)=>{ mapCenter.x=ox-(ev.clientX-sx)*(vb.width/svg.clientWidth); mapCenter.y=oy-(ev.clientY-sy)*(vb.height/svg.clientHeight); renderMap(); }; const up=()=>window.removeEventListener('mousemove',move); window.addEventListener('mousemove',move); window.addEventListener('mouseup',up,{once:true}); });
  $('helpClose').addEventListener('click',()=>$('helpOverlay').classList.add('hidden'));
  $('helpOverlay').addEventListener('click',(e)=>{ if(e.target.id==='helpOverlay') $('helpOverlay').classList.add('hidden'); });
  $('langEnBtn').addEventListener('click',()=>{lang='en';localStorage.setItem('bwd_lang',lang);loadAll();});
  $('langEtBtn').addEventListener('click',()=>{lang='et';localStorage.setItem('bwd_lang',lang);loadAll();});
}

applyLayout(); wireTiles(); wireControls(); loadAll().catch((e)=>{ console.error(e); alert('Dashboard load error: '+e.message); });
