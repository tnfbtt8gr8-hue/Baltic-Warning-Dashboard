const { sendJson, readJsonBody } = require('./_lib/http');
const { readSettings, writeSettings } = require('./_lib/store');
module.exports = async (req, res) => {
  if (req.method === 'GET') return sendJson(res, 200, await readSettings());
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const preferredHourTallinn = Math.max(0, Math.min(23, Number(body.preferredHourTallinn ?? 9)));
    const mode = ['daily','manual'].includes(body.mode) ? body.mode : 'daily';
    const saved = await writeSettings({ preferredHourTallinn, mode, updatedAt: new Date().toISOString() });
    return sendJson(res, 200, { ok: true, settings: saved });
  }
  return sendJson(res, 405, { error: 'Method not allowed' });
};
