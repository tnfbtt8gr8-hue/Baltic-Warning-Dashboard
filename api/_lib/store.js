const fs = require('fs/promises');
const path = require('path');
const { defaultAssessment, sourceAssets } = require('./seed');
const dataDir = path.join(process.cwd(), 'data');
const signalsFile = path.join(dataDir, 'signals.json');
const assessmentFile = path.join(dataDir, 'assessment.json');
const customCrawlersFile = path.join(dataDir, 'custom-crawlers.json');
const settingsFile = path.join(dataDir, 'settings.json');
const SIGNALS_KEY='baltic-warning:signals', ASSESSMENT_KEY='baltic-warning:assessment', CUSTOM_CRAWLERS_KEY='baltic-warning:custom-crawlers', SETTINGS_KEY='baltic-warning:settings';
let memorySignals=[];
let memoryAssessment=defaultAssessment;
let memoryCustomCrawlers=[];
let memorySettings={ preferredHourTallinn: 9, note: 'Free Vercel auto-crawl supports once per day. Hour selection is stored for operator preference.', mode:'daily' };
function hasKvConfigured(){ return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN); }
async function kvGet(key){ if(!hasKvConfigured()) return null; const res=await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`}}); if(!res.ok) throw new Error(`KV GET failed: ${res.status}`); const json=await res.json(); return Object.prototype.hasOwnProperty.call(json,'result')?json.result:null; }
async function kvSet(key,val){ if(!hasKvConfigured()) return; const res=await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.KV_REST_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(val)}); if(!res.ok) throw new Error(`KV SET failed: ${res.status}`); }
async function ensureDir(){ await fs.mkdir(dataDir,{recursive:true}); }
async function readJson(file,fallback){ try{ await ensureDir(); return JSON.parse(await fs.readFile(file,'utf8')); } catch { return fallback; } }
async function writeJson(file,data){ try{ await ensureDir(); await fs.writeFile(file, JSON.stringify(data,null,2),'utf8'); } catch {} }
async function readSignals(){ try{ const v=await kvGet(SIGNALS_KEY); if(Array.isArray(v)){ memorySignals=v; return v; } }catch{} const data=await readJson(signalsFile,memorySignals); memorySignals=Array.isArray(data)?data:[]; return memorySignals; }
async function writeSignals(v){ memorySignals=v; try{ await kvSet(SIGNALS_KEY,v);}catch{} await writeJson(signalsFile,v); }
async function readAssessment(){ try{ const v=await kvGet(ASSESSMENT_KEY); if(v&&typeof v==='object'){ memoryAssessment=v; return v; } }catch{} const data=await readJson(assessmentFile,memoryAssessment); memoryAssessment=data||defaultAssessment; return memoryAssessment; }
async function writeAssessment(v){ memoryAssessment=v; try{ await kvSet(ASSESSMENT_KEY,v);}catch{} await writeJson(assessmentFile,v); }
async function readCustomCrawlers(){ try{ const v=await kvGet(CUSTOM_CRAWLERS_KEY); if(Array.isArray(v)){ memoryCustomCrawlers=v; return v; } }catch{} const data=await readJson(customCrawlersFile,memoryCustomCrawlers); memoryCustomCrawlers=Array.isArray(data)?data:[]; return memoryCustomCrawlers; }
async function writeCustomCrawlers(v){ memoryCustomCrawlers=v; try{ await kvSet(CUSTOM_CRAWLERS_KEY,v);}catch{} await writeJson(customCrawlersFile,v); }
async function readSettings(){ try{ const v=await kvGet(SETTINGS_KEY); if(v&&typeof v==='object'){ memorySettings={...memorySettings,...v}; return memorySettings; } }catch{} const data=await readJson(settingsFile,memorySettings); memorySettings={...memorySettings,...(data||{})}; return memorySettings; }
async function writeSettings(v){ memorySettings={...memorySettings,...v}; try{ await kvSet(SETTINGS_KEY,memorySettings);}catch{} await writeJson(settingsFile,memorySettings); return memorySettings; }
function getSourceName(sourceId){ const source=sourceAssets.find(s=>s.id===sourceId); if(source) return source.name; const custom=memoryCustomCrawlers.find(c => `custom:${c.id}` === sourceId || c.id === sourceId); if (custom) return custom.name; if(String(sourceId||'').startsWith('custom:')) return sourceId.replace(/^custom:/,''); return sourceId; }
module.exports={readSignals,writeSignals,readAssessment,writeAssessment,readCustomCrawlers,writeCustomCrawlers,readSettings,writeSettings,getSourceName,hasKvConfigured};
