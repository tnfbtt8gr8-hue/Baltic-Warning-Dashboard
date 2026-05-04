const { sendJson } = require('./_lib/http'); const { listPirs } = require('./_lib/service'); module.exports = async (req, res) => sendJson(res, 200, await listPirs());
