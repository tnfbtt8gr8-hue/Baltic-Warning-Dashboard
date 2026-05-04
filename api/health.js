const { sendJson } = require('./_lib/http');
module.exports = async (req, res) => { sendJson(res, 200, { ok: true, app: 'Baltic Warning Dashboard', version: '4.0.2', model: 'Decision Board + Collection Workshop + Ontology Engine' }); };
