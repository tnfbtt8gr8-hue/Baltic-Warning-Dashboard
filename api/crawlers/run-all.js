const { sendJson } = require('../_lib/http');
const { runAllCrawlers } = require('../_lib/service');

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const adminHeader = req.headers['x-admin-secret'];
  return authHeader === `Bearer ${secret}` || adminHeader === secret;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized' });
  const results = await runAllCrawlers();
  sendJson(res, 200, { ok: true, results });
};
