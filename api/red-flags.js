const { sendJson } = require('./_lib/http'); const { listRedFlags } = require('./_lib/service'); module.exports = async (req, res) => sendJson(res, 200, await listRedFlags());
