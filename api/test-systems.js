const { sendJson } = require('./_lib/http');
const { runSystemTests } = require('./_lib/service');
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  sendJson(res, 200, await runSystemTests());
};
