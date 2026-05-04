const { sendJson } = require('./_lib/http'); const { listNais } = require('./_lib/service'); module.exports = async (req, res) => sendJson(res, 200, await listNais());
