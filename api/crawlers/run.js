const { sendJson, readJsonBody } = require('../_lib/http');
const { runCrawler } = require('../_lib/service');
const { crawlerRegistry } = require('../_lib/crawlers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  const body = await readJsonBody(req);
  const name = body && body.name;
  if (!name || !crawlerRegistry[name]) return sendJson(res, 400, { error: 'Invalid crawler name' });
  sendJson(res, 200, await runCrawler(name));
};
